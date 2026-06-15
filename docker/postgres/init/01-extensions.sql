-- Mongol Local — PostgreSQL bootstrap extensions.
-- Runs automatically on first container start.

-- Spatial types & functions (business locations, geo-distance search).
CREATE EXTENSION IF NOT EXISTS postgis;

-- Trigram similarity for fuzzy Mongolian name matching & Stage-1 search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Accent / case-insensitive text (helpful for Cyrillic/Latin normalisation).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- UUID generation for primary keys.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
