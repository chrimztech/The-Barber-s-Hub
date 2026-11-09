import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { withTransaction, queryOne, query } from "../db/pool.js";
import {
  currentUser,
  hashPassword,
  publicUser,
  requireAuth,
  revokeSessions,
  sessionResponse,
  verifyPassword,
} from "../lib/auth.js";
import { asyncHandler, badRequest, conflict, notFound, parse, unauthorized } from "../lib/http.js";
import { hashToken, sendPasswordReset } from "../lib/passwordReset.js";
import { email, optionalText, password, requiredText } from "../lib/validation.js";

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});
authRouter.use(["/login", "/register", "/forgot-password", "/reset-password"], limiter);

const googleEnabled = () => !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);

authRouter.get("/providers", (_req, res) => {
  res.json({ google: googleEnabled() });
});

/** Creates a customer account (profile + role) inside an open transaction. */
async function createAccount(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: { id: string }[] }> },
  input: {
    email: string;
    passwordHash: string | null;
    fullName: string | null;
    phone: string | null;
    googleId?: string;
  },
) {
  const created = await client.query(
    "INSERT INTO users (email, password_hash, google_id) VALUES ($1, $2, $3) RETURNING id",
    [input.email, input.passwordHash, input.googleId ?? null],
  );
  const id = created.rows[0].id;
  await client.query("INSERT INTO profiles (id, full_name, email, phone) VALUES ($1, $2, $3, $4)", [
    id,
    input.fullName,
    input.email,
    input.phone,
  ]);
  await client.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'customer')", [id]);
  return id;
}

const registerSchema = z.object({
  email,
  password,
  full_name: requiredText(2, 80, "Full name"),
  phone: optionalText(30),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = parse(registerSchema, req.body);
    const passwordHash = await hashPassword(body.password);
    const userId = await withTransaction(async (client) => {
      const taken = await client.query("SELECT 1 FROM users WHERE email = $1", [body.email]);
      if (taken.rowCount) throw conflict("An account with this email already exists");
      return createAccount(client, {
        email: body.email,
        passwordHash,
        fullName: body.full_name,
        phone: body.phone,
      });
    });
    res.status(201).json(await sessionResponse(userId));
  }),
);

const dummyHash = hashPassword("timing-safe-placeholder");

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const account = await queryOne<{ id: string; password_hash: string | null }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [body.email],
    );
    // Compare against a dummy hash when there's no password to keep timing uniform.
    const valid = await verifyPassword(body.password, account?.password_hash ?? (await dummyHash));
    if (!account || !account.password_hash || !valid) {
      throw unauthorized(
        account && !account.password_hash
          ? "This account uses Google sign-in. Continue with Google, or reset your password to set one."
          : "Invalid email or password",
      );
    }
    res.json(await sessionResponse(account.id));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(currentUser(req)) });
  }),
);

authRouter.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ email }), req.body);
    await sendPasswordReset(body.email);
    res.json({ message: "If that email has an account, a reset link is on its way." });
  }),
);

authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(32).max(200), password }), req.body);
    const userId = await withTransaction(async (client) => {
      const found = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM password_reset_tokens
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          FOR UPDATE`,
        [hashToken(body.token)],
      );
      const token = found.rows[0];
      if (!token) throw badRequest("This reset link is invalid or has expired");
      // Bumping token_version signs out every other session, e.g. an attacker's.
      await client.query(
        "UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2",
        [await hashPassword(body.password), token.user_id],
      );
      await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [
        token.id,
      ]);
      return token.user_id;
    });
    res.json(await sessionResponse(userId));
  }),
);

authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const body = parse(
      z.object({ password, current_password: z.string().max(200).optional() }),
      req.body,
    );
    if (user.hasPassword) {
      const row = await queryOne<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id = $1",
        [user.id],
      );
      const ok =
        !!body.current_password &&
        !!row &&
        (await verifyPassword(body.current_password, row.password_hash));
      if (!ok) throw badRequest("Your current password is incorrect");
    }
    await query(
      "UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2",
      [await hashPassword(body.password), user.id],
    );
    // Other devices are now signed out; this one gets a fresh token.
    res.json({ message: "Password updated", ...(await sessionResponse(user.id)) });
  }),
);

authRouter.post(
  "/logout-everywhere",
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSessions(currentUser(req).id);
    res.json({ message: "Signed out of every device" });
  }),
);

// Google sign-in --------------------------------------------------------------------

const STATE_COOKIE = "bh_oauth_state";
const callbackUrl = () => `${config.publicApiUrl}/api/auth/google/callback`;

/** Only allow same-site relative paths as the post-login destination. */
const safeRedirect = (value: unknown) =>
  typeof value === "string" && /^\/(?!\/)[\w\-./?=&%#]*$/.test(value) ? value : "/account";

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function appRedirect(params: Record<string, string>) {
  return `${config.appUrl}/auth/callback#${new URLSearchParams(params).toString()}`;
}

authRouter.get("/google", (req, res, next) => {
  if (!googleEnabled()) return next(notFound("Google sign-in is not configured"));
  const nonce = randomBytes(16).toString("hex");
  const state = jwt.sign({ n: nonce, r: safeRedirect(req.query.redirect) }, config.JWT_SECRET, {
    expiresIn: "10m",
  });
  res.cookie(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 10 * 60 * 1000,
    path: "/api/auth/google",
  });
  const params = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

type GoogleProfile = { sub: string; email?: string; email_verified?: boolean; name?: string };

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const fail = (message: string) => res.redirect(appRedirect({ error: message }));
    if (!googleEnabled()) return fail("Google sign-in is not configured");
    if (typeof req.query.error === "string") return fail("Google sign-in was cancelled");

    let redirectTo = "/account";
    try {
      const state = jwt.verify(String(req.query.state ?? ""), config.JWT_SECRET) as {
        n: string;
        r: string;
      };
      if (!state.n || state.n !== readCookie(req, STATE_COOKIE)) throw new Error("state");
      redirectTo = safeRedirect(state.r);
    } catch {
      return fail("Your sign-in session expired. Please try again.");
    }
    res.clearCookie(STATE_COOKIE, { path: "/api/auth/google" });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(req.query.code ?? ""),
        client_id: config.GOOGLE_CLIENT_ID!,
        client_secret: config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) return fail("Google sign-in failed. Please try again.");
    const { access_token } = (await tokenResponse.json()) as { access_token?: string };
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileResponse.ok) return fail("Couldn't read your Google profile.");
    const profile = (await profileResponse.json()) as GoogleProfile;
    if (!profile.email || !profile.email_verified) {
      return fail("Your Google account has no verified email address.");
    }
    const googleEmail = profile.email.toLowerCase();

    const userId = await withTransaction(async (client) => {
      const byGoogle = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE google_id = $1",
        [profile.sub],
      );
      if (byGoogle.rows[0]) return byGoogle.rows[0].id;
      // Google has verified the address, so it's safe to link an existing account.
      const byEmail = await client.query<{ id: string }>(
        "UPDATE users SET google_id = $1 WHERE email = $2 RETURNING id",
        [profile.sub, googleEmail],
      );
      if (byEmail.rows[0]) return byEmail.rows[0].id;
      return createAccount(client, {
        email: googleEmail,
        passwordHash: null,
        fullName: profile.name?.slice(0, 80) ?? null,
        phone: null,
        googleId: profile.sub,
      });
    });

    const session = await sessionResponse(userId);
    res.redirect(appRedirect({ token: session.token, redirect: redirectTo }));
  }),
);
