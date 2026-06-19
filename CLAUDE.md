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

> **This file is the single source of truth.** It is loaded automatically every
> session, so read it first and keep it current — when something material changes
> (versions, DB host, a new gotcha, a decision), update the relevant section here.

---

## Current state (updated 2026-06-16)

**Status:** builds clean and runs end-to-end. `tsc --noEmit` = 0 errors · `next build`
succeeds · all pages + APIs return 200 (verified). Repo:
https://github.com/janubis/sharnom.mn (branch `main`).

**Toolchain:** Node **24.17.0 LTS** · npm **11.17.0** · Next **16.2.9** ·
next-intl **4.x** · React 19 · TypeScript 5.7.

**Database — PostgreSQL + PostGIS:**
- *Local (current default):* native **PostgreSQL 18.4** at `C:\Program Files\PostgreSQL\18`,
  superuser `postgres` / password `root`, DB `mongol_local`, port 5432. Extensions:
  `postgis` 3.6.2, `pg_trgm`, `unaccent`. Schema migrated + seeded (36 businesses,
  45 categories, 97 reviews). psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe` with
  `$env:PGPASSWORD="root"`.
- *Supabase (target host — see below):* migration pending an IPv4 **Session-pooler**
  connection string (this network has no IPv6; the direct `db.<ref>.supabase.co` host is
  IPv6-only and unreachable here).

**Services:** Redis / OpenSearch / ClickHouse / MinIO are optional and currently
absent — the app degrades gracefully (cache + rate-limit fail open;
`SEARCH_ENGINE=postgres`, `ANALYTICS_SINK=postgres`). Photo *upload* needs MinIO/S3 or
Supabase Storage running.

**Secrets** live in `.env.local` (gitignored): `DATABASE_URL`, `AUTH_SECRET`, OAuth keys,
Supabase DB password, map/analytics keys. Never commit them. `.env.example` documents
every variable.

## Supabase project

- Name **sharnom.mn** · ref **ptqjmvydciialkqdhwbj** · URL https://ptqjmvydciialkqdhwbj.supabase.co
- Publishable (anon) key: `sb_publishable_OWsQjoRC4l9hz4Bxzv8xwA_s0gXPIGU` (client-safe to expose).
- **DB password is in `.env.local`**, not here.
- Direct host `db.ptqjmvydciialkqdhwbj.supabase.co:5432` is **IPv6-only** → unusable on
  IPv4 networks. For migrations/seed/app use the **Session pooler** (Supabase dashboard →
  Connect → Session pooler): host `aws-0-<region>.pooler.supabase.com`, user
  `postgres.ptqjmvydciialkqdhwbj`, port `5432`.
- **Migrate to Supabase:** enable `postgis`, `pg_trgm`, `unaccent` on the Supabase DB
  (dashboard → Database → Extensions, or `create extension`), set `DATABASE_URL` to the
  pooler string in `.env.local`, then `npm run db:push && npm run db:seed`. Auth.js + S3
  storage stay as-is unless we decide to adopt Supabase Auth/Storage later.

## Run locally

```
npm install                          # uses .npmrc (legacy-peer-deps) + package.json allowScripts
npm run db:push && npm run db:seed   # if the DB is empty
npm run dev                          # http://localhost:3000
```
Typecheck: `node node_modules/typescript/bin/tsc --noEmit` · Build: `npm run build`.

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
   `node node_modules/typescript/bin/tsc --noEmit`. (`next lint` was removed in Next 16 —
   use the ESLint CLI for linting.)
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

- ✅ `tsc --noEmit` — 0 errors.
- ✅ `next build` — succeeds (Turbopack; 69/69 static pages generated against the live DB).
- ✅ Runtime — home, search, business detail, category/district, login, owner, and `/api/*`
  all return 200; `/admin` → 307 (auth middleware); PostGIS geo features work.

## Decision log

- **2026-06-14/15** Initial build: foundation authored by hand, feature surface via a
  resumable multi-agent workflow (finished across session-limit resumes), driven to 0 TS errors.
- **2026-06-15** Pushed to GitHub `janubis/sharnom.mn`. Wrote full README + this file.
- **2026-06-15** Fixed client/server bundling leaks (nodemailer→fs): split pure helpers
  into `@/lib/roles` + `@/lib/upload` (gotcha 7).
- **2026-06-16** Local DB stood up: native PostgreSQL 18 + PostGIS 3.6.2 (installed via the
  OSGeo bundle), schema migrated + seeded; app verified end-to-end.
- **2026-06-16** Fixed "infer relation reviews.photos" by adding all inverse Drizzle
  relations (gotcha 8).
- **2026-06-16** Upgraded Next 15→**16** (+ next-intl 4, middleware fn export,
  `force-dynamic` autocomplete, `.npmrc`), Node 22→**24.17 LTS**, npm→**11.17**
  (+ `allowScripts`). All verified.
- **2026-06-16** Stack-alignment review vs a Supabase/Vercel recommendation. Decisions:
  adopt **Supabase Postgres** (DB only; keep Auth.js + S3); **MapLibre + hosted tiles**
  (MapTiler); keep **pg_trgm** search for MVP; prep Vercel Analytics + Sentry + GA4 +
  `vercel.json` (inert until accounts connected). Supabase DB migration pending the IPv4
  pooler string.

**Pending / next steps:**
1. Supabase DB migration — needs the Session-pooler connection string (IPv4).
2. Add a MapTiler key (`NEXT_PUBLIC_MAP_STYLE_URL`) for production map tiles.
3. Connect Vercel + Cloudflare + Sentry + GA4 accounts when deploying.
