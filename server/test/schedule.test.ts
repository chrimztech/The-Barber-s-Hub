import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://unused";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
process.env.TIMEZONE = "Africa/Lusaka";

const { bookingTimeProblem, slotsFor, studioNow } = await import("../src/lib/schedule.js");
const { defaultBooking } = await import("../src/lib/settings.js");

// 2026-11-10 is a Tuesday (09:00–20:00); 2026-11-09 a Monday (closed).
const TUESDAY = "2026-11-10";

test("studioNow uses the studio time zone (UTC+2)", () => {
  const now = studioNow(new Date("2026-11-10T22:30:00Z"));
  assert.deepEqual(now, { date: "2026-11-11", minutes: 30 });
});

test("slots respect opening hours and service length", () => {
  const slots = slotsFor(TUESDAY, 90, defaultBooking);
  assert.equal(slots[0], "09:00");
  assert.equal(slots.at(-1), "18:00", "18:00 + 90 min = 19:30, 19:00 + 90 would pass 20:00");
  assert.deepEqual(slotsFor("2026-11-09", 30, defaultBooking), []);
});

test("rejects past times today but allows later ones", () => {
  const now = { date: TUESDAY, minutes: 14 * 60 + 5 }; // 14:05 studio time
  assert.equal(
    bookingTimeProblem(TUESDAY, "14:00", 30, defaultBooking, now),
    "That time has already passed",
  );
  assert.equal(bookingTimeProblem(TUESDAY, "15:00", 30, defaultBooking, now), null);
  assert.match(
    bookingTimeProblem("2026-11-09", "10:00", 30, defaultBooking, now)!,
    /must be today or later/,
  );
});

test("rejects closed days and times outside hours", () => {
  const now = { date: "2026-11-01", minutes: 0 };
  assert.equal(
    bookingTimeProblem("2026-11-09", "10:00", 30, defaultBooking, now),
    "The studio is closed on that day",
  );
  assert.match(
    bookingTimeProblem(TUESDAY, "08:30", 30, defaultBooking, now)!,
    /between 09:00 and 20:00/,
  );
  assert.match(bookingTimeProblem(TUESDAY, "19:45", 30, defaultBooking, now)!, /between/);
  assert.equal(bookingTimeProblem(TUESDAY, "19:30", 30, defaultBooking, now), null);
});
