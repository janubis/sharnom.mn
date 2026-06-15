/**
 * S3-compatible object storage (AWS S3 / Cloudflare R2 / MinIO).
 * Provides presigned PUT URLs for direct browser uploads + key helpers.
 */
import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

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

/** Build a deterministic, namespaced object key. */
export function mediaKey(
  scope: "business" | "review" | "avatar",
  id: string,
  filename: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${scope}/${id}/${rand}.${ext}`;
}

/** Presigned PUT URL for direct client upload (expires in 5 min). */
export async function presignUpload(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client(), command, { expiresIn: 300 });
  return { url, key, publicUrl: publicUrlFor(key) };
}

export function publicUrlFor(key: string): string {
  return `${env.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/$/, "")}/${key}`;
}
