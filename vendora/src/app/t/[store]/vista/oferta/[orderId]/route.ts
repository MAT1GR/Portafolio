import { headers } from "next/headers";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { getOfferState } from "@/lib/funnels";
import { formatMoney } from "@/lib/money";
import { customHtmlResponse, escapeHtml, fillTokens } from "@/lib/store-page";

/**
 * Oferta post-compra con HTML propio (ruleta, trivia, etc.).
 * Tokens: {{accept_url}} {{decline_url}} {{price}} {{compare_price}} {{timer}} {{product_name}} {{email}} {{expires_at}}.
 */
export async function GET(req: Request, { params }: { params: Promise<{ store: string; orderId: string }> }) {
  const { store: storeParam, orderId } = await params;
  const store = await getStoreByParam(storeParam);
  if (!store) return new Response("No encontrado", { status: 404 });
  const k = new URL(req.url).searchParams.get("k");
  const base = await storeBasePath(store.slug);
  const state = await getOfferState(orderId, k);
  if ("error" in state || state.order.storeId !== store.id) return new Response("No encontrado", { status: 404 });
  if (state.done) return Response.redirect(new URL(`${base}/gracias/${orderId}?k=${k}`, req.url), 303);
  if (!state.node.customHtml) return Response.redirect(new URL(`${base}/oferta/${orderId}?k=${k}&accion=`, req.url), 303);
  const fmt = (n: number) => escapeHtml(formatMoney(n, state.currency, store.language));
  const expiresAt = Date.now() + state.remainingMs;
  const offerUrl = `${base}/oferta/${orderId}?k=${encodeURIComponent(k!)}`;
  const html = fillTokens(state.node.customHtml, {
    accept_url: `${offerUrl}&accion=aceptar&n=${state.node.id}`,
    decline_url: `${offerUrl}&accion=rechazar&n=${state.node.id}`,
    price: fmt(state.price),
    compare_price: state.compareAt ? fmt(state.compareAt) : "",
    timer: `<span data-vd-timer="${expiresAt}">--:--</span>`,
    expires_at: String(expiresAt),
    product_name: escapeHtml(state.product.name),
    email: escapeHtml(state.order.email),
  });
  const timerScript = `(function(){function f(ms){var s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),x=s%60;return(m<10?'0':'')+m+':'+(x<10?'0':'')+x}function t(){var done=false;document.querySelectorAll('[data-vd-timer]').forEach(function(el){var left=Number(el.getAttribute('data-vd-timer'))-Date.now();el.textContent=f(left);if(left<=0)done=true});if(done){location.href=${JSON.stringify(offerUrl)};return}setTimeout(t,1000)}t()})();`;
  const h = await headers();
  return customHtmlResponse(html, {
    hostMode: h.get("x-vd-host-mode") === "1",
    extraScript: state.remainingMs > 0 ? timerScript : undefined,
    tracker: { storeId: store.id, type: "PAGE_VIEW", pixelId: store.metaPixelId, ga4Id: store.ga4Id, tiktokId: store.tiktokPixelId, skipEvent: true },
  });
}
