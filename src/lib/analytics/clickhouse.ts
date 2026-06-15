/**
 * ClickHouse client for analytics (Stage 3). Lazily constructed.
 * When ANALYTICS_SINK !== "clickhouse" this is never instantiated.
 */
import { createClient, type ClickHouseClient } from "@clickhouse/client";

import { env } from "@/lib/env";

let _client: ClickHouseClient | null = null;

export function clickhouse(): ClickHouseClient {
  if (!_client) {
    _client = createClient({
      url: env.CLICKHOUSE_URL,
      username: env.CLICKHOUSE_USER,
      password: env.CLICKHOUSE_PASSWORD,
      database: env.CLICKHOUSE_DATABASE,
      clickhouse_settings: { async_insert: 1, wait_for_async_insert: 0 },
    });
  }
  return _client;
}

export async function insertEvents(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  await clickhouse().insert({
    table: "events",
    values: rows,
    format: "JSONEachRow",
  });
}

/** Run a parameterised analytics query and return typed rows. */
export async function chQuery<T>(
  query: string,
  query_params?: Record<string, unknown>,
): Promise<T[]> {
  const result = await clickhouse().query({
    query,
    query_params,
    format: "JSONEachRow",
  });
  return result.json<T>();
}
