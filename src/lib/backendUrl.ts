/**
 * Backend origin used by the Next.js server proxy (rewrites + /api/[...path]).
 * Browser traffic stays same-origin (`/api`, `/uploads`).
 */
export function resolveBackendUrl(): string {
  let url = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001").trim().replace(/\/$/, "");
  // Render public URLs must be HTTPS. An HTTP origin 301/302-redirects and
  // drops PUT/POST bodies → the browser shows TypeError: Failed to fetch.
  if (/^http:\/\/[^/]*onrender\.com/i.test(url)) {
    url = `https://${url.slice("http://".length)}`;
  }
  return url;
}
