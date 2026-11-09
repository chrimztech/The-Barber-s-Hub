import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = "Authentication required") => new HttpError(401, message);
export const forbidden = (message = "You do not have permission to do that") =>
  new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler =
  <Req extends Request = Request>(
    handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

type PgError = { code?: string; constraint?: string; detail?: string };

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return res.status(400).json({
      error: field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid request"),
      issues: error.issues,
    });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    return res.status(400).json({ error: "Malformed JSON body" });
  }

  const pgError = error as PgError;
  if (pgError?.code === "23505") {
    const field = pgError.constraint?.includes("slug")
      ? "slug"
      : pgError.constraint?.includes("email")
        ? "email"
        : "value";
    return res.status(409).json({ error: `A record with that ${field} already exists` });
  }
  if (pgError?.code === "23503") {
    return res.status(409).json({ error: "This record is linked to other data" });
  }
  if (pgError?.code === "23514" || pgError?.code === "22P02" || pgError?.code === "22007") {
    return res.status(400).json({ error: "One or more values are invalid" });
  }

  console.error(error);
  return res.status(500).json({ error: "Something went wrong on our side" });
}
