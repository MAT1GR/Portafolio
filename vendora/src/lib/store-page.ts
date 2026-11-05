import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Market, ProductFile, Store } from "@prisma/client";
import { db } from "./db";
import { dict } from "./i18n";
import { countryFromHeaders, pickMarket } from "./geo";
import { getStoreByParam, storeBasePath } from "./stores";
import { isS3, readLocal, safeName, signedDownloadUrl } from "./storage";
import { trackerScript, type TrackerConfig } from "./tracker";

export async function storeContext(param: string) {
  const store = await getStoreByParam(param);
  if (!store) notFound();
  const h = await headers();
  return { store, base: await storeBasePath(store.slug), country: countryFromHeaders(h), d: dict(store.language), hostMode: h.get("x-vd-host-mode") === "1" };
}

/** Market del visitante (cookie elegida en el checkout → país → predeterminado). */
export async function resolveMarket(store: Store, requested?: string | null): Promise<Market | null> {
  const markets = await db.market.findMany({ where: { storeId: store.id, active: true } });
  const jar = await cookies();
  const h = await headers();
  return pickMarket(markets, countryFromHeaders(h), requested || jar.get("vd_market")?.value || null);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Reemplaza tokens {{x}} en HTML propio (valores escapados). */
export function fillTokens(html: string, tokens: Record<string, string>) {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => (k.toLowerCase() in tokens ? tokens[k.toLowerCase()] : m));
}

/** Respuesta HTML para páginas con HTML propio del vendedor (landing, producto, oferta). */
export function customHtmlResponse(html: string, opts: { tracker?: TrackerConfig; hostMode: boolean; extraScript?: string }) {
  const scripts = `${opts.tracker ? `<script>${trackerScript(opts.tracker)}</script>` : ""}${opts.extraScript ? `<script>${opts.extraScript}</script>` : ""}`;
  let body = html;
  if (!/<html[\s>]/i.test(body)) {
    body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`;
  }
  body = /<\/body>/i.test(body) ? body.replace(/<\/body>/i, `${scripts}</body>`) : `${body}${scripts}`;
  const headersInit: Record<string, string> = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  // En modo ruta (mismo dominio que el panel) el HTML del vendedor corre aislado del panel.
  if (!opts.hostMode) headersInit["Content-Security-Policy"] = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-modals";
  return new Response(body, { headers: headersInit });
}

/** Entrega un archivo de producto: link externo, URL firmada (S3) o stream (disco). */
export async function serveProductFile(file: ProductFile) {
  if (file.kind === "LINK" && file.url) return Response.redirect(file.url, 302);
  if (!file.storageKey) return new Response("Archivo no disponible", { status: 404 });
  if (isS3()) return Response.redirect(await signedDownloadUrl(file.storageKey, file.name), 302);
  const local = await readLocal(file.storageKey);
  if (!local) return new Response("Archivo no disponible", { status: 404 });
  return new Response(local.stream, {
    headers: {
      "Content-Type": file.mimeType || local.contentType,
      "Content-Length": String(local.size),
      "Content-Disposition": `attachment; filename="${safeName(file.name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function simpleHtmlPage(title: string, message: string, link?: { href: string; text: string }) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;background:#fbfaf8;color:#1c1a22;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px"><div style="max-width:420px;text-align:center"><h1 style="font-size:22px">${escapeHtml(title)}</h1><p style="color:#5d576b;line-height:1.5">${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link.href)}" style="color:#1c1a22;font-weight:600">${escapeHtml(link.text)} →</a></p>` : ""}</div></body></html>`,
    { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
