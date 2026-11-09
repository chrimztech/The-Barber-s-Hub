import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../db/pool.js";
import { assertActive, currentUser, requireAuth } from "../lib/auth.js";
import { asyncHandler, badRequest, conflict, parse } from "../lib/http.js";
import { notifyOrderPlaced } from "../lib/notifications.js";
import { optionalEmail, optionalText, requiredText, uuid } from "../lib/validation.js";

export const ordersRouter = Router();

const orderSchema = z
  .object({
    customer_name: requiredText(2, 80, "Name"),
    customer_email: optionalEmail,
    customer_phone: requiredText(6, 30, "Phone"),
    delivery_address: optionalText(300),
    delivery_method: z.enum(["delivery", "pickup"]),
    payment_method: z.enum(["cash_on_delivery", "mobile_money", "bank_transfer"]),
    order_note: optionalText(500),
    items: z
      .array(z.object({ product_id: uuid, quantity: z.number().int().min(1).max(999) }))
      .min(1, "The cart is empty")
      .max(100),
  })
  .refine(
    (value) => value.delivery_method === "pickup" || (value.delivery_address?.length ?? 0) >= 4,
    { message: "Enter a delivery address", path: ["delivery_address"] },
  );

/**
 * Places an order and reserves stock in one transaction. Names and prices come
 * from the catalogue, never from the browser; the delivery fee comes from settings.
 */
ordersRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    assertActive(user, "place orders");
    const body = parse(orderSchema, req.body);

    // Merge duplicate lines so stock is checked against the total quantity.
    const quantities = new Map<string, number>();
    for (const item of body.items) {
      quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
    }

    const order = await withTransaction(async (client) => {
      const settings = await client.query<{ fee: number | null }>(
        "SELECT (value->>'delivery_fee')::numeric AS fee FROM settings WHERE key = 'commerce'",
      );
      const deliveryFee =
        body.delivery_method === "delivery" ? Number(settings.rows[0]?.fee ?? 0) : 0;

      // Lock rows in a stable order to avoid deadlocks between concurrent checkouts.
      const ids = [...quantities.keys()].sort();
      const products = await client.query<{
        id: string;
        name: string;
        price: number;
        discount_price: number | null;
        stock_quantity: number;
      }>(
        `SELECT id, name, price, discount_price, stock_quantity FROM products
          WHERE id = ANY($1::uuid[]) AND status = 'active'
          ORDER BY id FOR UPDATE`,
        [ids],
      );
      if (products.rowCount !== ids.length) {
        throw conflict("A product in your cart is no longer available");
      }

      let subtotal = 0;
      const lines = products.rows.map((product) => {
        const quantity = quantities.get(product.id)!;
        if (product.stock_quantity < quantity) {
          throw conflict(`Only ${product.stock_quantity} of ${product.name} remain in stock`);
        }
        const unitPrice = Number(product.discount_price ?? product.price);
        const total = Math.round(unitPrice * quantity * 100) / 100;
        subtotal += total;
        return { product, quantity, unitPrice, total };
      });
      subtotal = Math.round(subtotal * 100) / 100;

      const inserted = await client.query(
        `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_address,
                             delivery_method, payment_method, subtotal, delivery_fee, total, order_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, order_number, total`,
        [
          user.id,
          body.customer_name,
          body.customer_email ?? user.email,
          body.customer_phone,
          body.delivery_address,
          body.delivery_method,
          body.payment_method,
          subtotal,
          deliveryFee,
          subtotal + deliveryFee,
          body.order_note,
        ],
      );
      const created = inserted.rows[0];

      for (const line of lines) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            created.id,
            line.product.id,
            line.product.name,
            line.quantity,
            line.unitPrice,
            line.total,
          ],
        );
        await client.query(
          "UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2",
          [line.quantity, line.product.id],
        );
      }
      return created;
    });

    if (!order) throw badRequest("Order could not be placed");
    notifyOrderPlaced(order.id);
    res.status(201).json(order);
  }),
);
