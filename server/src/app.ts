import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { errorHandler, notFound } from "./lib/http.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { catalogRouter } from "./routes/catalog.js";
import { contactRouter } from "./routes/contact.js";
import { meRouter } from "./routes/me.js";
import { ordersRouter } from "./routes/orders.js";
import { uploadRoot } from "./routes/uploads.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Images are embedded by the storefront on another origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes("*")) {
          return callback(null, true);
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/uploads", express.static(uploadRoot, { maxAge: "30d", immutable: true, index: false }));

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "database unavailable" });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/contact", contactRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", catalogRouter);

  app.use((_req, _res, next) => next(notFound("Route not found")));
  app.use(errorHandler);
  return app;
}
