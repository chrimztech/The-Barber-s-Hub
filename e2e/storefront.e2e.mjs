/**
 * End-to-end browser test of the storefront and admin dashboard.
 *
 * Needs the API and the site running, plus an admin account:
 *   npm run api:dev            (terminal 1)
 *   npm run dev                (terminal 2)
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 *
 * Optional: APP_URL (default http://localhost:8080), API_URL (default http://localhost:4000),
 * BROWSER_PATH (defaults to the installed Edge or Chrome), HEADED=1 to watch it run.
 * It creates its own uniquely named test data, so it is safe to run repeatedly.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = (process.env.APP_URL ?? "http://localhost:8080").replace(/\/$/, "");
const API = `${(process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")}/api`;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (an admin account on the running API).",
  );
  process.exit(1);
}

const browserPath =
  process.env.BROWSER_PATH ??
  [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((candidate) => existsSync(candidate));
if (!browserPath) {
  console.error("No Chrome or Edge found. Set BROWSER_PATH to a Chromium-based browser.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
};

async function api(method, path, body, token) {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${data?.error ?? response.status}`);
  return data;
}

// --- Test data -------------------------------------------------------------------
const run = Date.now().toString(36);
const { token: A } = await api("POST", "/auth/login", {
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
});
const category = await api(
  "POST",
  "/admin/categories/service",
  { name: `E2E Cuts ${run}`, slug: `e2e-cuts-${run}` },
  A,
);
const service = await api(
  "POST",
  "/admin/services",
  {
    name: `E2E Fade ${run}`,
    slug: `e2e-fade-${run}`,
    price: 120,
    duration: 45,
    category_id: category.id,
    gallery_images: [],
  },
  A,
);
const product = await api(
  "POST",
  "/admin/products",
  {
    name: `E2E Clipper ${run}`,
    slug: `e2e-clipper-${run}`,
    brand: "Wahl",
    price: 900,
    discount_price: 750,
    stock_quantity: 5,
    gallery_images: [],
    specifications: { Weight: "300g" },
  },
  A,
);
const barber = await api(
  "POST",
  "/admin/barbers",
  { name: `E2E Barber ${run}`, specialty: "Fades" },
  A,
);
const settings = await api("GET", "/settings");

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: !process.env.HEADED,
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("dialog", (dialog) => dialog.accept());

const seen = async (text, timeout = 30_000) =>
  page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false);
const open = async (path) => {
  await page.goto(APP + path);
  await page.waitForLoadState("networkidle");
};

try {
  // --- Public pages ----------------------------------------------------------------
  await open("/services");
  check("services list shows the new service", await seen(service.name, 90_000));
  await open(`/services/${service.slug}`);
  check("service detail page", await seen("Book this service"));
  await open(`/shop/${product.slug}`);
  check(
    "product detail page with specifications",
    (await seen("Add to cart")) && (await seen("300g")),
  );
  await open("/about");
  check("about page lists barbers", await seen(barber.name));
  await open("/contact");
  check("contact page shows business details", await seen(settings.business.business_name));

  // --- Register --------------------------------------------------------------------
  const email = `e2e-${run}@example.com`;
  await open("/auth");
  await page.getByRole("button", { name: "Create account" }).last().click();
  await page.locator("form input").nth(0).fill("E2E Customer");
  await page.locator('input[type="tel"]').fill("0975551234");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').nth(0).fill("E2ePass1234");
  await page.locator('input[type="password"]').nth(1).fill("E2ePass1234");
  await page.locator("form").getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/account", { timeout: 30_000 }).catch(() => {});
  check("registration signs in and opens the account", await seen("E2E Customer"));

  // --- Book (times come from live availability) ------------------------------------
  const tuesday = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  })();
  await open(`/book?service=${service.id}`);
  const selects = page.locator("form select");
  await selects.nth(1).selectOption({ label: barber.name });
  await page.locator('input[type="date"]').fill(tuesday);
  await page.waitForFunction(
    () => document.querySelectorAll("form select")[2]?.options.length > 1,
    null,
    {
      timeout: 30_000,
    },
  );
  const firstTime = await selects.nth(2).locator("option").nth(1).getAttribute("value");
  await selects.nth(2).selectOption(firstTime);
  check(
    "contact details pre-filled from the account",
    (await page.locator("form input").nth(1).inputValue()) === "E2E Customer",
  );
  await page.getByRole("button", { name: "Reserve appointment" }).click();
  check("booking is accepted", await seen("Booking received"));
  await page.waitForURL("**/account", { timeout: 15_000 }).catch(() => {});
  check("booking shows in the account", await seen(barber.name));

  // --- Cart & checkout with mobile money -------------------------------------------
  await open(`/shop/${product.slug}`);
  await page.getByRole("button", { name: /Add to cart/ }).click();
  check("added to cart", await seen("added to cart"));
  await open("/checkout");
  await page.locator("form textarea").first().fill("Plot 9, Chelstone, Lusaka");
  await page.locator("form select").nth(1).selectOption("mobile_money");
  check("checkout shows mobile money instructions", await seen("Send the total to"));
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL("**/account/orders/**", { timeout: 30_000 }).catch(() => {});
  check("order placed and order page opened", page.url().includes("/account/orders/"), page.url());
  const expected = 750 + Number(settings.commerce.delivery_fee);
  check(`order total is ${expected}`, await seen(expected.toFixed(2)));
  await page.locator("#payment-reference").fill(`MP-${run}`);
  await page.getByRole("button", { name: "Send" }).click();
  check("payment reference saved", await seen(`Reference: MP-${run}`));

  // --- Admin -----------------------------------------------------------------------
  await page.evaluate(() => localStorage.clear());
  await open("/auth");
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  check("admin signs in", await seen("Admin dashboard"));
  await open("/admin/bookings");
  check("admin sees the booking", await seen(barber.name));
  await open("/admin/orders");
  await page.getByTitle("View order").first().click();
  check("admin sees the customer's payment reference", await seen(`MP-${run}`));
  await page.keyboard.press("Escape");
  await open("/admin/customers");
  check("admin sees the new customer", await seen(email));
  await open("/admin/settings");
  check(
    "settings show booking hours and payment details",
    (await seen("Booking hours")) && (await seen("Payment details")),
  );
} finally {
  await browser.close();
  // Remove the catalogue test data (bookings and orders keep their history).
  await api("DELETE", `/admin/barbers/${barber.id}`, null, A).catch(() => {});
}

const relevant = consoleErrors.filter((text) => !/favicon|manifest|DevTools/i.test(text));
check("no browser console errors", relevant.length === 0, relevant.slice(0, 3).join(" | "));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
