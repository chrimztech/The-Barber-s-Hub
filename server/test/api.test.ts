import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN, captureMail, nextWeekday, PNG_1PX, startTestApi, type Api } from "./helpers.js";

let ctx: Awaited<ReturnType<typeof startTestApi>>;
let api: Api;
let A: string; // admin token
let C: string; // customer token
let customerId: string;
const mail = captureMail();

const ids: Record<string, string> = {};

before(async () => {
  ctx = await startTestApi();
  api = ctx.api;
});
after(async () => {
  mail.restore();
  await ctx.stop();
});

describe("auth", () => {
  test("admin can sign in; bad password is rejected", async () => {
    const ok = await api.post("/auth/login", ADMIN);
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.isAdmin, true);
    assert.equal(ok.data.user.token_version, undefined, "session internals are not exposed");
    A = ok.data.token;
    const bad = await api.post("/auth/login", { ...ADMIN, password: "wrong" });
    assert.equal(bad.status, 401);
  });

  test("register normalises email and blocks duplicates", async () => {
    const reg = await api.post("/auth/register", {
      email: "Cust@Test.local",
      password: "CustPass123",
      full_name: "Cee Customer",
      phone: "0971234567",
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.email, "cust@test.local");
    assert.equal(reg.data.user.isAdmin, false);
    C = reg.data.token;
    customerId = reg.data.user.id;
    const dup = await api.post("/auth/register", {
      email: "cust@test.local",
      password: "CustPass123",
      full_name: "Dup",
    });
    assert.equal(dup.status, 409);
  });

  test("protected routes need the right token", async () => {
    assert.equal((await api.get("/admin/stats")).status, 401);
    assert.equal((await api.get("/admin/stats", C)).status, 403);
    assert.equal((await api.get("/auth/me", "garbage")).status, 401);
    assert.equal((await api.get("/auth/me", C)).data.user.full_name, "Cee Customer");
  });

  test("changing password signs out other sessions and keeps this one", async () => {
    const other = (
      await api.post("/auth/login", { email: "cust@test.local", password: "CustPass123" })
    ).data.token;
    const wrong = await api.post(
      "/auth/change-password",
      { password: "NewPass1234", current_password: "nope" },
      C,
    );
    assert.equal(wrong.status, 400, "current password is verified");
    const changed = await api.post(
      "/auth/change-password",
      { password: "NewPass1234", current_password: "CustPass123" },
      C,
    );
    assert.equal(changed.status, 200);
    assert.equal((await api.get("/auth/me", other)).status, 401, "other device signed out");
    assert.equal((await api.get("/auth/me", C)).status, 401, "old token on this device too");
    C = changed.data.token;
    assert.equal((await api.get("/auth/me", C)).status, 200, "fresh token works");
  });

  test("password reset link works once and revokes old sessions", async () => {
    const before = C;
    await api.post("/auth/forgot-password", { email: "cust@test.local" });
    assert.ok(await mail.waitFor(/reset\?token=/));
    const link = mail.lines.find((line) => line.includes("reset?token="))!;
    const token = /token=([a-f0-9]+)/.exec(link)![1];
    const reset = await api.post("/auth/reset-password", { token, password: "ResetPass999" });
    assert.equal(reset.status, 200);
    assert.equal(
      (await api.post("/auth/reset-password", { token, password: "Again12345" })).status,
      400,
    );
    assert.equal((await api.get("/auth/me", before)).status, 401);
    C = reset.data.token;
    const login = await api.post("/auth/login", {
      email: "cust@test.local",
      password: "ResetPass999",
    });
    assert.equal(login.status, 200);
  });

  test("Google sign-in is hidden until configured", async () => {
    assert.deepEqual((await api.get("/auth/providers")).data, { google: false });
    assert.equal((await api.get("/auth/google")).status, 404);
  });
});

describe("catalogue (admin + public)", () => {
  test("admin creates categories, services, products, barbers", async () => {
    const sc = await api.post("/admin/categories/service", { name: "Cuts", slug: "cuts" }, A);
    const pc = await api.post(
      "/admin/categories/product",
      { name: "Clippers", slug: "clippers", image_url: "" },
      A,
    );
    assert.equal(sc.status, 201);
    assert.equal(pc.status, 201);
    ids.serviceCategory = sc.data.id;
    ids.productCategory = pc.data.id;

    const svc = await api.post(
      "/admin/services",
      {
        name: "Skin Fade",
        slug: "skin-fade",
        price: 120,
        duration: 45,
        category_id: sc.data.id,
        is_featured: true,
        gallery_images: [],
      },
      A,
    );
    assert.equal(svc.status, 201);
    assert.equal(svc.data.price, 120);
    ids.service = svc.data.id;

    assert.equal(
      (
        await api.post(
          "/admin/services",
          { name: "Dup", slug: "skin-fade", price: 1, duration: 10 },
          A,
        )
      ).status,
      409,
    );
    assert.equal(
      (await api.post("/admin/services", { name: "X", slug: "x", price: -1, duration: 10 }, A))
        .status,
      400,
    );

    const prod = await api.post(
      "/admin/products",
      {
        name: "Pro Clipper",
        slug: "pro-clipper",
        brand: "Wahl",
        price: 900,
        discount_price: 750,
        stock_quantity: 3,
        category_id: pc.data.id,
        is_featured: true,
        gallery_images: [],
        specifications: { Weight: "300g" },
      },
      A,
    );
    assert.equal(prod.status, 201);
    assert.equal(prod.data.specifications.Weight, "300g");
    ids.product = prod.data.id;
    assert.equal(
      (
        await api.post(
          "/admin/products",
          { name: "Y", slug: "y", price: 10, discount_price: 20, stock_quantity: 1 },
          A,
        )
      ).status,
      400,
    );

    const barber = await api.post("/admin/barbers", { name: "Ben", specialty: "Fades" }, A);
    assert.equal(barber.status, 201);
    ids.barber = barber.data.id;
  });

  test("public endpoints show active items with category names", async () => {
    const featured = await api.get("/services?featured=true&limit=4");
    assert.equal(featured.data.length, 1);
    assert.equal(featured.data[0].service_categories.name, "Cuts");
    assert.equal((await api.get("/services/skin-fade")).status, 200);
    assert.equal((await api.get("/services/nope")).status, 404);
    const products = await api.get("/products");
    assert.equal(products.data[0].product_categories.name, "Clippers");
    assert.equal((await api.get("/barbers")).data.length, 1);
    const settings = await api.get("/settings");
    assert.equal(settings.data.commerce.delivery_fee, 15);
    assert.equal(settings.data.booking.hours.mon, null, "closed Mondays by default");
    assert.ok(settings.data.payments.mobile_money_number);
  });
});

describe("bookings", () => {
  test("availability lists slots within opening hours", async () => {
    const tuesday = await nextWeekday(2);
    const res = await api.get(`/bookings/availability?date=${tuesday}&service_id=${ids.service}`);
    assert.equal(res.data.open, true);
    // 09:00–20:00, hourly, 45-minute service → 09:00 … 19:00
    assert.equal(res.data.slots[0].time, "09:00");
    assert.equal(res.data.slots.at(-1).time, "19:00");
    assert.ok(res.data.slots.every((slot: { available: boolean }) => slot.available));
    const monday = await nextWeekday(1);
    const closed = await api.get(`/bookings/availability?date=${monday}`);
    assert.equal(closed.data.open, false);
    assert.equal(closed.data.slots.length, 0);
  });

  test("booking rules: hours, closed days, past dates, capacity", async () => {
    const tuesday = await nextWeekday(2);
    const base = {
      service_id: ids.service,
      barber_id: "",
      customer_name: "Guest",
      customer_email: "",
      customer_phone: "0970000000",
      booking_date: tuesday,
      booking_time: "10:00",
    };
    const first = await api.post("/bookings", base);
    assert.equal(first.status, 201);
    assert.equal(first.data.user_id, null);
    ids.guestBooking = first.data.id;

    assert.equal(
      (await api.post("/bookings", base, C)).status,
      409,
      "one barber = one booking per slot",
    );
    const full = await api.get(`/bookings/availability?date=${tuesday}&service_id=${ids.service}`);
    assert.equal(
      full.data.slots.find((s: { time: string }) => s.time === "10:00").available,
      false,
    );

    const late = await api.post("/bookings", { ...base, booking_time: "19:30" });
    assert.equal(late.status, 400, "45 min from 19:30 runs past 20:00 closing");
    const early = await api.post("/bookings", { ...base, booking_time: "07:00" });
    assert.equal(early.status, 400);
    const monday = await api.post("/bookings", { ...base, booking_date: await nextWeekday(1) });
    assert.equal(monday.status, 400);
    assert.match(monday.data.error, /closed/);
    assert.equal(
      (await api.post("/bookings", { ...base, booking_date: "2020-01-07" })).status,
      400,
    );

    const mine = await api.post(
      "/bookings",
      { ...base, booking_time: "11:00", barber_id: ids.barber },
      C,
    );
    assert.equal(mine.status, 201);
    assert.equal(mine.data.user_id, customerId);
    assert.equal(mine.data.customer_email, "cust@test.local", "falls back to the account email");
    ids.customerBooking = mine.data.id;
  });

  test("booking emails go to the customer and the studio", async () => {
    assert.ok(await mail.waitFor(/would send to studio@test\.local[\s\S]*New booking/));
    assert.ok(await mail.waitFor(/would send to cust@test\.local[\s\S]*received your booking/));
  });

  test("customers see and cancel only their own bookings", async () => {
    const mine = await api.get("/me/bookings", C);
    assert.equal(mine.data.length, 1);
    assert.equal(mine.data[0].services.name, "Skin Fade");
    assert.equal(mine.data[0].barbers.name, "Ben");
    assert.equal((await api.post(`/me/bookings/${ids.guestBooking}/cancel`, {}, C)).status, 404);
    const cancel = await api.post(`/me/bookings/${ids.customerBooking}/cancel`, {}, C);
    assert.equal(cancel.data.status, "cancelled");
  });

  test("admin updates a booking and the customer is emailed", async () => {
    const res = await api.patch(
      `/admin/bookings/${ids.guestBooking}`,
      { status: "confirmed", barber_id: ids.barber, admin_note: "VIP" },
      A,
    );
    assert.equal(res.data.status, "confirmed");
    assert.equal(res.data.barber_id, ids.barber);
  });
});

describe("orders & payments", () => {
  const order = {
    customer_name: "Cee",
    customer_email: "",
    customer_phone: "0971234567",
    delivery_address: "Plot 1, Lusaka",
    delivery_method: "delivery",
    payment_method: "mobile_money",
    order_note: "",
  };

  test("prices and stock are enforced server-side", async () => {
    assert.equal((await api.post("/orders", { ...order, items: [] })).status, 401);
    const placed = await api.post(
      "/orders",
      { ...order, items: [{ product_id: ids.product, quantity: 2 }] },
      C,
    );
    assert.equal(placed.status, 201);
    assert.equal(placed.data.total, 2 * 750 + 15);
    ids.order = placed.data.id;
    const tooMany = await api.post(
      "/orders",
      { ...order, items: [{ product_id: ids.product, quantity: 2 }] },
      C,
    );
    assert.equal(tooMany.status, 409);
    assert.match(tooMany.data.error, /Only 1/);
    assert.equal(
      (
        await api.post(
          "/orders",
          { ...order, delivery_address: "", items: [{ product_id: ids.product, quantity: 1 }] },
          C,
        )
      ).status,
      400,
    );
    assert.equal((await api.get("/products/pro-clipper")).data.stock_quantity, 1);
    assert.ok(await mail.waitFor(/New order ORD-/));
  });

  test("customer adds a payment reference; cash orders can't", async () => {
    const ref = await api.post(
      `/me/orders/${ids.order}/payment-reference`,
      { reference: "MP240101.1234" },
      C,
    );
    assert.equal(ref.status, 200);
    assert.equal(ref.data.payment_reference, "MP240101.1234");
    const detail = await api.get(`/me/orders/${ids.order}`, C);
    assert.equal(detail.data.items[0].unit_price, 750);
    const cash = await api.post(
      "/orders",
      {
        ...order,
        payment_method: "cash_on_delivery",
        items: [{ product_id: ids.product, quantity: 1 }],
      },
      C,
    );
    assert.equal(
      (await api.post(`/me/orders/${cash.data.id}/payment-reference`, { reference: "ABC123" }, C))
        .status,
      400,
    );
    ids.cashOrder = cash.data.id;
  });

  test("cancelling returns stock; reopening needs stock", async () => {
    const cancel = await api.patch(
      `/admin/orders/${ids.order}`,
      { order_status: "cancelled", payment_status: "refunded" },
      A,
    );
    assert.equal(cancel.data.order_status, "cancelled");
    assert.equal((await api.get("/products/pro-clipper")).data.stock_quantity, 2);
    // Sell the remaining stock, then try to reopen the cancelled order of 2.
    await api.post("/orders", { ...order, items: [{ product_id: ids.product, quantity: 2 }] }, C);
    const reopen = await api.patch(`/admin/orders/${ids.order}`, { order_status: "pending" }, A);
    assert.equal(reopen.status, 409);
    assert.equal((await api.get("/products/pro-clipper")).data.stock_quantity, 0);
  });
});

describe("reviews & enquiries", () => {
  test("reviews are moderated before they're public", async () => {
    const review = await api.post(
      "/reviews",
      { rating: 5, comment: "Great clipper", product_id: ids.product },
      C,
    );
    assert.equal(review.data.status, "pending");
    assert.equal((await api.get(`/reviews?product_id=${ids.product}`)).data.length, 0);
    await api.patch(`/admin/reviews/${review.data.id}`, { status: "approved" }, A);
    assert.equal((await api.get(`/reviews?product_id=${ids.product}`)).data.length, 1);
    assert.equal((await api.get("/me/reviews", C)).data[0].products.name, "Pro Clipper");
    assert.equal((await api.del(`/me/reviews/${review.data.id}`, C)).status, 204);
  });

  test("contact form reaches the admin inbox", async () => {
    const sent = await api.post("/contact", {
      name: "Visitor",
      subject: "Hours?",
      message: "Are you open on Monday?",
    });
    assert.equal(sent.status, 201);
    const inbox = await api.get("/admin/messages", A);
    assert.equal(inbox.data[0].status, "unread");
    const updated = await api.patch(
      `/admin/messages/${inbox.data[0].id}`,
      { status: "replied", admin_note: "Called back" },
      A,
    );
    assert.equal(updated.data.admin_note, "Called back");
  });
});

describe("admin", () => {
  test("stats and customer list with activity counts", async () => {
    const stats = await api.get("/admin/stats", A);
    assert.equal(stats.data.services, 1);
    assert.equal(stats.data.customers, 2);
    const customers = await api.get("/admin/customers", A);
    const customer = customers.data.find((c: { email: string }) => c.email === "cust@test.local");
    assert.equal(customer.booking_count, 1);
    assert.equal(customer.isAdmin, false);
  });

  test("suspending a customer signs them out and blocks orders", async () => {
    const admin = (await api.get("/auth/me", A)).data.user;
    assert.equal(
      (await api.patch(`/admin/customers/${admin.id}`, { isAdmin: false }, A)).status,
      400,
    );
    const suspend = await api.patch(`/admin/customers/${customerId}`, { status: "suspended" }, A);
    assert.equal(suspend.data.status, "suspended");
    assert.equal((await api.get("/auth/me", C)).status, 401, "existing session revoked");
    C = (await api.post("/auth/login", { email: "cust@test.local", password: "ResetPass999" })).data
      .token;
    const blocked = await api.post(
      "/orders",
      {
        customer_name: "Cee",
        customer_phone: "0971234567",
        delivery_method: "pickup",
        payment_method: "cash_on_delivery",
        items: [{ product_id: ids.product, quantity: 1 }],
      },
      C,
    );
    assert.equal(blocked.status, 403);
    await api.patch(`/admin/customers/${customerId}`, { status: "active" }, A);
  });

  test("settings save booking hours and payment details", async () => {
    const current = (await api.get("/settings")).data;
    const saved = await api.put(
      "/admin/settings",
      {
        business: current.business,
        commerce: { ...current.commerce, delivery_fee: 20 },
        booking: {
          slot_minutes: 30,
          hours: { ...current.booking.hours, mon: { open: "10:00", close: "12:00" } },
        },
        payments: {
          mobile_money_number: "+260970000000",
          mobile_money_name: "Deepcuts",
          bank_details: "Zanaco 123",
        },
      },
      A,
    );
    assert.equal(saved.status, 200);
    const after = (await api.get("/settings")).data;
    assert.equal(after.commerce.delivery_fee, 20);
    assert.equal(after.payments.bank_details, "Zanaco 123");
    const monday = await api.get(`/bookings/availability?date=${await nextWeekday(1)}`);
    assert.deepEqual(
      monday.data.slots.map((s: { time: string }) => s.time),
      ["10:00", "10:30", "11:00", "11:30"],
    );
    const bad = await api.put(
      "/admin/settings",
      {
        ...after,
        booking: {
          slot_minutes: 30,
          hours: { ...after.booking.hours, tue: { open: "18:00", close: "09:00" } },
        },
      },
      A,
    );
    assert.equal(bad.status, 400);
  });

  test("uploads are stored, served, and cleaned up when unused", async () => {
    const upload = async (folder: string) => {
      const form = new FormData();
      form.append("folder", folder);
      form.append("file", new Blob([PNG_1PX], { type: "image/png" }), "x.png");
      return api.call("POST", "/admin/uploads", { token: A, form });
    };
    const used = await upload("services");
    const unused = await upload("products/gallery");
    assert.equal(used.status, 201);
    const image = await fetch(used.data.url);
    assert.equal(image.headers.get("content-type"), "image/png");

    const svc = (await api.get("/admin/services", A)).data[0];
    await api.put(`/admin/services/${svc.id}`, { ...svc, image_url: used.data.url }, A);

    const { sweepUnusedUploads } = await import("../src/lib/uploadsCleanup.js");
    const removed = await sweepUnusedUploads(ctx.uploadDir, 0);
    assert.equal(removed, 1);
    assert.equal((await fetch(used.data.url)).status, 200, "referenced image kept");
    assert.equal((await fetch(unused.data.url)).status, 404, "orphan removed");

    const form = new FormData();
    form.append("folder", "../../etc");
    form.append("file", new Blob(["hello"], { type: "text/plain" }), "x.txt");
    assert.equal((await api.call("POST", "/admin/uploads", { token: A, form })).status, 400);
  });

  test("unknown routes 404", async () => {
    assert.equal((await api.get("/nope")).status, 404);
  });
});
