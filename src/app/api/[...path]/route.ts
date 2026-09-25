import { NextRequest, NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";
import { resolveBackendUrl } from "@/lib/backendUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const PROXY_TIMEOUT_MS = 15_000;

const REQUEST_HEADERS = [
  "cookie",
  "content-type",
  "authorization",
  "accept",
  "x-csrf-token",
  "x-requested-with",
];

type Proxied = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function proxyHttp(
  target: string,
  method: string,
  reqHeaders: Headers,
  body: Buffer
): Promise<Proxied> {
  const u = new URL(target);
  const lib = u.protocol === "https:" ? https : http;
  const headers: http.OutgoingHttpHeaders = {
    host: u.host,
    "content-length": body.length,
  };
  for (const name of REQUEST_HEADERS) {
    const value = reqHeaders.get(name);
    if (value) headers[name] = value;
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers,
        timeout: PROXY_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.on("error", reject);
    if (body.length > 0) req.write(body);
    req.end();
  });
}

async function proxy(req: NextRequest, path: string[] | undefined): Promise<NextResponse> {
  try {
    const segments = Array.isArray(path) ? [...path] : [];
    // Admin UI uses /api/anuncios so Chrome ad blockers don't intercept /api/ads/:id.
    if (segments[0] === "anuncios") segments[0] = "ads";
    const backend = resolveBackendUrl();
    const incoming = new URL(req.url);
    const target = `${backend}/api/${segments.join("/")}${incoming.search}`;
    const method = req.method.toUpperCase();
    const body =
      method === "GET" || method === "HEAD"
        ? Buffer.alloc(0)
        : Buffer.from(await req.arrayBuffer());

    const upstream = await proxyHttp(target, method, req.headers, body);
    const out = new Headers();
    for (const [key, value] of Object.entries(upstream.headers)) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (
        lower === "transfer-encoding" ||
        lower === "connection" ||
        lower === "content-encoding" ||
        lower === "content-length"
      ) {
        continue;
      }
      if (lower === "set-cookie") {
        const cookies = Array.isArray(value) ? value : [value];
        for (const cookie of cookies) out.append("set-cookie", cookie);
        continue;
      }
      out.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    out.set("x-dobby-proxy", "1");
    return new NextResponse(new Uint8Array(upstream.body), {
      status: upstream.status,
      headers: out,
    });
  } catch (err) {
    console.error("[api-proxy]", req.method, path?.join("/"), err);
    const timedOut = err instanceof Error && err.message === "timeout";
    return NextResponse.json(
      {
        error: timedOut
          ? "El servidor tardó demasiado en responder. Intenta de nuevo."
          : "No se pudo conectar con el servidor. Intenta de nuevo.",
        field: null,
        detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        method: req.method,
        path: path?.join("/") ?? "",
      },
      { status: timedOut ? 504 : 502 }
    );
  }
}

type RouteCtx = { params: { path: string[] } | Promise<{ path: string[] }> };

async function pathFrom(ctx: RouteCtx): Promise<string[]> {
  const params = await ctx.params;
  return params?.path ?? [];
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
export async function OPTIONS(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, await pathFrom(ctx));
}
