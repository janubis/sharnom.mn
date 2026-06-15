/**
 * Redis client (ioredis) — cache, rate-limit counters, and queue backing.
 * Reused across hot reloads. Degrades gracefully if Redis is unavailable:
 * cache helpers fall back to executing the loader directly.
 */
import Redis from "ioredis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as { __mlRedis?: Redis | null };

function createClient(): Redis | null {
  try {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      enableOfflineQueue: false,
    });
    client.on("error", (e) => {
      // Avoid crashing the app if Redis is down; cache simply misses.
      if (env.NODE_ENV === "development") {
        console.warn("[redis] connection error:", e.message);
      }
    });
    return client;
  } catch {
    return null;
  }
}

export const redis: Redis | null =
  globalForRedis.__mlRedis ?? (globalForRedis.__mlRedis = createClient());

/**
 * Cache-aside helper. Returns cached JSON or runs `loader`, caching the result.
 * On any Redis error it just runs the loader (no caching) so reads never fail.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) return loader();
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    return loader();
  }
  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* ignore cache write failures */
  }
  return value;
}

/** Invalidate one or more cache keys / patterns. */
export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    /* ignore */
  }
}

export const cacheKeys = {
  business: (slug: string) => `biz:${slug}`,
  search: (hash: string) => `search:${hash}`,
  categoryPage: (slug: string) => `cat:${slug}`,
  districtPage: (slug: string) => `dist:${slug}`,
  homeFeed: () => `home:feed`,
  mapPins: (hash: string) => `pins:${hash}`,
};
