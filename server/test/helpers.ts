/**
 * Test harness: boots an in-memory Postgres (PGlite) behind a real socket, points the
 * API at it, runs migrations, seeds an admin, and starts the app on a random port.
 * Environment must be set before any src/ module is imported, because config is read
 * at import time, so src/ modules are loaded dynamically.
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type AddressInfo } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export const ADMIN = { email: "admin@test.local", password: "AdminPass123" };

/** Asks the OS for a free port. */
const randomPort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

export async function startPostgres() {
  const db = await PGlite.create();
  const port = await randomPort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  return {
    url: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    db,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}

export async function startTestApi() {
  const postgres = await startPostgres();
  const apiPort = await randomPort();
  const uploadDir = await mkdtemp(path.join(tmpdir(), "barbershub-uploads-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: postgres.url,
    DATABASE_SSL: "false",
    JWT_SECRET: "test-secret-test-secret-test-secret-0123456789",
    PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
    APP_URL: "http://localhost:8095",
    CORS_ORIGIN: "http://localhost:8095",
    UPLOAD_DIR: uploadDir,
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD: ADMIN.password,
    SMTP_HOST: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    STUDIO_NOTIFY_EMAIL: "studio@test.local",
  });

  const { migrate } = await import("../src/db/migrate.js");
  const { seedAdmin } = await import("../src/db/seed.js");
  const { createApp } = await import("../src/app.js");
  const { pool } = await import("../src/db/pool.js");
  await migrate();
  await seedAdmin();

  const server = createApp().listen(apiPort, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base,
    uploadDir,
    pool,
    api: client(`${base}/api`),
    stop: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await postgres.stop();
    },
  };
}

export type Api = ReturnType<typeof client>;

export function client(baseUrl: string) {
  async function call<T = any>(
    method: string,
    route: string,
    options: { token?: string; body?: unknown; form?: FormData } = {},
  ): Promise<{ status: number; data: T }> {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const response = await fetch(baseUrl + route, { method, headers, body, redirect: "manual" });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, data: data as T };
  }
  return {
    call,
    get: <T = any>(route: string, token?: string) => call<T>("GET", route, { token }),
    post: <T = any>(route: string, body?: unknown, token?: string) =>
      call<T>("POST", route, { body: body ?? {}, token }),
    put: <T = any>(route: string, body: unknown, token?: string) =>
      call<T>("PUT", route, { body, token }),
    patch: <T = any>(route: string, body: unknown, token?: string) =>
      call<T>("PATCH", route, { body, token }),
    del: <T = any>(route: string, token?: string) => call<T>("DELETE", route, { token }),
  };
}

/** Next date (studio time zone) falling on the given weekday, at least `minDays` ahead. */
export async function nextWeekday(day: number, minDays = 2) {
  const { studioNow } = await import("../src/lib/schedule.js");
  const today = new Date(`${studioNow().date}T00:00:00Z`);
  for (let offset = minDays; offset < minDays + 8; offset++) {
    const candidate = new Date(today.getTime() + offset * 86_400_000);
    if (candidate.getUTCDay() === day) return candidate.toISOString().slice(0, 10);
  }
  throw new Error("unreachable");
}

/** Captures "[mail]" log lines written while SMTP is not configured. */
export function captureMail() {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.startsWith("[mail]")) lines.push(text);
    else original(...args);
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
    waitFor: async (pattern: RegExp, timeout = 3000) => {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (lines.some((line) => pattern.test(line))) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    },
  };
}

export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
