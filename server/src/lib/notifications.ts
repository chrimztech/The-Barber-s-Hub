import { config } from "../config.js";
import { query, queryOne } from "../db/pool.js";
import { sendMail } from "./mailer.js";
import { getSettings } from "./settings.js";

/**
 * Transactional emails. Every function is fire-and-forget: a mail failure is logged
 * and never fails the request that triggered it.
 */
function background(task: () => Promise<void>) {
  task().catch((error) => console.error("[mail] notification failed", error));
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);

async function studio() {
  const settings = await getSettings();
  const name = settings.business.business_name || "Deepcuts Hair Studio";
  const notify = config.STUDIO_NOTIFY_EMAIL || settings.business.email || "";
  const currency = String(settings.commerce.currency ?? "ZMW");
  return { name, notify, currency, settings };
}

async function send(to: string | null | undefined, subject: string, lines: string[]) {
  if (!to) return;
  const text = lines.join("\n");
  const html = lines.map((line) => `<p>${escapeHtml(line) || "&nbsp;"}</p>`).join("");
  await sendMail({ to, subject, text, html });
}

type BookingRow = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  status: string;
  customer_note: string | null;
  service_name: string | null;
  barber_name: string | null;
};

async function loadBooking(id: string) {
  return queryOne<BookingRow>(
    `SELECT b.id, b.customer_name, b.customer_email, b.customer_phone, b.booking_date,
            to_char(b.booking_time, 'HH24:MI') AS booking_time, b.status, b.customer_note,
            s.name AS service_name, br.name AS barber_name
       FROM bookings b
       LEFT JOIN services s ON s.id = b.service_id
       LEFT JOIN barbers br ON br.id = b.barber_id
      WHERE b.id = $1`,
    [id],
  );
}

const bookingSummary = (b: BookingRow) => [
  `Service: ${b.service_name ?? "Service"}`,
  `When: ${b.booking_date} at ${b.booking_time}`,
  `Barber: ${b.barber_name ?? "Any available barber"}`,
];

export function notifyBookingCreated(bookingId: string) {
  background(async () => {
    const booking = await loadBooking(bookingId);
    if (!booking) return;
    const { name, notify } = await studio();
    await send(booking.customer_email, `We've received your booking at ${name}`, [
      `Hi ${booking.customer_name},`,
      "",
      "Thanks for booking with us. We'll confirm your appointment shortly.",
      ...bookingSummary(booking),
      "",
      `Need to change something? Reply to this email or call us.`,
    ]);
    await send(notify, `New booking: ${booking.customer_name} on ${booking.booking_date}`, [
      ...bookingSummary(booking),
      `Customer: ${booking.customer_name} · ${booking.customer_phone}${booking.customer_email ? ` · ${booking.customer_email}` : ""}`,
      booking.customer_note ? `Note: ${booking.customer_note}` : "",
      "",
      `Manage it at ${config.appUrl}/admin/bookings`,
    ]);
  });
}

const bookingStatusText: Record<string, string> = {
  confirmed: "Your appointment is confirmed. See you soon!",
  cancelled: "Your appointment has been cancelled.",
  rejected: "Unfortunately we can't take this appointment. Please book another time.",
  completed: "Thanks for visiting us. We'd love a review of your experience.",
};

export function notifyBookingStatus(bookingId: string) {
  background(async () => {
    const booking = await loadBooking(bookingId);
    const message = booking && bookingStatusText[booking.status];
    if (!booking || !message) return;
    const { name } = await studio();
    await send(booking.customer_email, `Your booking at ${name} is ${booking.status}`, [
      `Hi ${booking.customer_name},`,
      "",
      message,
      ...bookingSummary(booking),
    ]);
  });
}

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_method: string;
  delivery_address: string | null;
  payment_method: string;
  order_status: string;
  total: number;
};

async function loadOrder(id: string) {
  const order = await queryOne<OrderRow>("SELECT * FROM orders WHERE id = $1", [id]);
  const items = await query<{ product_name: string; quantity: number; total_price: number }>(
    "SELECT product_name, quantity, total_price FROM order_items WHERE order_id = $1 ORDER BY created_at",
    [id],
  );
  return order ? { order, items } : null;
}

function paymentInstructions(
  method: string,
  payments: Awaited<ReturnType<typeof getSettings>>["payments"],
  orderNumber: string,
) {
  if (method === "mobile_money" && payments.mobile_money_number) {
    return [
      `Pay by mobile money to ${payments.mobile_money_number}${payments.mobile_money_name ? ` (${payments.mobile_money_name})` : ""}.`,
      `Use ${orderNumber} as the reference, then add the transaction ID on your order page.`,
    ];
  }
  if (method === "bank_transfer" && payments.bank_details) {
    return [
      "Pay by bank transfer to:",
      payments.bank_details,
      `Use ${orderNumber} as the reference.`,
    ];
  }
  return [];
}

export function notifyOrderPlaced(orderId: string) {
  background(async () => {
    const loaded = await loadOrder(orderId);
    if (!loaded) return;
    const { order, items } = loaded;
    const { name, notify, currency, settings } = await studio();
    const lines = items.map(
      (item) => `${item.quantity} x ${item.product_name}: ${money(item.total_price, currency)}`,
    );
    await send(order.customer_email, `Order ${order.order_number} received`, [
      `Hi ${order.customer_name},`,
      "",
      `Thanks for your order from ${name}.`,
      ...lines,
      `Total: ${money(order.total, currency)}`,
      "",
      ...paymentInstructions(order.payment_method, settings.payments, order.order_number),
      `Track it at ${config.appUrl}/account/orders/${order.id}`,
    ]);
    await send(notify, `New order ${order.order_number} (${money(order.total, currency)})`, [
      `Customer: ${order.customer_name} · ${order.customer_phone}`,
      `${order.delivery_method === "pickup" ? "Pickup" : `Delivery to: ${order.delivery_address ?? ""}`}`,
      `Payment: ${order.payment_method.replaceAll("_", " ")}`,
      ...lines,
      "",
      `Manage it at ${config.appUrl}/admin/orders`,
    ]);
  });
}

const orderStatusText: Record<string, string> = {
  processing: "We're preparing your order.",
  shipped: "Your order is on its way.",
  delivered: "Your order has been delivered. Enjoy!",
  cancelled: "Your order has been cancelled. Contact us if you have questions.",
};

export function notifyOrderStatus(orderId: string) {
  background(async () => {
    const loaded = await loadOrder(orderId);
    const message = loaded && orderStatusText[loaded.order.order_status];
    if (!loaded || !message) return;
    const { order } = loaded;
    await send(order.customer_email, `Order ${order.order_number}: ${order.order_status}`, [
      `Hi ${order.customer_name},`,
      "",
      message,
      `Details: ${config.appUrl}/account/orders/${order.id}`,
    ]);
  });
}

export function notifyPaymentReference(orderId: string) {
  background(async () => {
    const order = await queryOne<{ order_number: string; payment_reference: string | null }>(
      "SELECT order_number, payment_reference FROM orders WHERE id = $1",
      [orderId],
    );
    if (!order?.payment_reference) return;
    const { notify } = await studio();
    await send(notify, `Payment reference for ${order.order_number}`, [
      `The customer reported payment reference: ${order.payment_reference}`,
      `Verify it, then mark the order as paid at ${config.appUrl}/admin/orders`,
    ]);
  });
}
