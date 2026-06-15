import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local first (developer overrides), then .env.
config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  // drizzle-kit loads .env.local via the npm scripts (`dotenv` / tsx).
  // Surface a clear message instead of a cryptic connection error.
  console.warn("[drizzle] DATABASE_URL is not set — using default localhost DSN.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://mongol:mongol@localhost:5432/mongol_local",
  },
  // PostGIS introspection: keep our hand-written geography columns intact.
  verbose: true,
  strict: true,
});
