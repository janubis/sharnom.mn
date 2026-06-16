/**
 * Side-effect module: load environment from .env.local (then .env) BEFORE any
 * other module is evaluated.
 *
 * ESM hoists & evaluates a module's imports in source order, so the only
 * reliable way to populate process.env before `@/db` (which reads DATABASE_URL
 * at import time) is to do it in a dependency-free module imported first.
 * Therefore this file must be the FIRST import of `scripts/_shared.ts`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();
