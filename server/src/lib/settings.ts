import { query, type Db } from "../db/pool.js";

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Day = (typeof DAYS)[number];
export type DayHours = { open: string; close: string } | null;

export type BookingSettings = { slot_minutes: number; hours: Record<Day, DayHours> };
export type PaymentSettings = {
  mobile_money_number: string;
  mobile_money_name: string;
  bank_details: string;
};

export const defaultBooking: BookingSettings = {
  slot_minutes: 60,
  hours: {
    sun: { open: "10:00", close: "16:00" },
    mon: null,
    tue: { open: "09:00", close: "20:00" },
    wed: { open: "09:00", close: "20:00" },
    thu: { open: "09:00", close: "20:00" },
    fri: { open: "09:00", close: "20:00" },
    sat: { open: "09:00", close: "20:00" },
  },
};

export const defaultPayments: PaymentSettings = {
  mobile_money_number: "",
  mobile_money_name: "",
  bank_details: "",
};

export async function getSettings(db?: Db) {
  const rows = await query<{ key: string; value: Record<string, unknown> | null }>(
    "SELECT key, value FROM settings WHERE key IN ('business', 'commerce', 'booking', 'payments')",
    [],
    db,
  );
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value ?? {}]));
  const booking = (values.booking ?? {}) as Partial<BookingSettings>;
  return {
    business: (values.business ?? {}) as Record<string, string>,
    commerce: (values.commerce ?? {}) as Record<string, string | number>,
    booking: {
      slot_minutes: booking.slot_minutes ?? defaultBooking.slot_minutes,
      hours: { ...defaultBooking.hours, ...(booking.hours ?? {}) },
    } as BookingSettings,
    payments: { ...defaultPayments, ...((values.payments ?? {}) as Partial<PaymentSettings>) },
  };
}
