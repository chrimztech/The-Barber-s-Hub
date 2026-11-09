import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { query } from "../db/pool.js";

/** Uploads younger than this are kept even if unused (the admin may still be editing). */
const GRACE_MS = 60 * 60 * 1000;
const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;

/** Relative upload paths ("products/abc.png") still referenced by any record. */
async function referencedUploads() {
  const rows = await query<{ url: string }>(`
    SELECT image_url AS url FROM services WHERE image_url IS NOT NULL
    UNION SELECT jsonb_array_elements_text(gallery_images) FROM services
    UNION SELECT image_url FROM products WHERE image_url IS NOT NULL
    UNION SELECT jsonb_array_elements_text(gallery_images) FROM products
    UNION SELECT image_url FROM service_categories WHERE image_url IS NOT NULL
    UNION SELECT image_url FROM product_categories WHERE image_url IS NOT NULL
    UNION SELECT photo_url FROM barbers WHERE photo_url IS NOT NULL
  `);
  const used = new Set<string>();
  for (const { url } of rows) {
    // Match on the path after /uploads/ so a changed PUBLIC_API_URL doesn't matter.
    const index = url.indexOf("/uploads/");
    if (index >= 0) used.add(decodeURIComponent(url.slice(index + "/uploads/".length)));
  }
  return used;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

/** Deletes uploaded images that no record points to any more. Returns the count removed. */
export async function sweepUnusedUploads(uploadRoot: string, graceMs = GRACE_MS) {
  const used = await referencedUploads();
  const cutoff = Date.now() - graceMs;
  let removed = 0;
  for await (const file of walk(uploadRoot)) {
    const relative = path.relative(uploadRoot, file).split(path.sep).join("/");
    if (used.has(relative)) continue;
    const info = await stat(file).catch(() => null);
    if (!info || info.mtimeMs > cutoff) continue;
    await rm(file, { force: true });
    removed++;
  }
  if (removed) console.log(`[uploads] removed ${removed} unused image(s)`);
  return removed;
}

/** Runs the sweep shortly after start-up and then every few hours. */
export function scheduleUploadSweeps(uploadRoot: string) {
  const run = () =>
    sweepUnusedUploads(uploadRoot).catch((error) =>
      console.error("[uploads] cleanup failed", error),
    );
  setTimeout(run, 60_000).unref();
  setInterval(run, SWEEP_EVERY_MS).unref();
}
