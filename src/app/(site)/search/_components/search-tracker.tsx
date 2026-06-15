"use client";

import * as React from "react";

/**
 * Fire-and-forget analytics ping when a search result page is shown with a
 * query. POSTs to /api/track {event:'search_performed', query}. Dedupes per
 * (query, count) so a re-render or filter tweak doesn't double-count.
 */
export function SearchTracker({
  query,
  count,
}: {
  query: string;
  count: number;
}) {
  const sent = React.useRef<string | null>(null);

  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const key = `${q}::${count}`;
    if (sent.current === key) return;
    sent.current = key;

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "search_performed",
        query: q,
        metadata: { resultsCount: count },
      }),
      keepalive: true,
    }).catch(() => {});
  }, [query, count]);

  return null;
}
