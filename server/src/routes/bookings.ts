import { Router } from "express";
import { z } from "zod";
import { query, queryOne, withTransaction } from "../db/pool.js";
import { assertActive, optionalAuth } from "../lib/auth.js";
import { asyncHandler, badRequest, conflict, parse } from "../lib/http.js";
import { notifyBookingCreated } from "../lib/notifications.js";
import { bookingTimeProblem, hoursFor, slotsFor, studioNow, toMinutes } from "../lib/schedule.js";
import { getSettings } from "../lib/settings.js";
import {
  isoDate,
  nullableUuid,
  optionalEmail,
  optionalText,
  requiredText,
  timeOfDay,
  uuid,
} from "../lib/validation.js";

export const bookingsRouter = Router();

const ACTIVE = "status IN ('pending', 'confirmed')";

/**
 * Lists start times for a date with their availability. A slot is full when every
 * active barber already has a pending/confirmed booking at that time, or when the
 * chosen barber is already booked.
 */
bookingsRouter.get(
  "/availability",
  asyncHandler(async (req, res) => {
    const params = parse(
      z.object({ date: isoDate, service_id: uuid.optional(), barber_id: uuid.optional() }),
      req.query,
    );
    const settings = await getSettings();
    const service = params.service_id
      ? await queryOne<{ duration: number }>(
          "SELECT duration FROM services WHERE id = $1 AND status = 'active'",
          [params.service_id],
        )
      : null;
    const duration = service?.duration ?? settings.booking.slot_minutes;
    const hours = hoursFor(params.date, settings.booking);
    const now = studioNow();

    const [{ barbers }] = await query<{ barbers: number }>(
      "SELECT COUNT(*) AS barbers FROM barbers WHERE status = 'active'",
    );
    const taken = await query<{ time: string; total: number; with_barber: number }>(
      `SELECT to_char(booking_time, 'HH24:MI') AS time, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE barber_id = $2) AS with_barber
         FROM bookings
        WHERE booking_date = $1 AND ${ACTIVE}
        GROUP BY booking_time`,
      [params.date, params.barber_id ?? null],
    );
    const byTime = new Map(taken.map((row) => [row.time, row]));

    const slots =
      params.date < now.date
        ? []
        : slotsFor(params.date, duration, settings.booking).map((time) => {
            const row = byTime.get(time);
            const past = params.date === now.date && toMinutes(time) <= now.minutes;
            const full = barbers === 0 || (row?.total ?? 0) >= barbers;
            const barberTaken = !!params.barber_id && (row?.with_barber ?? 0) > 0;
            return { time, available: !past && !full && !barberTaken };
          });

    res.json({ date: params.date, open: !!hours, hours, slots });
  }),
);

const bookingSchema = z.object({
  service_id: uuid,
  barber_id: nullableUuid,
  customer_name: requiredText(2, 80, "Name"),
  customer_email: optionalEmail,
  customer_phone: requiredText(6, 30, "Phone"),
  booking_date: isoDate,
  booking_time: timeOfDay,
  customer_note: optionalText(500),
});

/**
 * Creates a booking. Checks opening hours (in studio-local time) and capacity; an
 * advisory lock serialises concurrent requests for the same slot.
 */
bookingsRouter.post(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    assertActive(req.user, "create bookings");
    const body = parse(bookingSchema, req.body);
    const settings = await getSettings();

    const booking = await withTransaction(async (client) => {
      const service = await client.query<{ duration: number }>(
        "SELECT duration FROM services WHERE id = $1 AND status = 'active'",
        [body.service_id],
      );
      if (!service.rowCount) throw badRequest("The selected service is unavailable");

      const problem = bookingTimeProblem(
        body.booking_date,
        body.booking_time,
        service.rows[0].duration,
        settings.booking,
      );
      if (problem) throw badRequest(problem);

      if (body.barber_id) {
        const barber = await client.query(
          "SELECT 1 FROM barbers WHERE id = $1 AND status = 'active'",
          [body.barber_id],
        );
        if (!barber.rowCount) throw badRequest("The selected barber is unavailable");
      }

      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `booking:${body.booking_date}:${body.booking_time}`,
      ]);

      const capacity = await client.query<{
        barbers: number;
        occupied: number;
        barber_taken: boolean;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM barbers WHERE status = 'active') AS barbers,
           (SELECT COUNT(*) FROM bookings
             WHERE booking_date = $1 AND booking_time = $2 AND ${ACTIVE}) AS occupied,
           EXISTS (SELECT 1 FROM bookings
             WHERE booking_date = $1 AND booking_time = $2 AND barber_id = $3 AND ${ACTIVE}) AS barber_taken`,
        [body.booking_date, body.booking_time, body.barber_id],
      );
      const { barbers, occupied, barber_taken } = capacity.rows[0];
      if (barbers === 0 || occupied >= barbers) throw conflict("That time is fully booked");
      if (body.barber_id && barber_taken) {
        throw conflict("That barber is already booked at this time");
      }

      const inserted = await client.query(
        `INSERT INTO bookings (user_id, service_id, barber_id, customer_name, customer_email,
                               customer_phone, booking_date, booking_time, customer_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          req.user?.id ?? null,
          body.service_id,
          body.barber_id,
          body.customer_name,
          body.customer_email ?? req.user?.email ?? null,
          body.customer_phone,
          body.booking_date,
          body.booking_time,
          body.customer_note,
        ],
      );
      return inserted.rows[0];
    });

    notifyBookingCreated(booking.id);
    res.status(201).json(booking);
  }),
);
