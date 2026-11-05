import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { countryFromHeaders, pickMarket } from "@/lib/geo";
import { productPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { customHtmlResponse, escapeHtml, fillTokens } from "@/lib/store-page";

/** Landing con HTML propio (Contenido). Tokens: {{price}} {{compare_price}} {{currency}} {{checkout_url}} {{product_name}} {{store_name}}. */
export async function GET(req: Request, { params }: { params: Promise<{ store: string }> }) {
  const store = await getStoreByParam((await params).store);
  if (!store || !store.landingHtml) return new Response("No encontrado", { status: 404 });
  const h = await headers();
  const hostMode = h.get("x-vd-host-mode") === "1";
  const base = await storeBasePath(store.slug);
  const main = store.mainProductId ? await db.product.findUnique({ where: { id: store.mainProductId }, include: { marketPrices: true } }) : null;
  const markets = await db.market.findMany({ where: { storeId: store.id, active: true } });
  const cookieMarket = req.headers.get("cookie")?.match(/(?:^|; )vd_market=([^;]+)/)?.[1] ?? null;
  const market = pickMarket(markets, countryFromHeaders(h), cookieMarket);
  const price = main ? productPrice(main, market, store.baseCurrency) : null;
  const html = fillTokens(store.landingHtml, {
    price: price ? escapeHtml(formatMoney(price.price, price.currency, store.language)) : "",
    compare_price: price?.compareAt ? escapeHtml(formatMoney(price.compareAt, price.currency, store.language)) : "",
    currency: escapeHtml(price?.currency ?? store.baseCurrency),
    checkout_url: `${base}/checkout`,
    product_name: escapeHtml(main?.name ?? ""),
    store_name: escapeHtml(store.name),
  });
  return customHtmlResponse(html, {
    hostMode,
    tracker: {
      storeId: store.id,
      type: main ? "PRODUCT_VIEW" : "PAGE_VIEW",
      productId: main?.id,
      pixelId: store.metaPixelId,
      ga4Id: store.ga4Id,
      tiktokId: store.tiktokPixelId,
      value: price?.price,
      currency: price?.currency,
      contentName: main?.name,
    },
  });
}
