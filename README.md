<div align="center">

# 🇲🇳 Mongol Local

**Монголын шилдэг газруудыг нээ** — a production-grade, Yelp-style local business
discovery & review platform for Mongolia (Ulaanbaatar first).

Mongolian Cyrillic-first · built for scale (fast search, SEO, caching, maps, analytics).

</div>

---

## Table of contents

1. [Overview & features](#1-overview--features)
2. [Tech stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Repository structure](#4-repository-structure)
5. [Prerequisites](#5-prerequisites)
6. [Quick start](#6-quick-start)
7. [Environment variables](#7-environment-variables)
8. [Database guide](#8-database-guide)
9. [Authentication & OAuth setup](#9-authentication--oauth-setup)
10. [Search guide (Stage 1 → Stage 2)](#10-search-guide-stage-1--stage-2)
11. [Maps & vector tiles](#11-maps--vector-tiles)
12. [Analytics](#12-analytics)
13. [Data import & de-duplication](#13-data-import--de-duplication)
14. [API reference](#14-api-reference)
15. [npm scripts reference](#15-npm-scripts-reference)
16. [Local services (Docker)](#16-local-services-docker)
17. [Deployment guide](#17-deployment-guide)
18. [Performance & SEO](#18-performance--seo)
19. [Security](#19-security)
20. [Troubleshooting](#20-troubleshooting)
21. [Roadmap](#21-roadmap)
22. [License](#22-license)

---

## 1. Overview & features

Mongol Local lets people:

- **Search** businesses by name, category, location, district, rating, distance.
- **Browse a map** with marker clustering, popup cards, district filters, "near me".
- **View rich business pages** — photos, phone, address, hours, category, rating, reviews, map pin, JSON-LD.
- **Sign in** with Google, Facebook, Apple, or email.
- **Write reviews & upload photos**, vote on reviews, save/bookmark businesses.
- **Suggest edits** and **claim** their business as an owner.
- **Owners**: edit info, manage photos, respond to reviews, view profile/call/direction analytics.
- **Admins**: manage businesses, users, reviews, photos, categories, reports, claims; full KPI/analytics dashboard; CSV/OSM imports.

It is designed for high read traffic with SSR/ISR, CDN/Redis caching, spatial & trigram
indexes, bounds-based map loading, and a search/analytics layer that scales to OpenSearch
+ ClickHouse.

---

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 15** (App Router) + TypeScript |
| UI | Tailwind CSS v3 + shadcn/ui (Radix) + lucide-react |
| i18n | next-intl (Mongolian default, English ready) |
| Database | **PostgreSQL 16 + PostGIS** via **Drizzle ORM** |
| Auth | **Auth.js v5** — Google, Facebook, Apple, Email |
| Cache / rate-limit / queues | **Redis** (ioredis) |
| Search | **PostgreSQL + pg_trgm** (Stage 1) → **OpenSearch** (Stage 2) |
| Analytics | **ClickHouse** (Postgres fallback table for dev) |
| Object storage | **S3-compatible** (MinIO / Cloudflare R2 / AWS S3) |
| Maps | **MapLibre GL JS** + self-hosted OpenMapTiles (Google adapter ready) |
| Charts | Recharts |
| Validation / forms | Zod + React Hook Form |
| Client data | TanStack Query |

---

## 3. Architecture

```
Browser ── Next.js (SSR / ISR / RSC + Route Handlers) ──┬── PostgreSQL + PostGIS  (source of truth, geo)
                                                        ├── Redis                (cache, rate-limit, sessions/queues)
                                                        ├── OpenSearch           (Stage-2 search, autocomplete, geo)
                                                        ├── ClickHouse           (analytics events @ volume)
                                                        ├── S3 / MinIO           (photos, presigned uploads)
                                                        └── OpenMapTiles         (self-hosted vector tiles)
```

**Swappable abstractions** (the core scaling idea) — toggled by env flag, no rewrites:

| Subsystem | Interface | Flag |
| --- | --- | --- |
| Search | `src/lib/search/index.ts` | `SEARCH_ENGINE=postgres\|opensearch` |
| Maps | `src/lib/maps/provider.ts` | `NEXT_PUBLIC_MAP_PROVIDER=maplibre\|google` |
| Analytics | `src/lib/analytics/track.ts` | `ANALYTICS_SINK=postgres\|clickhouse` |

Other decisions: generated PostGIS `geog` column (GiST index) — app writes only lat/lng;
denormalised aggregates on `businesses` (rating, counts, completeness) power ranking & sort;
RBAC enforced in edge middleware + per-route guards.

---

## 4. Repository structure

```
src/
├── app/
│   ├── (site)/            # public pages (header+footer): home, search, business, category, district, profile, saved
│   ├── login/             # auth entry
│   ├── owner/             # business-owner dashboard (RBAC: OWNER+)
│   ├── admin/             # moderation + analytics console (RBAC: MODERATOR+)
│   ├── api/               # 41 route handlers (public, owner, admin) + auth + sitemap/robots
│   ├── layout.tsx         # root layout (fonts, providers, metadata)
│   └── globals.css        # design tokens (khadag/gobi/cream/soyombo) + motif utilities
├── components/{ui,layout,business,map,common}/   # design system + domain components
├── db/
│   ├── schema.ts          # full Drizzle schema (+ PostGIS, enums, indexes)
│   ├── index.ts           # pooled db client
│   └── queries/           # data-access layer (businesses, reviews, admin-stats, map, ...)
├── lib/
│   ├── auth.ts / auth.config.ts / rbac.ts
│   ├── search/            # postgres (Stage 1), opensearch (Stage 2), dispatcher
│   ├── maps/              # provider.ts, maplibre.ts, google.ts (stub)
│   ├── analytics/         # track.ts (sink router), clickhouse.ts
│   ├── storage/s3.ts · redis.ts · rate-limit.ts · api.ts · validations.ts
│   ├── constants.ts       # districts, category taxonomy, sort/price/analytics enums
│   ├── normalize.ts       # Mongolian name normalisation + dedupe scoring
│   └── seo/jsonld.ts      # LocalBusiness / Breadcrumb / WebSite JSON-LD
├── i18n/                  # next-intl config
└── middleware.ts          # edge RBAC route protection
messages/{mn,en}.json      # UI copy (Mongolian default)
scripts/                   # seed + import (OSM/CSV) + dedupe + reindex
drizzle/                   # generated SQL migrations
docker/                    # Postgres/ClickHouse init SQL, tiles mount
```

---

## 5. Prerequisites

- **Node.js ≥ 20** (tested on 22)
- **Docker** + Docker Compose (for local services)
- npm (examples use npm; pnpm/yarn work too)

---

## 6. Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start local infrastructure (Postgres+PostGIS, Redis, OpenSearch, ClickHouse, MinIO)
npm run services:up
#    (optional) self-hosted map tiles:  docker compose --profile maps up -d

# 3. Configure environment
cp .env.example .env.local
#    → set AUTH_SECRET (openssl rand -base64 32) and any OAuth keys you want enabled

# 4. Create the schema + seed sample Ulaanbaatar data
npm run db:push        # or: npm run db:generate && npm run db:migrate
npm run db:seed

# 5. Run the app
npm run dev            # http://localhost:3000
```

Seeded **SUPER_ADMIN**: `admin@mongol-local.mn`. (Sign in via a configured provider; the
seeded role applies when the email matches.)

---

## 7. Environment variables

Copy `.env.example` → `.env.local`. Full reference:

### App
| Var | Default | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Mongol Local` | Brand name |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Canonical base URL (used by SEO/sitemap) |

### Database
| Var | Default |
| --- | --- |
| `DATABASE_URL` | `postgresql://mongol:mongol@localhost:5432/mongol_local` |

### Auth (Auth.js v5)
| Var | Notes |
| --- | --- |
| `AUTH_SECRET` | **required** — `openssl rand -base64 32` |
| `AUTH_URL` / `AUTH_TRUST_HOST` | base URL / `true` behind a proxy |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | enables Google login when both set |
| `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` | enables Facebook login |
| `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET` | enables Apple login |
| `AUTH_EMAIL_SERVER` / `AUTH_EMAIL_FROM` | SMTP magic-link login |

> Providers are enabled **only when their credentials are present** — you can run with
> just one.

### Infra & feature flags
| Var | Default | Notes |
| --- | --- | --- |
| `REDIS_URL` | `redis://localhost:6379` | Cache/rate-limit; degrades gracefully if down |
| `SEARCH_ENGINE` | `postgres` | `postgres` \| `opensearch` |
| `OPENSEARCH_URL` / `_USERNAME` / `_PASSWORD` / `_INDEX` | localhost:9200 | Stage-2 search |
| `ANALYTICS_SINK` | `postgres` | `postgres` \| `clickhouse` |
| `CLICKHOUSE_URL` / `_USER` / `_PASSWORD` / `_DATABASE` | localhost:8123 | Analytics |
| `S3_ENDPOINT` / `_REGION` / `_BUCKET` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_FORCE_PATH_STYLE` | MinIO @ 9100 | Object storage |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | `http://localhost:9100/mongol-local-media` | Public photo base |
| `NEXT_PUBLIC_MAP_PROVIDER` | `maplibre` | `maplibre` \| `google` |
| `NEXT_PUBLIC_MAP_STYLE_URL` | localhost:8080 | Self-hosted style JSON |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT/LNG/ZOOM` | UB centre | Default viewport |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | — | Only when provider = google |
| `RATE_LIMIT_ENABLED` | `true` | Toggle Redis rate-limits |

---

## 8. Database guide

PostgreSQL + PostGIS, modelled with Drizzle (`src/db/schema.ts`, 21 tables).

```bash
npm run db:generate   # generate SQL migrations from the schema → drizzle/
npm run db:migrate    # apply migrations
npm run db:push       # OR push schema directly (fast dev iteration)
npm run db:studio     # browse data in Drizzle Studio
npm run db:seed       # categories + ~36 sample UB businesses + demo users/reviews
```

**Extensions** (`postgis`, `pg_trgm`, `unaccent`, `uuid-ossp`) are created automatically by
`docker/postgres/init/01-extensions.sql` on first container start. For a managed Postgres,
run those `CREATE EXTENSION` statements once before migrating.

**Geo:** `business_locations.geog` is `geography GENERATED ALWAYS AS
(ST_SetSRID(ST_MakePoint(longitude, latitude),4326)::geography) STORED` with a GiST index —
you only ever write `latitude`/`longitude`.

**Key indexes:** slug/status/category/rating/created_at on businesses, GiST on `geog`, GIN
trigram on names. **Aggregates** (rating/review/photo/saved counts, completeness) are kept
fresh by `recomputeBusinessAggregates()`.

---

## 9. Authentication & OAuth setup

Auth.js v5 with JWT sessions (edge-friendly middleware) + Drizzle adapter. Generate a
secret: `openssl rand -base64 32` → `AUTH_SECRET`.

**Google** — [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → OAuth client ID (Web). Redirect URI:
`http://localhost:3000/api/auth/callback/google` (and your prod URL). Set `AUTH_GOOGLE_ID/SECRET`.

**Facebook** — [developers.facebook.com](https://developers.facebook.com) → app → Facebook
Login → redirect `…/api/auth/callback/facebook`. Set `AUTH_FACEBOOK_ID/SECRET`.

**Apple** — [developer.apple.com](https://developer.apple.com) → Services ID + key; the
client secret is a signed JWT. Redirect `…/api/auth/callback/apple`. Set `AUTH_APPLE_ID/SECRET`.

**Email (magic link)** — set `AUTH_EMAIL_SERVER` (SMTP) + `AUTH_EMAIL_FROM`. For local dev run
an SMTP catcher such as MailHog on `:1025`.

**Roles:** `USER → OWNER → MODERATOR → ADMIN → SUPER_ADMIN`. `/admin` requires MODERATOR+,
`/owner` requires OWNER+ — enforced in `src/middleware.ts` and `src/lib/rbac.ts`.

---

## 10. Search guide (Stage 1 → Stage 2)

- **Stage 1 — PostgreSQL** (`SEARCH_ENGINE=postgres`, default): `pg_trgm` fuzzy name match +
  PostGIS geo-distance + category/district/price/rating/open-now filters, and a weighted
  **"recommended"** ranking (relevance · rating · popularity · verified · completeness ·
  proximity · recency − spam). Good to a few hundred-thousand rows.
- **Stage 2 — OpenSearch** (`SEARCH_ENGINE=opensearch`): Mongolian-aware analysis (ICU folding
  so Cyrillic/Latin variants match), edge-ngram autocomplete, `function_score` ranking,
  geo-distance. Enable with:

  ```bash
  npm run reindex        # ensure index + bulk-index all ACTIVE businesses
  # then set SEARCH_ENGINE=opensearch and restart
  ```

  Falls back to Postgres automatically on OpenSearch error.

---

## 11. Maps & vector tiles

Default provider is **MapLibre GL JS** with clustering and bounds-based pin loading
(`/api/map/pins`, capped at `MAP_MAX_PINS`).

> ⚠️ **Do not use public `openstreetmap.org` tiles in production.** Self-host with OpenMapTiles:
>
> 1. Download a Mongolia/UB extract (e.g. [Geofabrik](https://download.geofabrik.de/)) and
>    generate `.mbtiles` with OpenMapTiles, or grab a prebuilt regional `.mbtiles`.
> 2. Put it in `docker/tiles/` and run `docker compose --profile maps up -d` (tileserver-gl on `:8080`).
> 3. Point `NEXT_PUBLIC_MAP_STYLE_URL` at your style JSON.
> 4. Schedule weekly/daily tile rebuilds from fresh OSM data.

To switch to Google Maps later: implement `src/lib/maps/google.ts` and set
`NEXT_PUBLIC_MAP_PROVIDER=google` — UI components don't change.

---

## 12. Analytics

Tracked events: `page_view, search_performed, business_viewed, map_pin_clicked,
direction_clicked, phone_clicked, website_clicked, review_created, photo_uploaded,
business_saved, claim_started, claim_submitted`.

- **Dev** (`ANALYTICS_SINK=postgres`): events → `analytics_events` + `search_queries`. The
  admin dashboard reads from these.
- **Prod** (`ANALYTICS_SINK=clickhouse`): events → ClickHouse (`docker/clickhouse/init/`
  defines the `events` table + daily rollups) for high-volume ingestion.

Client/server emit via `POST /api/track` (fire-and-forget) and `track()` in
`src/lib/analytics/track.ts`.

---

## 13. Data import & de-duplication

Legal-by-default sources: **OpenStreetMap**, admin **CSV**, and Mongolia **open-data**.
(Do **not** scrape Google Maps, Facebook, 2GIS, or delivery apps without a license.)

```bash
npm run import:osm     # Overpass POIs for an Ulaanbaatar bbox  (supports --dry-run)
npm run import:csv     # scripts/data/sample.csv template       (supports --dry-run)
npm run dedupe         # flag duplicates                        (default dry-run; --apply to write)
```

Pipeline: normalises Mongolian names (strips ХХК/LLC, folds Cyrillic/Latin), computes a
**duplicate confidence** (name similarity + phone + ≤50 m proximity + category), stores
`source` / `source_id` / `confidence_score`, **never overwrites `manually_verified`
businesses**, and records every run in `import_jobs`. Admins can also import via the UI
(`/admin/imports` → `POST /api/admin/imports`).

---

## 14. API reference

Responses are `{ ok: true, data }` or `{ ok: false, error }`.

### Public
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/search` | Full search (filters, sort, geo, pagination) |
| GET | `/api/search/autocomplete` | Suggestions + matching businesses |
| GET | `/api/map/pins` | Bounds-based pins (clustered client-side) |
| GET | `/api/categories` · `/api/districts` | Taxonomy / districts |
| GET | `/api/businesses/:id` | Full business detail |
| GET | `/api/reviews?businessId` | Paginated reviews (sort/page) |
| POST | `/api/track` | Analytics beacon |

### Authenticated
| Method | Path |
| --- | --- |
| POST | `/api/reviews` · PUT/DELETE `/api/reviews/:id` · POST `/api/reviews/:id/vote` |
| POST | `/api/photos` (presigned upload) |
| POST | `/api/businesses/:id/save` · `/suggest-edit` · `/claim` · `/photos` |
| POST | `/api/reports` |

### Owner (OWNER+)
| Method | Path |
| --- | --- |
| GET | `/api/owner/businesses` |
| PUT | `/api/owner/businesses/:id` |
| POST | `/api/owner/businesses/:id/respond-review` · `/photos` (+ PATCH cover / DELETE) |

### Admin (MODERATOR+ / ADMIN for destructive)
| Method | Path |
| --- | --- |
| GET | `/api/admin/stats` · `/api/admin/analytics` |
| CRUD | `/api/admin/businesses` (+ `/:id/merge`, `/:id/duplicates`) |
| CRUD | `/api/admin/categories` · `/api/admin/users` · `/api/admin/reviews` · `/api/admin/claims` · `/api/admin/suggestions` |
| PATCH | `/api/admin/photos/:id` · `/api/admin/reports/:id` |
| POST | `/api/admin/imports` · `/api/admin/reindex-search` |

Auth handler: `GET/POST /api/auth/[...nextauth]`. SEO: `/sitemap.xml`, `/robots.txt`.

---

## 15. npm scripts reference

| Script | What it does |
| --- | --- |
| `dev` / `build` / `start` | Next.js dev / production build / serve |
| `lint` · `typecheck` | ESLint · `tsc --noEmit` |
| `db:generate` · `db:migrate` · `db:push` · `db:studio` | Drizzle migrations / studio |
| `db:seed` | Seed categories + sample UB data |
| `import:osm` · `import:csv` · `dedupe` · `reindex` | Data pipeline |
| `services:up` / `services:down` | Start/stop Docker services |

---

## 16. Local services (Docker)

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| Postgres | `postgres://mongol:mongol@localhost:5432/mongol_local` |
| Redis | `redis://localhost:6379` |
| OpenSearch / Dashboards | http://localhost:9200 / http://localhost:5601 |
| ClickHouse (HTTP) | http://localhost:8123 |
| MinIO API / console | http://localhost:9100 / http://localhost:9001 |
| Tileserver (`--profile maps`) | http://localhost:8080 |

> **Port note:** MinIO's S3 API is on **9100** (ClickHouse native uses 9000); console on 9001.

---

## 17. Deployment guide

### Option A — Vercel + managed services (fastest)
1. Push to GitHub, import the repo into **Vercel**.
2. Provision managed **Postgres+PostGIS** (Neon, Supabase, RDS), **Redis** (Upstash), and
   **S3/R2** for media; optionally **OpenSearch** + **ClickHouse**.
3. Set all env vars in Vercel (see §7). Run `CREATE EXTENSION` statements, then
   `npm run db:migrate` and `npm run db:seed` against the managed DB.
4. Host vector tiles separately (see §11) and point `NEXT_PUBLIC_MAP_STYLE_URL` at it.

### Option B — Self-hosted (Docker)
1. Run the stack from `docker-compose.yml` (harden: enable OpenSearch security, strong
   Postgres/MinIO creds, TLS, backups). Put Next.js behind Nginx/Caddy + a CDN.
2. `npm run build && npm start` (or a Next.js Docker image).

### Production checklist
- [ ] Strong `AUTH_SECRET`; `AUTH_URL`/`AUTH_TRUST_HOST` set; OAuth redirect URIs added.
- [ ] `NEXT_PUBLIC_APP_URL` = real domain (SEO/sitemap/JSON-LD depend on it).
- [ ] Self-hosted tiles (no public OSM tiles).
- [ ] `SEARCH_ENGINE=opensearch` + `npm run reindex`; `ANALYTICS_SINK=clickhouse`.
- [ ] S3/R2 bucket + CDN for media; `NEXT_PUBLIC_MEDIA_BASE_URL` set.
- [ ] DB backups; Redis persistence; rate-limiting on.

---

## 18. Performance & SEO

- SSR/ISR for SEO pages; `generateStaticParams` for category & district landings.
- Redis cache-aside for popular searches, business detail, home feed, map pins.
- Spatial (GiST) + trigram (GIN) + slug/category/status/rating indexes; pagination everywhere;
  bounds-based pins; lazy-loaded maps & admin charts; `next/image`.
- JSON-LD (`LocalBusiness`, `BreadcrumbList`, `WebSite`), `sitemap.ts`, `robots.ts`, clean slugs,
  Mongolian meta titles/descriptions.

**Targets:** Home LCP < 2.5 s · Search API p95 < 300 ms (cached) · Business detail p95 < 500 ms ·
Map pins p95 < 300 ms (bounded).

---

## 19. Security

RBAC + admin route protection · Zod validation on every input · parameterised Drizzle/SQL ·
Redis rate-limiting (login, search, reviews, uploads, claims, reports) · image upload
validation · content moderation status fields · `audit_logs` for privileged actions ·
user ban/suspend · spam-score field on reviews · SUPER_ADMIN protections.

---

## 20. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `type "geography(Point, 4326)" does not exist` on migrate | Ensure `CREATE EXTENSION postgis` ran first; the schema uses plain `geography` on purpose (see `CLAUDE.md`). |
| `next build` fails collecting page data | It needs a reachable database — `npm run services:up` first. |
| `tsc`/`next` not found via `.bin` | Run `node node_modules/typescript/bin/tsc --noEmit` / `node node_modules/next/dist/bin/next lint`. |
| `server-only` error in a script | Only `reindex` preloads the shim; keep other scripts free of server-only imports. |
| Map is blank | Set a valid `NEXT_PUBLIC_MAP_STYLE_URL` (self-hosted tiles); public OSM tiles are not used. |
| OAuth redirect mismatch | Add `…/api/auth/callback/<provider>` for both localhost and prod. |
| "wrong workspace root" warning | A stray lockfile elsewhere — `outputFileTracingRoot` is already pinned in `next.config.mjs`. |

---

## 21. Roadmap

- **Phase 1** ✅ Setup · schema · auth · design system · home · category/district · search ·
  business detail · reviews · admin CRUD · analytics events.
- **Phase 2** ✅ MapLibre view · map pins API · OSM/CSV import · de-dup · claim flow · owner
  dashboard · photo upload · review moderation.
- **Phase 3** OpenSearch indexing · ClickHouse analytics · advanced admin dashboard · Redis
  caching · SEO scaling · performance hardening.

---

## 22. License

Proprietary — © Mongol Local. All rights reserved.

---

<div align="center">
<sub>See <a href="./CLAUDE.md">CLAUDE.md</a> for engineering notes, conventions, and gotchas.</sub>
</div>
