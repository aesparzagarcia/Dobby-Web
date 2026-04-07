const BASE = process.env.NEXT_PUBLIC_API_URL || "";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getTokenExpiration(token: string | null): number | null {
  if (!token || typeof window === "undefined") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const data = JSON.parse(json) as { exp?: number };
    return typeof data.exp === "number" ? data.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(): boolean {
  const token = getToken();
  const exp = getTokenExpiration(token);
  if (exp == null) return true;
  return Date.now() / 1000 >= exp;
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function authHeadersForUpload(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Base URL of the backend API (e.g. http://localhost:3001). Empty when using same-origin. */
export const API = BASE;

/** Full URL for an API path. Use for all fetch() calls to the backend. */
export function apiPath(path: string): string {
  const base = BASE.replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}

/** Use for img src when the URL is from the backend (e.g. /uploads/shops/...). */
export function uploadsUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return apiPath(url);
}
