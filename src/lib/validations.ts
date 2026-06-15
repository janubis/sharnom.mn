/**
 * Shared Zod schemas. Used by API route handlers, server actions, and
 * react-hook-form resolvers so client & server validate identically.
 */
import { z } from "zod";

import { LEAF_CATEGORY_SLUGS } from "@/lib/constants";

export const idSchema = z.string().uuid();

/* ── Search ──────────────────────────────────────────────────────────────── */
export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  price: z
    .string()
    .optional()
    .transform((v) =>
      v ? v.split(",").map(Number).filter((n) => n >= 1 && n <= 4) : undefined,
    ),
  openNow: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(100).optional(),
  sort: z
    .enum(["recommended", "rating", "reviews", "nearest", "newest"])
    .optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(60).optional(),
});

export const mapBoundsSchema = z.object({
  west: z.coerce.number(),
  south: z.coerce.number(),
  east: z.coerce.number(),
  north: z.coerce.number(),
});

/* ── Reviews ─────────────────────────────────────────────────────────────── */
export const createReviewSchema = z.object({
  businessId: idSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(10, "Дор хаяж 10 тэмдэгт бичнэ үү").max(5000),
  visitDate: z.coerce.date().optional(),
  photoKeys: z.array(z.string()).max(8).optional(),
});

export const updateReviewSchema = createReviewSchema
  .partial()
  .omit({ businessId: true });

export const reviewVoteSchema = z.object({
  voteType: z.enum(["USEFUL", "FUNNY", "COOL"]),
});

export const ownerResponseSchema = z.object({
  response: z.string().trim().min(2).max(2000),
});

/* ── Photos ──────────────────────────────────────────────────────────────── */
export const presignUploadSchema = z.object({
  scope: z.enum(["business", "review", "avatar"]),
  targetId: z.string().max(64),
  fileName: z.string().max(200),
  contentType: z.string().max(80),
  size: z.number().int().positive(),
});

/* ── Suggest edit / claim ────────────────────────────────────────────────── */
export const suggestEditSchema = z.object({
  payload: z.record(z.string(), z.unknown()).refine(
    (p) => Object.keys(p).length > 0,
    "Дор хаяж нэг талбар оруулна уу",
  ),
});

export const claimSchema = z.object({
  verificationMethod: z.enum(["PHONE", "EMAIL", "DOCUMENT", "MANUAL"]),
  contactPhone: z.string().max(40).optional(),
  evidenceUrl: z.string().url().optional(),
  note: z.string().max(2000).optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(["BUSINESS", "REVIEW", "PHOTO", "USER"]),
  targetId: idSchema,
  reason: z.string().min(2).max(120),
  detail: z.string().max(2000).optional(),
});

/* ── Business (admin / owner) ────────────────────────────────────────────── */
export const businessHoursSchema = z.array(
  z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    isClosed: z.boolean(),
  }),
);

export const upsertBusinessSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().max(5000).optional(),
  primaryCategorySlug: z
    .string()
    .refine((s) => LEAF_CATEGORY_SLUGS.includes(s), "Буруу ангилал")
    .optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  facebookUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  addressText: z.string().max(500).optional(),
  district: z.string().max(80).optional(),
  khoroo: z.string().max(40).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  hours: businessHoursSchema.optional(),
});

export const categorySchema = z.object({
  nameMn: z.string().trim().min(1).max(160),
  nameEn: z.string().max(160).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(160),
  parentId: idSchema.nullable().optional(),
  icon: z.string().max(80).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "OWNER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]),
});

export type SearchInput = z.infer<typeof searchParamsSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpsertBusinessInput = z.infer<typeof upsertBusinessSchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
