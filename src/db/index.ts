/**
 * Drizzle database client (postgres-js driver).
 *
 * A single pooled connection is reused across hot reloads in development to
 * avoid exhausting Postgres connections.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __mlPg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__mlPg ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // PostGIS geography columns come back as EWKB hex strings; we always
    // project ST_X/ST_Y in queries so the raw text passthrough is fine.
    prepare: false,
  });

if (env.NODE_ENV !== "production") {
  globalForDb.__mlPg = client;
}

export const db = drizzle(client, { schema, logger: env.NODE_ENV === "development" });

export { schema };
export type Database = typeof db;
