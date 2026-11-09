import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { queryOne } from "../db/pool.js";
import { optionalAuth } from "../lib/auth.js";
import { asyncHandler, parse } from "../lib/http.js";
import { optionalEmail, optionalText, requiredText } from "../lib/validation.js";

export const contactRouter = Router();

const schema = z.object({
  name: requiredText(2, 80, "Name"),
  email: optionalEmail,
  phone: optionalText(30),
  subject: requiredText(3, 120, "Subject"),
  message: requiredText(10, 1000, "Message"),
});

contactRouter.post(
  "/",
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many messages. Please call or email us instead." },
  }),
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = parse(schema, req.body);
    const message = await queryOne(
      `INSERT INTO contact_messages (user_id, name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [req.user?.id ?? null, body.name, body.email, body.phone, body.subject, body.message],
    );
    res.status(201).json(message);
  }),
);
