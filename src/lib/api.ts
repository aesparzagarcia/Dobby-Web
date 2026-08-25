/**
 * Browser calls stay same-origin (`/api/...`).
 * Next.js rewrites proxy to the backend (see next.config.js + NEXT_PUBLIC_API_URL).
 * That lets the HttpOnly session cookie bind to the admin host (not cross-site).
 */
const BASE = "";

/** Base URL of the backend API. Empty — same-origin via Next rewrites. */
export const API = BASE;

/** Full URL for an API path. Use for all fetch() calls to the backend. */
export function apiPath(path: string): string {
  const base = BASE.replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}

const CSRF_COOKIE = "ewe_csrf";

/** Read the non-HttpOnly CSRF cookie for double-submit (`X-CSRF-Token`). */
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const re = new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`);
  const m = document.cookie.match(re);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].trim()) || null;
  } catch {
    return m[1].trim() || null;
  }
}

/**
 * Fetch against the API with session cookie (credentials: include).
 * Admin auth is HttpOnly `ewe_token` — do not store JWTs in localStorage.
 * When CSRF protection is on (`COOKIE_SAMESITE=None` or `ADMIN_CSRF=true`),
 * mutating requests send `X-CSRF-Token` from the `ewe_csrf` cookie.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const csrf = readCsrfCookie();
    if (csrf && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrf);
    }
  }
  return fetch(apiPath(path), {
    ...init,
    headers,
    credentials: "include",
  });
}

export function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export function authHeadersForUpload(): HeadersInit {
  return {};
}

/** Clear legacy client-side session leftovers from pre-HttpOnly auth. */
export function clearLegacyClientSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    /* ignore */
  }
  document.cookie = "ewe_token=; path=/; max-age=0";
  document.cookie = "ewe_csrf=; path=/; max-age=0";
}
