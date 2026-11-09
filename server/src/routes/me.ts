import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { currentUser, requireAuth, revokeSessions } from "../lib/auth.js";
import { asyncHandler, badRequest, notFound, parse } from "../lib/http.js";
import { notifyBookingStatus, notifyPaymentReference } from "../lib/notifications.js";
import { bookingSelect, reviewSelect } from "../lib/sql.js";
import { optionalText, requiredText, uuid } from "../lib/validation.js";

/** Routes for the signed-in customer's own data. */
export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await queryOne("SELECT * FROM profiles WHERE id = $1", [currentUser(req).id]);
    res.json(profile);
  }),
);

meRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const body = parse(
      z.object({ full_name: requiredText(2, 80, "Full name"), phone: optionalText(30) }),
      req.body,
    );
    const profile = await queryOne(
      `INSERT INTO profiles (id, email, full_name, phone) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
       RETURNING *`,
      [user.id, user.email, body.full_name, body.phone],
    );
    res.json(profile);
  }),
);

meRouter.post(
  "/deactivate",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    await query("UPDATE profiles SET status = 'suspended' WHERE id = $1", [user.id]);
    await revokeSessions(user.id);
    res.json({ message: "Account deactivated" });
  }),
);

meRouter.get(
  "/bookings",
  asyncHandler(async (req, res) => {
    res.json(
      await query(
        `${bookingSelect} WHERE b.user_id = $1 ORDER BY b.booking_date DESC, b.booking_time DESC`,
        [currentUser(req).id],
      ),
    );
  }),
);

meRouter.post(
  "/bookings/:id/cancel",
  asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const booking = await queryOne<{ status: string }>(
      "SELECT status FROM bookings WHERE id = $1 AND user_id = $2",
      [id, currentUser(req).id],
    );
    if (!booking) throw notFound("Booking not found");
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw badRequest("Only pending or confirmed appointments can be cancelled");
    }
    const updated = await queryOne(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [id],
    );
    notifyBookingStatus(id);
    res.json(updated);
  }),
);

meRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    res.json(
      await query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [
        currentUser(req).id,
      ]),
    );
  }),
);

meRouter.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const order = await queryOne("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [
      id,
      currentUser(req).id,
    ]);
    if (!order) throw notFound("Order not found");
    const items = await query("SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at", [
      id,
    ]);
    res.json({ ...order, items });
  }),
);

/** Customer records the mobile money / bank transfer reference so staff can verify it. */
meRouter.post(
  "/orders/:id/payment-reference",
  asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const body = parse(z.object({ reference: requiredText(3, 100, "Reference") }), req.body);
    const order = await queryOne<{ payment_status: string; payment_method: string }>(
      "SELECT payment_status, payment_method FROM orders WHERE id = $1 AND user_id = $2",
      [id, currentUser(req).id],
    );
    if (!order) throw notFound("Order not found");
    if (order.payment_method === "cash_on_delivery") {
      throw badRequest("Cash orders don't need a payment reference");
    }
    if (order.payment_status === "paid") throw badRequest("This order is already marked as paid");
    const updated = await queryOne(
      "UPDATE orders SET payment_reference = $2 WHERE id = $1 RETURNING *",
      [id, body.reference],
    );
    notifyPaymentReference(id);
    res.json(updated);
  }),
);

meRouter.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    res.json(
      await query(`${reviewSelect} WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [
        currentUser(req).id,
      ]),
    );
  }),
);

meRouter.delete(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const id = parse(uuid, req.params.id);
    const deleted = await queryOne(
      "DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, currentUser(req).id],
    );
    if (!deleted) throw notFound("Review not found");
    res.status(204).end();
  }),
);
