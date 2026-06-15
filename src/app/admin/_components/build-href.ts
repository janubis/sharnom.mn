/**
 * Build a pathname?query href that preserves the current admin search params and
 * swaps a single key (used for pagination). Pass a value of `undefined`/`null`
 * to remove a key.
 */
export function withParams(
  pathname: string,
  current: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value[0] != null) params.set(key, value[0]);
    } else {
      params.set(key, value);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
