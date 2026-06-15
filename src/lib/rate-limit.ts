/**
 * Fixed-window rate limiting backed by Redis (atomic INCR + EXPIRE).
 * Falls open (allows) if Redis is unavailable so the site stays up.
 */
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  limit: number;
  resetSeconds: number;
};

export type RateLimitRule = { limit: number; windowSeconds: number };

/** Sensible defaults per sensitive action. */
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 60 },
  search: { limit: 60, windowSeconds: 60 },
  review: { limit: 5, windowSeconds: 3600 },
  photoUpload: { limit: 20, windowSeconds: 3600 },
  suggestEdit: { limit: 10, windowSeconds: 3600 },
  claim: { limit: 5, windowSeconds: 86400 },
  report: { limit: 20, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>;

export async function rateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const ok = (remaining = rule.limit): RateLimitResult => ({
    success: true,
    remaining,
    limit: rule.limit,
    resetSeconds: rule.windowSeconds,
  });

  if (!env.RATE_LIMIT_ENABLED || !redis) return ok();

  const key = `rl:${identifier}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, rule.windowSeconds);
    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, rule.limit - count);
    return {
      success: count <= rule.limit,
      remaining,
      limit: rule.limit,
      resetSeconds: ttl > 0 ? ttl : rule.windowSeconds,
    };
  } catch {
    return ok(); // fail open
  }
}

/** Build a stable identifier from request + scope (e.g. ip / userId). */
export function rateLimitKey(scope: string, who: string): string {
  return `${scope}:${who}`;
}
