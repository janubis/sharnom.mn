# CLAUDE.md — project context & engineering notes

This file is the durable "memory" of the project: the decisions, conventions, and
non-obvious gotchas that aren't visible from the code alone. Read it first when
returning to the codebase (human or AI).

---

## What this is

**Mongol Local** — a production-grade, Yelp-style local business discovery & review
platform for Mongolia (Ulaanbaatar first). Mongolian Cyrillic is the **default and
primary UI language**; English is wired in (`next-intl`) but secondary.

The product lets users search businesses (name/category/district/rating/distance),
view them on a map, read & write reviews with photos, save favourites, suggest edits,
and claim their business. Owners get a dashboard; admins get full moderation +
analytics. It is architected to scale toward large-marketplace traffic (à la
unegui.mn), not as a throwaway MVP.

---

## Stack & the "why" behind each choice

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router + TS | One framework for SSR/ISR front **and** API; great SEO. Bundler: Turbopack (Next 16 default) |
| DB | PostgreSQL 16 + **PostGIS** | Relational source of truth + first-class geo (near-me, map bounds) |
| ORM | **Drizzle** | Type-safe, but lets us hand-write PostGIS generated columns + raw geo SQL cleanly (Prisma fights this) |
| Auth | Auth.js v5 | OAuth (Google/Facebook/Apple) + email; JWT sessions → **edge-safe RBAC middleware** |
| Cache/limits | Redis (ioredis) | Cache-aside, rate-limits, future queues |
| Search | Postgres+pg_trgm → OpenSearch | Stage-1 ships day one; Stage-2 swaps in behind one contract |
| Analytics | ClickHouse (Postgres fallback) | High-volume events without bloating the OLTP DB |
| Storage | S3-compatible (MinIO/R2/S3) | Presigned direct uploads |
| Maps | **MapLibre GL JS** | Self-hosted vector tiles, no vendor lock; Google adapter stubbed |
| UI | Tailwind v3 + shadcn/ui (Radix) | Fast, accessible, themeable to the Mongolian palette |
| Charts | Recharts | Admin dashboards |
| Forms/validation | React Hook Form + **Zod** | One schema validates client + server |
| Client data | TanStack Query | Only where client fetching is needed (autocomplete, map pins, infinite scroll, saves) |

### The defining architectural idea — swappable abstractions
Three subsystems are behind interfaces and chosen by env flag, so the app starts
simple and scales without rewrites:
- **Search** — `SEARCH_ENGINE=postgres|opensearch` (`src/lib/search/index.ts`)
- **Maps** — `NEXT_PUBLIC_MAP_PROVIDER=maplibre|google` (`src/lib/maps/provider.ts`)
- **Analytics** — `ANALYTICS_SINK=postgres|clickhouse` (`src/lib/analytics/track.ts`)

---

## Conventions (follow these)

- Path alias `@/` → `src/`. Always import via `@/...`.
- Tailwind: use `cn()` from `@/lib/utils`; **semantic tokens only** (`bg-primary`=khadag
  blue, `bg-secondary`=gobi gold, `text-soyombo`=red accent used sparingly, `bg-card`,
  `border-border`, `shadow-card`). No hardcoded hex.
- i18n: server → `getTranslations` (next-intl/server); client → `useTranslations`.
  New UI copy is written directly in natural Mongolian Cyrillic.
- DB: type-safe Drizzle; raw/geo via `sql\`\`` + `db.execute()`. Never string-concat SQL.
- API routes: validate with Zod, guard with `requireUser/requireRole`, rate-limit
  sensitive POSTs, return `ok()/fail()`, wrap in `try/catch → handleError(e)`.
- Server Components by default; `"use client"` only for interactivity.
- RBAC ranks: `USER < OWNER < MODERATOR < ADMIN < SUPER_ADMIN`. `/admin` needs
  MODERATOR+, `/owner` needs OWNER+ (enforced in `middleware.ts` **and** per route).

---

## Non-obvious gotchas (these will save you time)

1. **PostGIS column type.** `business_locations.geog` uses a Drizzle `customType`
   whose `dataType()` returns plain **`geography`**, NOT `geography(Point,4326)`.
   drizzle-kit quotes a parameterized type as a single identifier and Postgres then
   rejects it. The Point/SRID-4326 constraint is enforced by the generated
   `ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography` expression instead.
2. **`server-only` under scripts.** Query modules import `"server-only"`, which throws
   under plain `tsx`. `npm run reindex` preloads `scripts/_register-server-only.mjs`
   (a Node loader hook stubbing it). `seed`/`import`/`dedupe` are written to avoid
   server-only modules entirely, so they need no shim.
   - **Env load order:** scripts must read `.env.local` *before* `@/db` is evaluated,
     and ESM hoists imports above body code — so the dotenv call lives in a
     dependency-free module `scripts/_env.ts` that is the **first** import of
     `scripts/_shared.ts` (before `@/db`). Don't move it, or scripts fall back to the
     default `mongol:mongol` DSN and fail auth.
3. **Typecheck command.** If `node_modules/.bin/tsc` is missing, run
   `node node_modules/typescript/bin/tsc --noEmit`. Lint:
   `node node_modules/next/dist/bin/next lint`.
4. **Workspace root.** `outputFileTracingRoot` is pinned in `next.config.mjs` because a
   stray lockfile elsewhere on disk can make Next infer the wrong root.
5. **Ports.** MinIO's S3 API is on host **9100** (ClickHouse native uses 9000); MinIO
   console is 9001. See `docker-compose.yml`.
6. **`next build` needs a database.** Pages that read the DB are prerendered at build;
   without a running Postgres the build's page-data step fails (`ECONNREFUSED`). That's
   environmental, not a code defect — bring services up first.
7. **Client/server import boundary.** A `"use client"` component must NEVER import a
   server-only module, or its whole dependency chain gets bundled for the browser and
   breaks (`Can't resolve 'fs'`). Concretely:
   - role checks → import from **`@/lib/roles`** (pure), NOT `@/lib/rbac` (server-only,
     pulls Auth.js → nodemailer → `fs`).
   - upload constants → import from **`@/lib/upload`** (pure), NOT `@/lib/storage/s3`
     (server-only, pulls the AWS SDK).
   - `@/lib/auth`, `@/db`, `@/db/queries/*`, `@/lib/search`, `@/lib/analytics/track`,
     `@/lib/api` are all server-only — client code may import their **types** only
     (`import type`, erased at build).
   `serverExternalPackages` in `next.config.mjs` only fixes Node-server bundling
   (nodemailer is listed there); it does NOT help client/edge leaks — fix those by
   not importing server modules from client code.
8. **Drizzle relational queries need both sides.** `db.query.X.findMany({ with: { y } })`
   requires the relation declared on BOTH tables — a `many(y)` on X *and* an inverse
   `one(X)` (with fields/references) on Y. Missing the inverse throws at runtime:
   "There is not enough information to infer relation 'X.y'". All inverse relations
   live in `src/db/schema.ts`.
9. **Next.js 16 specifics.** (a) `middleware.ts` must export a **function** (default or
   named `middleware`) — a destructured `const` isn't recognized; we do `const { auth }
   = NextAuth(authConfig); export default auth`. (b) Routes reading `request.url` must
   be `export const dynamic = "force-dynamic"`. (c) **`next-intl` must be v4** (v3 can't
   find its config under Turbopack). (d) **`next-auth` v5-beta** declares a peer range of
   Next ≤15 but works on 16 — `.npmrc` sets `legacy-peer-deps=true` so installs resolve.
   (e) `next lint` was removed; lint via the ESLint CLI.

10. **npm ≥ 11.17 blocks install scripts by default.** A fresh `npm install` skips the
    `sharp` / `esbuild` / `unrs-resolver` install scripts (native binaries) unless they're
    allowlisted. We pin approvals in the **`allowScripts`** field of `package.json` (via
    `npm approve-scripts`). Without it, a clean clone breaks `next/image` (sharp) and `tsx`
    (esbuild). If a dep is added later, run `npm approve-scripts --allow-scripts-pending`.

**Toolchain:** Node.js **24.17.0 LTS**, npm **11.17.0**, Next **16.2.9**, next-intl **4.x**.

---

## How it was built

The shared foundation (schema, design tokens, lib/auth/search/maps, constants, i18n)
was authored directly for consistency. The feature surface (pages, APIs, components,
import scripts) was generated by a multi-agent workflow, then integration seams were
reconciled by hand and the whole repo was driven to **0 TypeScript errors** and a clean
lint. See git history and `README.md` for the full architecture.

---

## Verification status

- ✅ `tsc --noEmit` — 0 errors across ~216 source files.
- ✅ `next lint` — no errors (a few benign unused-var warnings remain in canonical files).
- ⚠️ DB-backed verification (`db:push`, `db:seed`, full `next build`, runtime) requires a
  running Postgres/PostGIS — bring up `docker compose` to exercise it end-to-end.
