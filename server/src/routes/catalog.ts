import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { assertActive, currentUser, requireAuth } from "../lib/auth.js";
import { asyncHandler, badRequest, notFound, parse } from "../lib/http.js";
import { getSettings } from "../lib/settings.js";
import { nestedName } from "../lib/sql.js";
import { optionalText, uuid } from "../lib/validation.js";

export const catalogRouter = Router();

const listQuery = z.object({
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category_id: uuid.optional(),
});

// Settings ---------------------------------------------------------------------

catalogRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);

// Services ---------------------------------------------------------------------

catalogRouter.get(
  "/services",
  asyncHandler(async (req, res) => {
    const filters = parse(listQuery, req.query);
    const params: unknown[] = [];
    const where = ["s.status = 'active'"];
    if (filters.featured) where.push("s.is_featured = true");
    if (filters.category_id) {
      params.push(filters.category_id);
      where.push(`s.category_id = $${params.length}`);
    }
    let sql = `SELECT s.*, ${nestedName("c")} AS service_categories
                 FROM services s LEFT JOIN service_categories c ON c.id = s.category_id
                WHERE ${where.join(" AND ")}
                ORDER BY s.name`;
    if (filters.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }
    res.json(await query(sql, params));
  }),
);

catalogRouter.get(
  "/services/:slug",
  asyncHandler(async (req, res) => {
    const service = await queryOne(
      `SELECT s.*, ${nestedName("c")} AS service_categories
         FROM services s LEFT JOIN service_categories c ON c.id = s.category_id
        WHERE s.slug = $1 AND s.status = 'active'`,
      [req.params.slug],
    );
    if (!service) throw notFound("Service not found");
    res.json(service);
  }),
);

catalogRouter.get(
  "/service-categories",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM service_categories WHERE status = 'active' ORDER BY name"));
  }),
);

// Products ---------------------------------------------------------------------

catalogRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    const filters = parse(listQuery, req.query);
    const params: unknown[] = [];
    const where = ["p.status = 'active'"];
    if (filters.featured) where.push("p.is_featured = true");
    if (filters.category_id) {
      params.push(filters.category_id);
      where.push(`p.category_id = $${params.length}`);
    }
    let sql = `SELECT p.*, ${nestedName("c")} AS product_categories
                 FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
                WHERE ${where.join(" AND ")}
                ORDER BY p.created_at DESC`;
    if (filters.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }
    res.json(await query(sql, params));
  }),
);

catalogRouter.get(
  "/products/:slug",
  asyncHandler(async (req, res) => {
    const product = await queryOne(
      `SELECT p.*, ${nestedName("c")} AS product_categories
         FROM products p LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.status = 'active'`,
      [req.params.slug],
    );
    if (!product) throw notFound("Product not found");
    res.json(product);
  }),
);

catalogRouter.get(
  "/product-categories",
  asyncHandler(async (_req, res) => {
    res.json(await query("SELECT * FROM product_categories WHERE status = 'active' ORDER BY name"));
  }),
);

// Barbers ----------------------------------------------------------------------

catalogRouter.get(
  "/barbers",
  asyncHandler(async (_req, res) => {
    res.json(
      await query(
        "SELECT id, name, photo_url, bio, specialty, status FROM barbers WHERE status = 'active' ORDER BY name",
      ),
    );
  }),
);

// Reviews ----------------------------------------------------------------------

const reviewTarget = z
  .object({ product_id: uuid.optional(), service_id: uuid.optional() })
  .refine((value) => !!value.product_id !== !!value.service_id, {
    message: "Provide exactly one of product_id or service_id",
  });

catalogRouter.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const target = parse(reviewTarget, req.query);
    const column = target.product_id ? "product_id" : "service_id";
    res.json(
      await query(
        `SELECT id, rating, comment, created_at FROM reviews
          WHERE status = 'approved' AND ${column} = $1
          ORDER BY created_at DESC`,
        [target.product_id ?? target.service_id],
      ),
    );
  }),
);

const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: optionalText(500),
    product_id: uuid.nullish(),
    service_id: uuid.nullish(),
  })
  .refine((value) => !!value.product_id !== !!value.service_id, {
    message: "Provide exactly one of product_id or service_id",
  });

catalogRouter.post(
  "/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    assertActive(user, "post reviews");
    const body = parse(reviewSchema, req.body);
    if (!body.comment || body.comment.length < 3) throw badRequest("Please add a short comment");
    const table = body.product_id ? "products" : "services";
    const targetId = body.product_id ?? body.service_id;
    const exists = await queryOne(`SELECT 1 FROM ${table} WHERE id = $1 AND status = 'active'`, [
      targetId,
    ]);
    if (!exists) throw notFound("That item is no longer available");
    const review = await queryOne(
      `INSERT INTO reviews (user_id, rating, comment, product_id, service_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [user.id, body.rating, body.comment, body.product_id ?? null, body.service_id ?? null],
    );
    res.status(201).json(review);
  }),
);
