import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Ruteo multi-tienda:
 *  - slug.STORE_ROOT_DOMAIN/...  → /t/slug/...   (subdominio)
 *  - dominio-propio.com/...      → /t/@dominio/... (dominio personalizado)
 *  - APP_URL/t/slug/...          → igual, sin reescritura (modo ruta)
 * Además, si la tienda tiene landing o página de producto en HTML propio, se sirve esa versión.
 */

const cache = new Map<string, { value: unknown; at: number }>();
const TTL = 30_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, at: Date.now() });
  if (cache.size > 2000) cache.clear();
  return value;
}

function appHost() {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000").host.toLowerCase();
  } catch {
    return "localhost:3000";
  }
}

const PLATFORM_ALIASES = new Set(["localhost:3000", "127.0.0.1:3000"]);

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase().split(",")[0].trim();
  const root = (process.env.STORE_ROOT_DOMAIN || "").toLowerCase().trim();
  const url = req.nextUrl.clone();
  const isPlatform = host === appHost() || PLATFORM_ALIASES.has(host) || (!!root && host === root) || host.startsWith("www.");

  let storeParam: string | null = null;
  let rest = url.pathname;
  let hostMode = false;

  if (!isPlatform && root && host.endsWith(`.${root}`)) {
    storeParam = host.slice(0, -(root.length + 1)).split(":")[0];
    hostMode = true;
  } else if (!isPlatform && host) {
    const domain = host.split(":")[0];
    const store = await cached(`domain:${domain}`, () => db.store.findUnique({ where: { customDomain: domain }, select: { slug: true } }));
    if (store) {
      storeParam = (store as { slug: string }).slug;
      hostMode = true;
    }
  }

  if (!hostMode) {
    const m = url.pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
    if (!m) return NextResponse.next();
    storeParam = decodeURIComponent(m[1]);
    rest = m[2] || "/";
  }
  if (!storeParam) return NextResponse.next();

  // Landing y páginas de producto en HTML propio
  let target = rest;
  if (rest === "/" || /^\/p\/[^/]+\/?$/.test(rest)) {
    const info = await cached(`store:${storeParam}`, () =>
      db.store.findUnique({ where: { slug: storeParam! }, select: { id: true, landingMode: true, landingHtml: true } }),
    );
    const store = info as { id: string; landingMode: string; landingHtml: string | null } | null;
    if (store && rest === "/" && store.landingMode === "CUSTOM_HTML" && store.landingHtml) target = "/vista/landing";
    if (store && rest.startsWith("/p/")) {
      const slug = rest.split("/")[2];
      const product = await cached(`product:${store.id}:${slug}`, () =>
        db.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } }, select: { salesPageMode: true, salesPageHtml: true } }),
      );
      const p = product as { salesPageMode: string; salesPageHtml: string | null } | null;
      if (p && p.salesPageMode === "CUSTOM_HTML" && p.salesPageHtml) target = `/vista/p/${slug}`;
    }
  }

  if (!hostMode && target === rest) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set("x-vd-host-mode", hostMode ? "1" : "0");
  headers.set("x-vd-store", storeParam);
  url.pathname = `/t/${encodeURIComponent(storeParam)}${target === "/" ? "" : target}`;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|api/|media/|icons/|favicon.ico|sw.js|manifest.webmanifest|robots.txt).*)"],
};
