import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { asyncHandler, badRequest } from "../lib/http.js";

export const uploadRoot = path.resolve(config.UPLOAD_DIR);
mkdirSync(uploadRoot, { recursive: true });

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Folder names like "products/gallery"; anything else falls back to "uploads". */
function safeFolder(value: unknown) {
  const folder = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(folder) && folder.length <= 60 ? folder : "uploads";
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => {
      const dir = path.join(uploadRoot, safeFolder(req.body?.folder));
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}.${extensions[file.mimetype]}`);
    },
  }),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (extensions[file.mimetype]) callback(null, true);
    else callback(badRequest("Please upload a JPEG, PNG, WebP, GIF, or AVIF image"));
  },
});

export const uploadRouter = Router();

// The client must send the "folder" field before the "file" field so multer sees it.
uploadRouter.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(
          badRequest(
            error.code === "LIMIT_FILE_SIZE"
              ? `Images must be ${config.MAX_UPLOAD_MB}MB or smaller`
              : error.message,
          ),
        );
      }
      next(error);
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("No image was uploaded");
    const relative = path.relative(uploadRoot, req.file.path).split(path.sep).join("/");
    res.status(201).json({ url: `${config.publicApiUrl}/uploads/${relative}` });
  }),
);
