/**
 * Validated environment access.
 *
 * Server-only secrets are validated lazily on first use so that the client
 * bundle never imports them. NEXT_PUBLIC_* values are safe on the client.
 */
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://mongol:mongol@localhost:5432/mongol_local"),

  AUTH_SECRET: z.string().min(1).default("dev-insecure-secret-change-me"),
  AUTH_GOOGLE_ID: z.string().optional().default(""),
  AUTH_GOOGLE_SECRET: z.string().optional().default(""),
  AUTH_FACEBOOK_ID: z.string().optional().default(""),
  AUTH_FACEBOOK_SECRET: z.string().optional().default(""),
  AUTH_APPLE_ID: z.string().optional().default(""),
  AUTH_APPLE_SECRET: z.string().optional().default(""),
  AUTH_EMAIL_FROM: z.string().optional().default("no-reply@mongol-local.mn"),
  AUTH_EMAIL_SERVER: z.string().optional().default(""),

  REDIS_URL: z.string().optional().default("redis://localhost:6379"),

  OPENSEARCH_URL: z.string().optional().default("http://localhost:9200"),
  OPENSEARCH_USERNAME: z.string().optional().default(""),
  OPENSEARCH_PASSWORD: z.string().optional().default(""),
  OPENSEARCH_INDEX: z.string().optional().default("businesses"),
  SEARCH_ENGINE: z.enum(["postgres", "opensearch"]).default("postgres"),

  CLICKHOUSE_URL: z.string().optional().default("http://localhost:8123"),
  CLICKHOUSE_USER: z.string().optional().default("default"),
  CLICKHOUSE_PASSWORD: z.string().optional().default(""),
  CLICKHOUSE_DATABASE: z.string().optional().default("mongol_local_analytics"),
  ANALYTICS_SINK: z.enum(["postgres", "clickhouse"]).default("postgres"),

  S3_ENDPOINT: z.string().optional().default("http://localhost:9100"),
  S3_REGION: z.string().optional().default("us-east-1"),
  S3_BUCKET: z.string().optional().default("mongol-local-media"),
  S3_ACCESS_KEY_ID: z.string().optional().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().optional().default("minioadmin"),
  S3_FORCE_PATH_STYLE: bool(true),

  RATE_LIMIT_ENABLED: bool(true),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Mongol Local"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_MEDIA_BASE_URL: z
    .string()
    .default("http://localhost:9100/mongol-local-media"),
  NEXT_PUBLIC_MAP_PROVIDER: z.enum(["maplibre", "google"]).default("maplibre"),
  NEXT_PUBLIC_MAP_STYLE_URL: z
    .string()
    .default("http://localhost:8080/styles/basic/style.json"),
  NEXT_PUBLIC_MAP_DEFAULT_LAT: z.coerce.number().default(47.918),
  NEXT_PUBLIC_MAP_DEFAULT_LNG: z.coerce.number().default(106.917),
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: z.coerce.number().default(12),
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: z.string().optional().default(""),
});

// Client vars must be referenced statically for Next.js inlining.
const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_MEDIA_BASE_URL: process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  NEXT_PUBLIC_MAP_PROVIDER: process.env.NEXT_PUBLIC_MAP_PROVIDER,
  NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
  NEXT_PUBLIC_MAP_DEFAULT_LAT: process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT,
  NEXT_PUBLIC_MAP_DEFAULT_LNG: process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG,
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM,
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY,
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

let _serverEnv: ServerEnv | null = null;
function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("Server env accessed on the client.");
  }
  if (!_serverEnv) _serverEnv = serverSchema.parse(process.env);
  return _serverEnv;
}

/**
 * Unified env object. Server keys are resolved lazily via a Proxy so that
 * importing `env` on the client only exposes NEXT_PUBLIC_* values.
 */
export const env: ServerEnv & ClientEnv = new Proxy({} as ServerEnv & ClientEnv, {
  get(_t, key: string) {
    if (key in clientEnv) return (clientEnv as Record<string, unknown>)[key];
    return (getServerEnv() as Record<string, unknown>)[key];
  },
});

export const clientConfig = clientEnv;
