/**
 * POST /api/photos — issue a presigned PUT URL for a direct browser upload.
 *
 * Validates the declared content type & size, builds a namespaced object key,
 * and returns { url, key, publicUrl }. The client PUTs the file to `url`, then
 * submits the returned `key` to the relevant attach endpoint (business/review).
 */
import "server-only";

import { fail, getClientIp, handleError, ok } from "@/lib/api";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { requireUser } from "@/lib/rbac";
import { mediaKey, presignUpload, validateImageUpload } from "@/lib/storage/s3";
import { presignUploadSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const ip = await getClientIp();
    const limit = await rateLimit(
      rateLimitKey("photoUpload", user.id ?? ip),
      RATE_LIMITS.photoUpload,
    );
    if (!limit.success) return fail("Хэт олон хүсэлт. Түр хүлээнэ үү.", 429);

    const body = await req.json();
    const input = presignUploadSchema.parse(body);

    const invalid = validateImageUpload(input.contentType, input.size);
    if (invalid) return fail(invalid, 422);

    const key = mediaKey(input.scope, input.targetId, input.fileName);
    const presigned = await presignUpload(key, input.contentType);

    return ok(presigned);
  } catch (e) {
    return handleError(e);
  }
}
