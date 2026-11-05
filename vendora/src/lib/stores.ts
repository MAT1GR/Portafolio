import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { env } from "./env";

type StoreUrlInfo = { slug: string; customDomain?: string | null };

function protocol() {
  return env.appUrl.startsWith("https://") ? "https" : "http";
}

/** URL pública absoluta de la tienda (para emails, webhooks y links externos). */
export function storeBaseUrl(store: StoreUrlInfo) {
  if (store.customDomain) return `${protocol()}://${store.customDomain}`;
  if (env.storeRootDomain) return `${protocol()}://${store.slug}.${env.storeRootDomain}`;
  return `${env.appUrl}/t/${store.slug}`;
}

export function storeUrl(store: StoreUrlInfo, path = "/") {
  const base = storeBaseUrl(store);
  return path === "/" ? base : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Prefijo de links dentro de la tienda para la request actual ("" si se entra por subdominio/dominio propio). */
export async function storeBasePath(slug: string) {
  const h = await headers();
  return h.get("x-vd-host-mode") === "1" ? "" : `/t/${slug}`;
}

/** Resuelve la tienda desde el parámetro de ruta: slug o "@dominio" (dominio propio). */
export const getStoreByParam = cache(async (param: string) => {
  const value = decodeURIComponent(param).toLowerCase();
  const store = value.startsWith("@")
    ? await db.store.findUnique({ where: { customDomain: value.slice(1) } })
    : await db.store.findUnique({ where: { slug: value } });
  return store;
});

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "panel", "login", "registro", "t", "media", "static", "mail", "soporte", "ayuda", "blog", "dev", "test",
]);

export async function uniqueStoreSlug(base: string) {
  let slug = slugify(base) || "tienda";
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-tienda`;
  let candidate = slug;
  for (let i = 2; await db.store.findUnique({ where: { slug: candidate } }); i++) candidate = `${slug}-${i}`;
  return candidate;
}

export async function uniqueProductSlug(storeId: string, base: string, excludeId?: string) {
  const slug = slugify(base) || "producto";
  let candidate = slug;
  for (let i = 2; ; i++) {
    const found = await db.product.findUnique({ where: { storeId_slug: { storeId, slug: candidate } } });
    if (!found || found.id === excludeId) return candidate;
    candidate = `${slug}-${i}`;
  }
}
