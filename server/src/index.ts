import { config } from "./config.js";
import { createApp } from "./app.js";
import { pool } from "./db/pool.js";
import { scheduleUploadSweeps } from "./lib/uploadsCleanup.js";
import { uploadRoot } from "./routes/uploads.js";

const app = createApp();
scheduleUploadSweeps(uploadRoot);
const server = app.listen(config.PORT, () => {
  console.log(`[api] listening on ${config.publicApiUrl} (${config.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
