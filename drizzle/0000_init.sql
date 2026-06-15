CREATE TYPE "public"."business_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'DUPLICATE', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."claim_method" AS ENUM('PHONE', 'EMAIL', 'DOCUMENT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('BUSINESS', 'REVIEW', 'PHOTO', 'USER');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PUBLISHED', 'PENDING', 'HIDDEN', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'OWNER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'CLAIMED', 'VERIFIED');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('USEFUL', 'FUNNY', 'COOL');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(60) NOT NULL,
	"user_id" uuid,
	"session_id" varchar(64),
	"business_id" uuid,
	"category_id" uuid,
	"district" varchar(80),
	"query" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(120) NOT NULL,
	"target_type" varchar(60),
	"target_id" varchar(64),
	"before" jsonb,
	"after" jsonb,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "claim_status" DEFAULT 'PENDING' NOT NULL,
	"verification_method" "claim_method",
	"evidence_url" text,
	"contact_phone" varchar(40),
	"note" text,
	"admin_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"phone" varchar(40),
	"phone_secondary" varchar(40),
	"email" varchar(255),
	"website" varchar(255),
	"facebook_url" varchar(255),
	"instagram_url" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "business_edit_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"open_time" time,
	"close_time" time,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "business_hours_unique_day" UNIQUE("business_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "business_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"address_text" text,
	"district" varchar(80),
	"khoroo" varchar(40),
	"city" varchar(80) DEFAULT 'Улаанбаатар' NOT NULL,
	"province" varchar(80),
	"country" varchar(80) DEFAULT 'Монгол' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"geog" "geography" GENERATED ALWAYS AS ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)) STORED,
	"plus_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid,
	"image_url" text NOT NULL,
	"caption" varchar(200),
	"width" integer,
	"height" integer,
	"status" "photo_status" DEFAULT 'PENDING' NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255),
	"slug" varchar(280) NOT NULL,
	"description" text,
	"primary_category_id" uuid,
	"price_level" smallint,
	"status" "business_status" DEFAULT 'ACTIVE' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"owner_user_id" uuid,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"saved_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"completeness_score" smallint DEFAULT 0 NOT NULL,
	"source" varchar(60) DEFAULT 'manual' NOT NULL,
	"source_id" varchar(160),
	"confidence_score" real DEFAULT 1 NOT NULL,
	"manually_verified" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name_mn" varchar(160) NOT NULL,
	"name_en" varchar(160),
	"slug" varchar(160) NOT NULL,
	"icon" varchar(80),
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"business_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(60) NOT NULL,
	"file_name" varchar(255),
	"status" varchar(30) DEFAULT 'RUNNING' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"log" jsonb,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" varchar(120) NOT NULL,
	"detail" text,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"status" "photo_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote_type" "vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"title" varchar(200),
	"body" text NOT NULL,
	"status" "review_status" DEFAULT 'PUBLISHED' NOT NULL,
	"visit_date" timestamp with time zone,
	"spam_score" real DEFAULT 0 NOT NULL,
	"useful_count" integer DEFAULT 0 NOT NULL,
	"funny_count" integer DEFAULT 0 NOT NULL,
	"cool_count" integer DEFAULT 0 NOT NULL,
	"owner_response" text,
	"owner_response_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_businesses" (
	"user_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_businesses_user_id_business_id_pk" PRIMARY KEY("user_id","business_id")
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_raw" text NOT NULL,
	"query_normalized" text NOT NULL,
	"results_count" integer DEFAULT 0 NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"bio" text,
	"banned_at" timestamp with time zone,
	"suspended_until" timestamp with time zone,
	"review_count" integer DEFAULT 0 NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_claims" ADD CONSTRAINT "business_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_contacts" ADD CONSTRAINT "business_contacts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_edit_suggestions" ADD CONSTRAINT "business_edit_suggestions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_edit_suggestions" ADD CONSTRAINT "business_edit_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_edit_suggestions" ADD CONSTRAINT "business_edit_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_locations" ADD CONSTRAINT "business_locations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_photos" ADD CONSTRAINT "business_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_photos" ADD CONSTRAINT "business_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_businesses" ADD CONSTRAINT "saved_businesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_businesses" ADD CONSTRAINT "saved_businesses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_business_idx" ON "analytics_events" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "business_claims_business_idx" ON "business_claims" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_claims_user_idx" ON "business_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "business_claims_status_idx" ON "business_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_contacts_business_idx" ON "business_contacts" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_contacts_phone_idx" ON "business_contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "edit_suggestions_business_idx" ON "business_edit_suggestions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "edit_suggestions_status_idx" ON "business_edit_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_hours_business_idx" ON "business_hours" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_locations_business_idx" ON "business_locations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_locations_district_idx" ON "business_locations" USING btree ("district");--> statement-breakpoint
CREATE INDEX "business_locations_geog_gist" ON "business_locations" USING gist ("geog");--> statement-breakpoint
CREATE INDEX "business_photos_business_idx" ON "business_photos" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "business_photos_status_idx" ON "business_photos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "business_photos_sort_idx" ON "business_photos" USING btree ("business_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "businesses_category_idx" ON "businesses" USING btree ("primary_category_id");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "businesses_rating_idx" ON "businesses" USING btree ("rating_avg");--> statement-breakpoint
CREATE INDEX "businesses_created_idx" ON "businesses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "businesses_verification_idx" ON "businesses" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "businesses_source_idx" ON "businesses" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "businesses_name_trgm_idx" ON "businesses" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "businesses_norm_name_trgm_idx" ON "businesses" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_uq" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_sort_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "review_photos_review_idx" ON "review_photos" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_photos_business_idx" ON "review_photos" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "review_photos_status_idx" ON "review_photos" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_votes_uq" ON "review_votes" USING btree ("review_id","user_id","vote_type");--> statement-breakpoint
CREATE INDEX "review_votes_review_idx" ON "review_votes" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "reviews_business_idx" ON "reviews" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "reviews_user_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_created_idx" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_business_uq" ON "reviews" USING btree ("user_id","business_id");--> statement-breakpoint
CREATE INDEX "saved_businesses_business_idx" ON "saved_businesses" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "search_queries_norm_idx" ON "search_queries" USING btree ("query_normalized");--> statement-breakpoint
CREATE INDEX "search_queries_created_idx" ON "search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");