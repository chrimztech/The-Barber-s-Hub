import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { query, queryOne } from "../db/pool.js";
import { sendMail } from "./mailer.js";

const TOKEN_TTL_MINUTES = 60;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a single-use reset token and emails the link. Silently ignores unknown emails. */
export async function sendPasswordReset(email: string) {
  const user = await queryOne<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  await query(
    `UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [user.id],
  );
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, hashToken(token), TOKEN_TTL_MINUTES],
  );

  const link = `${config.appUrl}/auth/reset?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Deepcuts Hair Studio password",
    text: `We received a request to reset your password.\n\nChoose a new password here (valid for ${TOKEN_TTL_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<p>We received a request to reset your password.</p><p><a href="${link}">Choose a new password</a> (valid for ${TOKEN_TTL_MINUTES} minutes).</p><p>If you didn't ask for this, you can ignore this email.</p>`,
  });
}
