import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { queryOne, type Db } from "../db/pool.js";
import { forbidden, unauthorized } from "./http.js";

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  isAdmin: boolean;
  /** False for Google-only accounts that haven't set a password yet. */
  hasPassword: boolean;
  token_version: number;
};

/** The user as returned to the browser (session internals removed). */
export function publicUser(user: AuthUser | null) {
  if (!user) return null;
  const { token_version: _version, ...rest } = user;
  return rest;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Response body for every endpoint that starts a session. */
export async function sessionResponse(userId: string, db?: Db) {
  return { token: await issueToken(userId, db), user: publicUser(await loadUser(userId, db)) };
}

/** Issues a session token bound to the user's current token_version. */
export async function issueToken(userId: string, db?: Db) {
  const row = await queryOne<{ token_version: number }>(
    "SELECT token_version FROM users WHERE id = $1",
    [userId],
    db,
  );
  return jwt.sign({ sub: userId, v: row?.token_version ?? 0 }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

/** Invalidates every session the user has open. */
export async function revokeSessions(userId: string, db?: Db) {
  await queryOne("UPDATE users SET token_version = token_version + 1 WHERE id = $1", [userId], db);
}

export async function loadUser(userId: string, db?: Db): Promise<AuthUser | null> {
  return queryOne<AuthUser>(
    `SELECT u.id, u.email, p.full_name, p.phone, COALESCE(p.status, 'active') AS status,
            EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin') AS "isAdmin",
            u.password_hash IS NOT NULL AS "hasPassword",
            u.token_version
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = $1`,
    [userId],
    db,
  );
}

async function resolveUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch {
    throw unauthorized("Your session has expired. Please sign in again.");
  }
  const userId = typeof payload === "object" ? payload.sub : undefined;
  if (!userId || typeof payload !== "object") throw unauthorized("Invalid session");
  const user = await loadUser(userId);
  if (!user) throw unauthorized("Account no longer exists");
  if ((payload.v ?? 0) !== user.token_version) {
    throw unauthorized("You were signed out. Please sign in again.");
  }
  return user;
}

/** Attaches req.user when a valid token is present; anonymous requests pass through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  resolveUser(req)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(next);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  resolveUser(req)
    .then((user) => {
      if (!user) return next(unauthorized());
      req.user = user;
      next();
    })
    .catch(next);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (!req.user?.isAdmin) return next(forbidden("Administrator access required"));
    next();
  });
}

/** Throws when a suspended account tries to create bookings, orders, or reviews. */
export function assertActive(user: AuthUser | undefined, action: string) {
  if (user && user.status !== "active") {
    throw forbidden(`This account is not permitted to ${action}`);
  }
}

/** Returns req.user, throwing if the route forgot requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
