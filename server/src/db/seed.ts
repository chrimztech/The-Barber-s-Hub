import { fileURLToPath } from "node:url";
import path from "node:path";
import { hashPassword } from "../lib/auth.js";
import { pool, withTransaction } from "./pool.js";

/**
 * Creates the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD, or promotes
 * that account to admin if it already exists. Safe to run repeatedly.
 */
export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Studio Admin";
  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin account");
    return;
  }
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    let userId = existing.rows[0]?.id;
    if (!userId) {
      const created = await client.query<{ id: string }>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email, await hashPassword(password)],
      );
      userId = created.rows[0].id;
      await client.query("INSERT INTO profiles (id, full_name, email) VALUES ($1, $2, $3)", [
        userId,
        name,
        email,
      ]);
      console.log(`[seed] created admin ${email}`);
    } else {
      console.log(`[seed] ${email} already exists; ensuring admin role`);
    }
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin'), ($1, 'customer')
       ON CONFLICT DO NOTHING`,
      [userId],
    );
  });
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  seedAdmin()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
