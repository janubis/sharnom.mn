-- Mongol Local — ClickHouse analytics schema.
-- Event sink for high-volume product analytics (page views, searches, clicks).

CREATE DATABASE IF NOT EXISTS mongol_local_analytics;

-- Raw event stream. Wide, append-only, partitioned by month.
CREATE TABLE IF NOT EXISTS mongol_local_analytics.events
(
    event_time   DateTime DEFAULT now(),
    event_date   Date DEFAULT toDate(event_time),
    event_name   LowCardinality(String),
    user_id      String,                 -- empty for anonymous
    session_id   String,
    business_id  String,                 -- empty when not applicable
    category_id  String,
    district     LowCardinality(String),
    query        String,                 -- search term (search_performed)
    lat          Float64,
    lng          Float64,
    referrer     String,
    user_agent   String,
    metadata     String                  -- JSON blob for event-specific fields
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_name, event_date, business_id)
TTL event_date + INTERVAL 2 YEAR;

-- Daily rollup for dashboard KPIs (cheap reads). Refreshed by a materialised view.
CREATE TABLE IF NOT EXISTS mongol_local_analytics.events_daily
(
    event_date  Date,
    event_name  LowCardinality(String),
    business_id String,
    district    LowCardinality(String),
    events      UInt64,
    uniq_users  AggregateFunction(uniq, String),
    uniq_sessions AggregateFunction(uniq, String)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, event_name, business_id, district);

CREATE MATERIALIZED VIEW IF NOT EXISTS mongol_local_analytics.events_daily_mv
TO mongol_local_analytics.events_daily AS
SELECT
    event_date,
    event_name,
    business_id,
    district,
    count() AS events,
    uniqState(user_id) AS uniq_users,
    uniqState(session_id) AS uniq_sessions
FROM mongol_local_analytics.events
GROUP BY event_date, event_name, business_id, district;
