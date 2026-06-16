/**
 * Mongol Local — database schema (Drizzle ORM, PostgreSQL + PostGIS).
 *
 * Conventions
 *  - Domain entity PKs: uuid (defaultRandom). Auth tables follow the
 *    Auth.js Drizzle adapter contract (users.id is the shared FK target).
 *  - All timestamps are timezone-aware.
 *  - business_locations.geog is a PostGIS geography(Point,4326) GENERATED
 *    from latitude/longitude, with a GiST index for fast geo-distance search.
 *  - Status fields are pg enums so moderation/lifecycle stays type-safe.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  type AnyPgColumn,
  real,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── PostGIS custom type ───────────────────────── */

/**
 * geography(Point, 4326). We read coordinates back via ST_X/ST_Y in queries,
 * so fromDriver simply passes the raw EWKB string through.
 */
export const geography = customType<{ data: string; driverData: string }>({
  // Plain `geography` so drizzle-kit emits a valid type token. The Point/4326
  // constraint is enforced by the generated `ST_SetSRID(...,4326)::geography`
  // expression on business_locations.geog below.
  dataType() {
    return "geography";
  },
});

/* ──────────────────────────────── Enums ──────────────────────────────────── */

export const userRoleEnum = pgEnum("user_role", [
  "USER",
  "OWNER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
]);

export const businessStatusEnum = pgEnum("business_status", [
  "DRAFT",
  "ACTIVE",
  "CLOSED",
  "DUPLICATE",
  "DELETED",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "UNVERIFIED",
  "CLAIMED",
  "VERIFIED",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "PUBLISHED",
  "PENDING",
  "HIDDEN",
  "DELETED",
]);

export const photoStatusEnum = pgEnum("photo_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const voteTypeEnum = pgEnum("vote_type", ["USEFUL", "FUNNY", "COOL"]);

export const claimStatusEnum = pgEnum("claim_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const claimMethodEnum = pgEnum("claim_method", [
  "PHONE",
  "EMAIL",
  "DOCUMENT",
  "MANUAL",
]);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const reportTargetEnum = pgEnum("report_target", [
  "BUSINESS",
  "REVIEW",
  "PHOTO",
  "USER",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "OPEN",
  "REVIEWING",
  "RESOLVED",
  "DISMISSED",
]);

/* ─────────────────────────── Auth.js core tables ─────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("USER"),
    bio: text("bio"),
    // Soft moderation
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
    // Denormalised contribution counters (kept fresh by triggers / jobs)
    reviewCount: integer("review_count").notNull().default(0),
    photoCount: integer("photo_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_role_idx").on(t.role),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ───────────────────────────── Categories ────────────────────────────────── */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    nameMn: varchar("name_mn", { length: 160 }).notNull(),
    nameEn: varchar("name_en", { length: 160 }),
    slug: varchar("slug", { length: 160 }).notNull(),
    icon: varchar("icon", { length: 80 }), // lucide icon name
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    // Denormalised count for taxonomy UI / SEO pages
    businessCount: integer("business_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("categories_slug_uq").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
    index("categories_sort_idx").on(t.sortOrder),
  ],
);

/* ───────────────────────────── Businesses ────────────────────────────────── */

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    // Normalised name used for de-duplication / fuzzy match (Cyrillic, no suffix)
    normalizedName: varchar("normalized_name", { length: 255 }),
    slug: varchar("slug", { length: 280 }).notNull(),
    description: text("description"),
    primaryCategoryId: uuid("primary_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    priceLevel: smallint("price_level"), // 1..4, nullable
    status: businessStatusEnum("status").notNull().default("ACTIVE"),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("UNVERIFIED"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Denormalised aggregates (kept fresh by jobs / triggers) — power sorting & ranking.
    ratingAvg: real("rating_avg").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    photoCount: integer("photo_count").notNull().default(0),
    savedCount: integer("saved_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    // Profile completeness 0..100 — used in ranking & owner nudges.
    completenessScore: smallint("completeness_score").notNull().default(0),

    // Data provenance / de-dup
    source: varchar("source", { length: 60 }).notNull().default("manual"), // manual | osm | csv | open-data
    sourceId: varchar("source_id", { length: 160 }),
    confidenceScore: real("confidence_score").notNull().default(1),
    // Protects manually verified data from import overwrites.
    manuallyVerified: boolean("manually_verified").notNull().default(false),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("businesses_slug_uq").on(t.slug),
    index("businesses_status_idx").on(t.status),
    index("businesses_category_idx").on(t.primaryCategoryId),
    index("businesses_owner_idx").on(t.ownerUserId),
    index("businesses_rating_idx").on(t.ratingAvg),
    index("businesses_created_idx").on(t.createdAt),
    index("businesses_verification_idx").on(t.verificationStatus),
    index("businesses_source_idx").on(t.source, t.sourceId),
    // Trigram index for Stage-1 fuzzy name search.
    index("businesses_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
    index("businesses_norm_name_trgm_idx").using(
      "gin",
      sql`${t.normalizedName} gin_trgm_ops`,
    ),
  ],
);

export const businessLocations = pgTable(
  "business_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    addressText: text("address_text"),
    district: varchar("district", { length: 80 }), // дүүрэг slug/name
    khoroo: varchar("khoroo", { length: 40 }), // хороо
    city: varchar("city", { length: 80 }).notNull().default("Улаанбаатар"),
    province: varchar("province", { length: 80 }), // аймаг (outside UB)
    country: varchar("country", { length: 80 }).notNull().default("Монгол"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    // Generated PostGIS geography — never written directly by the app.
    geog: geography("geog").generatedAlwaysAs(
      sql`(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)`,
    ),
    plusCode: varchar("plus_code", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("business_locations_business_idx").on(t.businessId),
    index("business_locations_district_idx").on(t.district),
    // Spatial index: the workhorse for "near me" / map-bounds queries.
    index("business_locations_geog_gist").using("gist", t.geog),
  ],
);

export const businessContacts = pgTable(
  "business_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 40 }),
    phoneSecondary: varchar("phone_secondary", { length: 40 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    facebookUrl: varchar("facebook_url", { length: 255 }),
    instagramUrl: varchar("instagram_url", { length: 255 }),
  },
  (t) => [
    index("business_contacts_business_idx").on(t.businessId),
    index("business_contacts_phone_idx").on(t.phone),
  ],
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0=Sunday .. 6=Saturday
    openTime: time("open_time"),
    closeTime: time("close_time"),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => [
    index("business_hours_business_idx").on(t.businessId),
    unique("business_hours_unique_day").on(t.businessId, t.dayOfWeek),
  ],
);

/* ─────────────────────────────── Reviews ─────────────────────────────────── */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(), // 1..5 (enforced in app + check)
    title: varchar("title", { length: 200 }),
    body: text("body").notNull(),
    status: reviewStatusEnum("status").notNull().default("PUBLISHED"),
    visitDate: timestamp("visit_date", { withTimezone: true, mode: "date" }),
    // Spam heuristics
    spamScore: real("spam_score").notNull().default(0),
    usefulCount: integer("useful_count").notNull().default(0),
    funnyCount: integer("funny_count").notNull().default(0),
    coolCount: integer("cool_count").notNull().default(0),
    // Owner response (one per review) kept inline for fast reads.
    ownerResponse: text("owner_response"),
    ownerResponseAt: timestamp("owner_response_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reviews_business_idx").on(t.businessId),
    index("reviews_user_idx").on(t.userId),
    index("reviews_status_idx").on(t.status),
    index("reviews_created_idx").on(t.createdAt),
    // One review per user per business.
    uniqueIndex("reviews_user_business_uq").on(t.userId, t.businessId),
  ],
);

export const reviewPhotos = pgTable(
  "review_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    status: photoStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("review_photos_review_idx").on(t.reviewId),
    index("review_photos_business_idx").on(t.businessId),
    index("review_photos_status_idx").on(t.status),
  ],
);

export const businessPhotos = pgTable(
  "business_photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    imageUrl: text("image_url").notNull(),
    caption: varchar("caption", { length: 200 }),
    width: integer("width"),
    height: integer("height"),
    status: photoStatusEnum("status").notNull().default("PENDING"),
    isCover: boolean("is_cover").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("business_photos_business_idx").on(t.businessId),
    index("business_photos_status_idx").on(t.status),
    index("business_photos_sort_idx").on(t.businessId, t.sortOrder),
  ],
);

export const reviewVotes = pgTable(
  "review_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("review_votes_uq").on(t.reviewId, t.userId, t.voteType),
    index("review_votes_review_idx").on(t.reviewId),
  ],
);

export const savedBusinesses = pgTable(
  "saved_businesses",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.businessId] }),
    index("saved_businesses_business_idx").on(t.businessId),
  ],
);

/* ───────────────────── Ownership, suggestions, reports ───────────────────── */

export const businessClaims = pgTable(
  "business_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: claimStatusEnum("status").notNull().default("PENDING"),
    verificationMethod: claimMethodEnum("verification_method"),
    evidenceUrl: text("evidence_url"),
    contactPhone: varchar("contact_phone", { length: 40 }),
    note: text("note"), // applicant note
    adminNote: text("admin_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("business_claims_business_idx").on(t.businessId),
    index("business_claims_user_idx").on(t.userId),
    index("business_claims_status_idx").on(t.status),
  ],
);

export const businessEditSuggestions = pgTable(
  "business_edit_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // Proposed field changes, e.g. { phone: "...", addressText: "..." }
    payload: jsonb("payload").notNull(),
    status: suggestionStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("edit_suggestions_business_idx").on(t.businessId),
    index("edit_suggestions_status_idx").on(t.status),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    detail: text("detail"),
    status: reportStatusEnum("status").notNull().default("OPEN"),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reports_target_idx").on(t.targetType, t.targetId),
    index("reports_status_idx").on(t.status),
  ],
);

/* ───────────────────────── Analytics & audit (Postgres fallback) ─────────── */

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventName: varchar("event_name", { length: 60 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 64 }),
    businessId: uuid("business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id"),
    district: varchar("district", { length: 80 }),
    query: text("query"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("analytics_events_name_idx").on(t.eventName),
    index("analytics_events_created_idx").on(t.createdAt),
    index("analytics_events_business_idx").on(t.businessId),
  ],
);

/** Normalised search-term log → powers "top keywords" without ClickHouse. */
export const searchQueries = pgTable(
  "search_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queryRaw: text("query_raw").notNull(),
    queryNormalized: text("query_normalized").notNull(),
    resultsCount: integer("results_count").notNull().default(0),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("search_queries_norm_idx").on(t.queryNormalized),
    index("search_queries_created_idx").on(t.createdAt),
  ],
);

/** Immutable audit trail for privileged admin/owner actions. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(), // e.g. business.delete
    targetType: varchar("target_type", { length: 60 }),
    targetId: varchar("target_id", { length: 64 }),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

/** Tracks data imports (OSM / CSV / open-data) and their outcomes. */
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: varchar("source", { length: 60 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("RUNNING"),
  totalRows: integer("total_rows").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  log: jsonb("log"),
  startedBy: uuid("started_by").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/* ──────────────────────────────── Relations ──────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  savedBusinesses: many(savedBusinesses),
  ownedBusinesses: many(businesses),
  claims: many(businessClaims),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  businesses: many(businesses),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  primaryCategory: one(categories, {
    fields: [businesses.primaryCategoryId],
    references: [categories.id],
  }),
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
  }),
  location: one(businessLocations, {
    fields: [businesses.id],
    references: [businessLocations.businessId],
  }),
  contact: one(businessContacts, {
    fields: [businesses.id],
    references: [businessContacts.businessId],
  }),
  hours: many(businessHours),
  photos: many(businessPhotos),
  reviews: many(reviews),
  claims: many(businessClaims),
}));

export const businessLocationsRelations = relations(businessLocations, ({ one }) => ({
  business: one(businesses, {
    fields: [businessLocations.businessId],
    references: [businesses.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  business: one(businesses, {
    fields: [reviews.businessId],
    references: [businesses.id],
  }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  photos: many(reviewPhotos),
  votes: many(reviewVotes),
}));

// Inverse `one()` relations — required by the relational query API so Drizzle
// can infer joins (e.g. db.query.reviews.findMany({ with: { photos: true } })).
export const businessContactsRelations = relations(businessContacts, ({ one }) => ({
  business: one(businesses, {
    fields: [businessContacts.businessId],
    references: [businesses.id],
  }),
}));

export const businessHoursRelations = relations(businessHours, ({ one }) => ({
  business: one(businesses, {
    fields: [businessHours.businessId],
    references: [businesses.id],
  }),
}));

export const businessPhotosRelations = relations(businessPhotos, ({ one }) => ({
  business: one(businesses, {
    fields: [businessPhotos.businessId],
    references: [businesses.id],
  }),
  uploadedBy: one(users, {
    fields: [businessPhotos.uploadedByUserId],
    references: [users.id],
  }),
}));

export const reviewPhotosRelations = relations(reviewPhotos, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewPhotos.reviewId],
    references: [reviews.id],
  }),
  business: one(businesses, {
    fields: [reviewPhotos.businessId],
    references: [businesses.id],
  }),
  user: one(users, { fields: [reviewPhotos.userId], references: [users.id] }),
}));

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewVotes.reviewId],
    references: [reviews.id],
  }),
  user: one(users, { fields: [reviewVotes.userId], references: [users.id] }),
}));

export const savedBusinessesRelations = relations(savedBusinesses, ({ one }) => ({
  user: one(users, { fields: [savedBusinesses.userId], references: [users.id] }),
  business: one(businesses, {
    fields: [savedBusinesses.businessId],
    references: [businesses.id],
  }),
}));

export const businessClaimsRelations = relations(businessClaims, ({ one }) => ({
  business: one(businesses, {
    fields: [businessClaims.businessId],
    references: [businesses.id],
  }),
  user: one(users, { fields: [businessClaims.userId], references: [users.id] }),
}));

/* ─────────────────────────── Inferred types ──────────────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type BusinessLocation = typeof businessLocations.$inferSelect;
export type BusinessContact = typeof businessContacts.$inferSelect;
export type BusinessHours = typeof businessHours.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type BusinessPhoto = typeof businessPhotos.$inferSelect;
export type ReviewPhoto = typeof reviewPhotos.$inferSelect;
export type BusinessClaim = typeof businessClaims.$inferSelect;
export type EditSuggestion = typeof businessEditSuggestions.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type BusinessStatus = (typeof businessStatusEnum.enumValues)[number];
export type VerificationStatus = (typeof verificationStatusEnum.enumValues)[number];
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];
export type PhotoStatus = (typeof photoStatusEnum.enumValues)[number];
export type ClaimStatus = (typeof claimStatusEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type ReportTarget = (typeof reportTargetEnum.enumValues)[number];
export type SuggestionStatus = (typeof suggestionStatusEnum.enumValues)[number];
