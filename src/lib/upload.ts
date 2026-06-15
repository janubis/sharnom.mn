/**
 * Pure, client-safe image-upload constraints (no server/AWS imports).
 *
 * Importable from both client and server. The actual S3 presigning lives in the
 * server-only `@/lib/storage/s3`, which re-exports these for convenience.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export function validateImageUpload(contentType: string, size: number): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Зөвхөн JPG, PNG, WEBP, AVIF зураг оруулах боломжтой.";
  }
  if (size > MAX_IMAGE_BYTES) {
    return "Зургийн хэмжээ 8MB-аас бага байх ёстой.";
  }
  return null;
}
