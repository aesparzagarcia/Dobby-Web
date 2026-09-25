import { NextRequest, NextResponse } from "next/server";
import { resolveBackendUrl } from "@/lib/backendUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

const REQUEST_HEADERS = [
  "cookie",
  "content-type",
  "authorization",
  "accept",
  "x-csrf-token",
  "x-requested-with",
];

type FetchInit = RequestInit & { duplex?: "half" };

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const backend = resolveBackendUrl();
  const incoming = new URL(req.url);
  const target = `${backend}/api/${path.join("/")}${incoming.search}`;

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const method = req.method.toUpperCase();
  const init: FetchInit = {
    method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > 0) {
      init.body = buf;
      init.duplex = "half";
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error("[api-proxy] fetch failed", method, target, err);
    return NextResponse.json(
      { error: "No se pudo conectar con el servidor. Intenta de nuevo." },
      { status: 502 }
    );
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "set-cookie") return;
    outHeaders.append(key, value);
  });

  const getSetCookie = upstream.headers.getSetCookie?.bind(upstream.headers);
  const setCookies = getSetCookie ? getSetCookie() : [];
  for (const cookie of setCookies) {
    outHeaders.append("set-cookie", cookie);
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers: outHeaders });
}

type RouteCtx = { params: { path: string[] } };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, ctx.params.path);
}
