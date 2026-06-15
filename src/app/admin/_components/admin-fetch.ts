"use client";

/**
 * Thin client-side fetch helper for the admin console. All admin mutations hit
 * the /api/admin/* endpoints which return { ok:true, data } | { ok:false, error }.
 * This unwraps that envelope and throws a friendly Error on failure so callers
 * can `try/catch` and toast.
 */
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: Record<string, string[]> };

export async function adminFetch<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !json || json.ok === false) {
    const message =
      (json && "error" in json && json.error) ||
      "Үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.";
    throw new Error(message);
  }
  return json.data;
}

/** Convenience JSON-body POST/PUT/DELETE wrappers. */
export const adminApi = {
  get: <T>(url: string) => adminFetch<T>(url),
  post: <T>(url: string, body?: unknown) =>
    adminFetch<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body?: unknown) =>
    adminFetch<T>(url, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(url: string, body?: unknown) =>
    adminFetch<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(url: string, body?: unknown) =>
    adminFetch<T>(url, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};
