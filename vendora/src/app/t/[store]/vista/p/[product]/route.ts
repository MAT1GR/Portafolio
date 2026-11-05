import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { countryFromHeaders, pickMarket } from "@/lib/geo";
import { productPrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { customHtmlResponse, escapeHtml, fillTokens } from "@/lib/store-page";

/** Página de producto con HTML propio. */
export async function GET(req: Request, { params }: { params: Promise<{ store: string; product: string }> }) {
  const { store: storeParam, product: slug } = await params;
  const store = await getStoreByParam(storeParam);
  if (!store) return new Response("No encontrado", { status: 404 });
  const product = await db.product.findFirst({
    where: { storeId: store.id, slug, status: "PUBLISHED", visibility: { in: ["PUBLIC", "HIDDEN"] } },
    include: { marketPrices: true },
  });
  if (!product || !product.salesPageHtml) return new Response("No encontrado", { status: 404 });
  const h = await headers();
  const base = await storeBasePath(store.slug);
  const markets = await db.market.findMany({ where: { storeId: store.id, active: true } });
  const cookieMarket = req.headers.get("cookie")?.match(/(?:^|; )vd_market=([^;]+)/)?.[1] ?? null;
  const price = productPrice(product, pickMarket(markets, countryFromHeaders(h), cookieMarket), store.baseCurrency);
  const html = fillTokens(product.salesPageHtml, {
    price: escapeHtml(formatMoney(price.price, price.currency, store.language)),
    compare_price: price.compareAt ? escapeHtml(formatMoney(price.compareAt, price.currency, store.language)) : "",
    currency: escapeHtml(price.currency),
    checkout_url: `${base}/checkout/${product.slug}`,
    product_name: escapeHtml(product.name),
    store_name: escapeHtml(store.name),
  });
  return customHtmlResponse(html, {
    hostMode: h.get("x-vd-host-mode") === "1",
    tracker: {
      storeId: store.id,
      type: "PRODUCT_VIEW",
      productId: product.id,
      pixelId: store.metaPixelId,
      ga4Id: store.ga4Id,
      tiktokId: store.tiktokPixelId,
      value: price.price,
      currency: price.currency,
      contentName: product.name,
    },
  });
}
