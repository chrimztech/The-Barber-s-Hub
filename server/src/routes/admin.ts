import { Router } from "express";
import { z } from "zod";
import { query, queryOne, withTransaction } from "../db/pool.js";
import { currentUser, requireAdmin, revokeSessions } from "../lib/auth.js";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../lib/http.js";
import { notifyBookingStatus, notifyOrderStatus } from "../lib/notifications.js";
import { getSettings } from "../lib/settings.js";
import { sendPasswordReset } from "../lib/passwordReset.js";
import { bookingSelect, buildUpdate, reviewSelect } from "../lib/sql.js";
import {
  activeStatus,
  imageUrl,
  isoDate,
  nullableUuid,
  optionalText,
  requiredText,
  slug,
  timeOfDay,
  uuid,
} from "../lib/validation.js";
import { uploadRouter } from "./uploads.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);
adminRouter.use("/uploads", uploadRouter);

const idParam = (value: unknown) => parse(uuid, value);
const toNull = (value: string | null | undefined) => (value ? value : null);

// Overview ---------------------------------------------------------------------

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const stats = await queryOne(
      `SELECT
         (SELECT COUNT(*) FROM services) AS services,
         (SELECT COUNT(*) FROM products) AS products,
         (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
         (SELECT COUNT(*) FROM orders WHERE order_status = 'pending') AS pending_orders,
         (SELECT COUNT(*) FROM profiles) AS customers,
         (SELECT COUNT(*) FROM products
           WHERE stock_quantity <= COALESCE(
             (SELECT (value->>'low_stock_threshold')::int FROM settings WHERE key = 'commerce'), 5)
         ) AS low_stock,
         (SELECT COUNT(*) FROM contact_messages WHERE status = 'unread') AS unread_messages,
         (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS pending_reviews`,
    );
    res.json(stats);
  }),
);

// Bookings ---------------------------------------------------------------------

const bookingStatus = z.enum(["pending", "confirmed", "completed", "cancelled", "rejected"]);

adminRouter.get(
  "/bookings",
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(500).optional().parse(req.query.limit);
    const order =
      req.query.recent === "true"
        ? "b.created_at DESC"
        : "b.booking_date DESC, b.booking_time DESC";
    res.json(await query(`${bookingSelect} ORDER BY ${order} LIMIT $1`, [limit ?? 500]));
  }),
);

adminRouter.patch(
  "/bookings/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const body = parse(
      z.object({
        status: bookingStatus.optional(),
        booking_date: isoDate.optional(),
        booking_time: timeOfDay.optional(),
        barber_id: nullableUuid,
        admin_note: optionalText(1000),
      }),
      req.body,
    );
    const fields = {
      status: body.status,
      booking_date: body.booking_date,
      booking_time: body.booking_time,
      barber_id: "barber_id" in req.body ? body.barber_id : undefined,
      admin_note: "admin_note" in req.body ? body.admin_note : undefined,
    };
    const { assignments, values } = buildUpdate(fields, 2);
    if (!assignments.length) throw badRequest("Nothing to update");
    const updated = await queryOne(
      `UPDATE bookings SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    if (!updated) throw notFound("Booking not found");
    if (body.status) notifyBookingStatus(id);
    res.json(updated);
  }),
);

adminRouter.delete(
  "/bookings/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM bookings WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Booking not found");
    res.status(204).end();
  }),
);

// Orders -----------------------------------------------------------------------

adminRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(1000).optional().parse(req.query.limit);
    res.json(
      await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT $1", [limit ?? 1000]),
    );
  }),
);

adminRouter.get(
  "/orders/:id/items",
  asyncHandler(async (req, res) => {
    res.json(
      await query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at", [
        idParam(req.params.id),
      ]),
    );
  }),
);

adminRouter.patch(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const body = parse(
      z.object({
        order_status: z
          .enum(["pending", "processing", "shipped", "delivered", "cancelled"])
          .optional(),
        payment_status: z.enum(["unpaid", "paid", "failed", "refunded"]).optional(),
      }),
      req.body,
    );

    let statusChanged = false;
    const updated = await withTransaction(async (client) => {
      const current = await client.query<{ order_status: string }>(
        "SELECT order_status FROM orders WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!current.rowCount) throw notFound("Order not found");
      statusChanged = !!body.order_status && body.order_status !== current.rows[0].order_status;
      const wasCancelled = current.rows[0].order_status === "cancelled";
      const willCancel = body.order_status === "cancelled";

      // Return reserved stock when an order is cancelled; take it again if un-cancelled.
      if (willCancel !== wasCancelled && body.order_status) {
        if (!willCancel) {
          const short = await client.query<{ name: string; stock_quantity: number }>(
            `SELECT p.name, p.stock_quantity FROM order_items oi
               JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = $1 AND p.stock_quantity < oi.quantity
              FOR UPDATE OF p`,
            [id],
          );
          if (short.rows[0]) {
            throw conflict(
              `Can't reopen this order: only ${short.rows[0].stock_quantity} of ${short.rows[0].name} left in stock`,
            );
          }
        }
        const sign = willCancel ? "+" : "-";
        await client.query(
          `UPDATE products p SET stock_quantity = p.stock_quantity ${sign} oi.quantity
             FROM order_items oi
            WHERE oi.order_id = $1 AND oi.product_id = p.id`,
          [id],
        );
      }

      const { assignments, values } = buildUpdate(body, 2);
      if (!assignments.length) throw badRequest("Nothing to update");
      const result = await client.query(
        `UPDATE orders SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return result.rows[0];
    });
    if (statusChanged) notifyOrderStatus(id);
    res.json(updated);
  }),
);

// Customers --------------------------------------------------------------------

adminRouter.get(
  "/customers",
  asyncHandler(async (_req, res) => {
    res.json(
      await query(
        `SELECT p.*,
                EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'admin') AS "isAdmin",
                (SELECT COUNT(*) FROM bookings b WHERE b.user_id = p.id) AS booking_count,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = p.id) AS order_count
           FROM profiles p
          ORDER BY p.created_at DESC`,
      ),
    );
  }),
);

adminRouter.patch(
  "/customers/:id",
  asyncHandler(async (req, res) => {
    const id = idParam(req.params.id);
    const me = currentUser(req);
    const body = parse(
      z.object({
        full_name: optionalText(80).optional(),
        phone: optionalText(30).optional(),
        status: z.enum(["active", "suspended"]).optional(),
        isAdmin: z.boolean().optional(),
      }),
      req.body,
    );
    if (id === me.id && body.isAdmin === false) {
      throw badRequest("You cannot remove your own admin access");
    }
    if (id === me.id && body.status === "suspended") {
      throw badRequest("You cannot suspend your own account");
    }

    const profile = await withTransaction(async (client) => {
      const { assignments, values } = buildUpdate(
        { full_name: body.full_name, phone: body.phone, status: body.status },
        2,
      );
      let row;
      if (assignments.length) {
        const result = await client.query(
          `UPDATE profiles SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
          [id, ...values],
        );
        row = result.rows[0];
      } else {
        row = (await client.query("SELECT * FROM profiles WHERE id = $1", [id])).rows[0];
      }
      if (!row) throw notFound("Customer not found");

      if (body.isAdmin === true) {
        await client.query(
          "INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
          [id],
        );
      } else if (body.isAdmin === false) {
        await client.query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'admin'", [id]);
      }
      // Suspension takes effect immediately on every device.
      if (body.status === "suspended") await revokeSessions(id, client);
      return row;
    });
    res.json(profile);
  }),
);

adminRouter.post(
  "/customers/:id/password-reset",
  asyncHandler(async (req, res) => {
    const profile = await queryOne<{ email: string }>(
      "SELECT u.email FROM users u WHERE u.id = $1",
      [idParam(req.params.id)],
    );
    if (!profile) throw notFound("Customer not found");
    await sendPasswordReset(profile.email);
    res.json({ message: `Password reset link sent to ${profile.email}` });
  }),
);

// Reviews ----------------------------------------------------------------------

adminRouter.get(
  "/reviews",
  asyncHandler(async (_req, res) => {
    res.json(await query(`${reviewSelect} ORDER BY r.created_at DESC`));
  }),
);

adminRouter.patch(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ status: z.enum(["pending", "approved", "rejected"]) }), req.body);
    const updated = await queryOne("UPDATE reviews SET status = $2 WHERE id = $1 RETURNING *", [
      idParam(req.params.id),
      body.status,
    ]);
    if (!updated) throw notFound("Review not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM reviews WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Review not found");
    res.status(204).end();
  }),
);

// Enquiries --------------------------------------------------------------------

adminRouter.get(
  "/messages",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM contact_messages ORDER BY created_at DESC"));
  }),
);

adminRouter.patch(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        status: z.enum(["unread", "read", "replied"]).optional(),
        admin_note: optionalText(2000).optional(),
      }),
      req.body,
    );
    const { assignments, values } = buildUpdate(
      { status: body.status, admin_note: "admin_note" in req.body ? body.admin_note : undefined },
      2,
    );
    if (!assignments.length) throw badRequest("Nothing to update");
    const updated = await queryOne(
      `UPDATE contact_messages SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
      [idParam(req.params.id), ...values],
    );
    if (!updated) throw notFound("Enquiry not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM contact_messages WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Enquiry not found");
    res.status(204).end();
  }),
);

// Services ---------------------------------------------------------------------

const gallery = z.array(z.string().trim().url().max(1000)).max(20).default([]);

const serviceSchema = z.object({
  name: requiredText(1, 120, "Name"),
  slug,
  short_description: optionalText(300),
  full_description: optionalText(5000),
  price: z.number().nonnegative("Price must be a non-negative number"),
  duration: z.number().int().positive("Duration must be a positive whole number of minutes"),
  image_url: imageUrl,
  category_id: nullableUuid,
  is_featured: z.boolean().default(false),
  status: activeStatus.default("active"),
  gallery_images: gallery,
});

function serviceValues(body: z.infer<typeof serviceSchema>) {
  return [
    body.name,
    body.slug,
    body.short_description,
    body.full_description,
    body.price,
    body.duration,
    toNull(body.image_url),
    body.category_id,
    body.is_featured,
    body.status,
    JSON.stringify(body.gallery_images),
  ];
}

adminRouter.get(
  "/services",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM services ORDER BY created_at DESC"));
  }),
);

adminRouter.post(
  "/services",
  asyncHandler(async (req, res) => {
    const body = parse(serviceSchema, req.body);
    const created = await queryOne(
      `INSERT INTO services (name, slug, short_description, full_description, price, duration,
                             image_url, category_id, is_featured, status, gallery_images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
      serviceValues(body),
    );
    res.status(201).json(created);
  }),
);

adminRouter.put(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const body = parse(serviceSchema, req.body);
    const updated = await queryOne(
      `UPDATE services SET name = $2, slug = $3, short_description = $4, full_description = $5,
              price = $6, duration = $7, image_url = $8, category_id = $9, is_featured = $10,
              status = $11, gallery_images = $12::jsonb
        WHERE id = $1 RETURNING *`,
      [idParam(req.params.id), ...serviceValues(body)],
    );
    if (!updated) throw notFound("Service not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM services WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Service not found");
    res.status(204).end();
  }),
);

// Products ---------------------------------------------------------------------

const productSchema = z
  .object({
    name: requiredText(1, 160, "Name"),
    slug,
    brand: optionalText(80),
    short_description: optionalText(300),
    full_description: optionalText(5000),
    price: z.number().nonnegative("Price must be a non-negative number"),
    discount_price: z.number().nonnegative().nullable().default(null),
    stock_quantity: z
      .number()
      .int()
      .nonnegative("Stock quantity must be a non-negative whole number"),
    image_url: imageUrl,
    category_id: nullableUuid,
    is_featured: z.boolean().default(false),
    status: activeStatus.default("active"),
    condition: z.enum(["new", "refurbished", "used"]).default("new"),
    gallery_images: gallery,
    specifications: z.record(z.string().max(80), z.string().max(500)).default({}),
  })
  .refine((value) => value.discount_price === null || value.discount_price < value.price, {
    message: "Discount price must be less than the regular price",
    path: ["discount_price"],
  });

function productValues(body: z.infer<typeof productSchema>) {
  return [
    body.name,
    body.slug,
    body.brand,
    body.short_description,
    body.full_description,
    body.price,
    body.discount_price,
    body.stock_quantity,
    toNull(body.image_url),
    body.category_id,
    body.is_featured,
    body.status,
    body.condition,
    JSON.stringify(body.gallery_images),
    JSON.stringify(body.specifications),
  ];
}

adminRouter.get(
  "/products",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM products ORDER BY created_at DESC"));
  }),
);

adminRouter.post(
  "/products",
  asyncHandler(async (req, res) => {
    const body = parse(productSchema, req.body);
    const created = await queryOne(
      `INSERT INTO products (name, slug, brand, short_description, full_description, price,
                             discount_price, stock_quantity, image_url, category_id, is_featured,
                             status, condition, gallery_images, specifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
       RETURNING *`,
      productValues(body),
    );
    res.status(201).json(created);
  }),
);

adminRouter.put(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const body = parse(productSchema, req.body);
    const updated = await queryOne(
      `UPDATE products SET name = $2, slug = $3, brand = $4, short_description = $5,
              full_description = $6, price = $7, discount_price = $8, stock_quantity = $9,
              image_url = $10, category_id = $11, is_featured = $12, status = $13, condition = $14,
              gallery_images = $15::jsonb, specifications = $16::jsonb
        WHERE id = $1 RETURNING *`,
      [idParam(req.params.id), ...productValues(body)],
    );
    if (!updated) throw notFound("Product not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM products WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Product not found");
    res.status(204).end();
  }),
);

// Categories (service + product) -------------------------------------------------

const categoryTables = { service: "service_categories", product: "product_categories" } as const;
const categoryTable = (value: unknown) =>
  categoryTables[parse(z.enum(["service", "product"]), value)];

const categorySchema = z.object({
  name: requiredText(1, 120, "Name"),
  slug,
  description: optionalText(1000),
  image_url: imageUrl,
  status: activeStatus.default("active"),
});

adminRouter.get(
  "/categories/:type",
  asyncHandler(async (req, res) => {
    res.json(await query(`SELECT * FROM ${categoryTable(req.params.type)} ORDER BY name`));
  }),
);

adminRouter.post(
  "/categories/:type",
  asyncHandler(async (req, res) => {
    const table = categoryTable(req.params.type);
    const body = parse(categorySchema, req.body);
    const created = await queryOne(
      `INSERT INTO ${table} (name, slug, description, image_url, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.name, body.slug, body.description, toNull(body.image_url), body.status],
    );
    res.status(201).json(created);
  }),
);

adminRouter.put(
  "/categories/:type/:id",
  asyncHandler(async (req, res) => {
    const table = categoryTable(req.params.type);
    const body = parse(categorySchema, req.body);
    const updated = await queryOne(
      `UPDATE ${table} SET name = $2, slug = $3, description = $4, image_url = $5, status = $6
        WHERE id = $1 RETURNING *`,
      [
        idParam(req.params.id),
        body.name,
        body.slug,
        body.description,
        toNull(body.image_url),
        body.status,
      ],
    );
    if (!updated) throw notFound("Category not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/categories/:type/:id",
  asyncHandler(async (req, res) => {
    const table = categoryTable(req.params.type);
    const deleted = await queryOne(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Category not found");
    res.status(204).end();
  }),
);

// Barbers ----------------------------------------------------------------------

const barberSchema = z.object({
  name: requiredText(1, 120, "Name"),
  specialty: optionalText(120),
  bio: optionalText(2000),
  phone: optionalText(30),
  photo_url: imageUrl,
  status: activeStatus.default("active"),
});

adminRouter.get(
  "/barbers",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM barbers ORDER BY name"));
  }),
);

adminRouter.post(
  "/barbers",
  asyncHandler(async (req, res) => {
    const body = parse(barberSchema, req.body);
    const created = await queryOne(
      `INSERT INTO barbers (name, specialty, bio, phone, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.name, body.specialty, body.bio, body.phone, toNull(body.photo_url), body.status],
    );
    res.status(201).json(created);
  }),
);

adminRouter.put(
  "/barbers/:id",
  asyncHandler(async (req, res) => {
    const body = parse(barberSchema, req.body);
    const updated = await queryOne(
      `UPDATE barbers SET name = $2, specialty = $3, bio = $4, phone = $5, photo_url = $6, status = $7
        WHERE id = $1 RETURNING *`,
      [
        idParam(req.params.id),
        body.name,
        body.specialty,
        body.bio,
        body.phone,
        toNull(body.photo_url),
        body.status,
      ],
    );
    if (!updated) throw notFound("Barber not found");
    res.json(updated);
  }),
);

adminRouter.delete(
  "/barbers/:id",
  asyncHandler(async (req, res) => {
    const deleted = await queryOne("DELETE FROM barbers WHERE id = $1 RETURNING id", [
      idParam(req.params.id),
    ]);
    if (!deleted) throw notFound("Barber not found");
    res.status(204).end();
  }),
);

// Settings ---------------------------------------------------------------------

/** One day's opening hours, or null when closed. */
const dayHours = z
  .object({ open: timeOfDay, close: timeOfDay })
  .refine((value) => value.open < value.close, {
    message: "Closing time must be after opening time",
  })
  .nullable();

const settingsSchema = z.object({
  business: z.object({
    business_name: requiredText(1, 120, "Business name"),
    email: z.string().trim().max(160),
    phone: z.string().trim().max(40),
    whatsapp: z.string().trim().max(40),
    address: z.string().trim().max(300),
    hours: z.string().trim().max(300),
    instagram: z.string().trim().max(300),
    facebook: z.string().trim().max(300),
    twitter: z.string().trim().max(300),
    tiktok: z.string().trim().max(300),
    youtube: z.string().trim().max(300),
  }),
  commerce: z.object({
    currency: z.enum(["ZMW", "USD"]),
    delivery_fee: z.number().nonnegative("Delivery fee must be a non-negative number"),
    pickup_address: z.string().trim().max(300),
    low_stock_threshold: z.number().int().nonnegative("Low stock threshold must be a whole number"),
  }),
  booking: z
    .object({
      slot_minutes: z.number().int().min(10).max(240),
      hours: z.object({
        sun: dayHours,
        mon: dayHours,
        tue: dayHours,
        wed: dayHours,
        thu: dayHours,
        fri: dayHours,
        sat: dayHours,
      }),
    })
    .optional(),
  payments: z
    .object({
      mobile_money_number: z.string().trim().max(40),
      mobile_money_name: z.string().trim().max(120),
      bank_details: z.string().trim().max(1000),
    })
    .optional(),
});

adminRouter.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = parse(settingsSchema, req.body);
    const entries = Object.entries(body).filter(([, value]) => value !== undefined);
    await query(
      `INSERT INTO settings (key, value)
       SELECT key, value FROM jsonb_each($1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(Object.fromEntries(entries))],
    );
    res.json(await getSettings());
  }),
);
