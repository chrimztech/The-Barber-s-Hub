import { z } from "zod";

export const uuid = z.string().uuid("Invalid id");

/** Trimmed string; empty becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    });

export const requiredText = (min: number, max: number, label = "Value") =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .nullish()
  .transform((value) => (value ? value.toLowerCase() : null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, {
    message: "Enter a valid email",
  });

export const email = z.string().trim().toLowerCase().email("Enter a valid email").max(160);
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const nullableUuid = z
  .union([uuid, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const imageUrl = z
  .string()
  .trim()
  .url("Invalid image URL")
  .max(1000)
  .nullish()
  .or(z.literal(""));

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain letters, numbers, and dashes");

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use HH:MM")
  .transform((value) => value.slice(0, 5));

export const activeStatus = z.enum(["active", "inactive"]);
