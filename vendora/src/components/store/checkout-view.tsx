import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Store } from "@prisma/client";
import { loadCheckoutPage } from "@/lib/checkout";
import { dict } from "@/lib/i18n";
import { CheckoutClient } from "./checkout-client";
import { StoreFooter, StoreHeader, Tracker, Unavailable } from "./chrome";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? undefined;

/** Página de checkout de un producto (usada por /checkout, /checkout/[producto] y tiendas tipo Checkout). */
export async function CheckoutView({ store, productId, base, country, search }: { store: Store; productId: string; base: string; country: string | null; search: Search }) {
  if (store.status !== "ACTIVE") return <Unavailable store={store} />;
  const jar = await cookies();
  const data = await loadCheckoutPage({
    store,
    productId,
    country,
    marketId: one(search.market) || jar.get("vd_market")?.value || null,
    abCookie: (testId) => jar.get(`vd_ab_${testId}`)?.value,
    couponCode: one(search.cupon) || null,
  });
  if (!data) notFound();
  const d = dict(store.language);
  const { product, quote, override } = data;
  const mainCompare = quote.main.compareAt && quote.main.compareAt > quote.main.price ? quote.main.compareAt : null;
  const bumpIds = (one(search.bumps) || "").split(",").filter((id) => data.bumps.some((b) => b.bump.id === id));

  return (
    <>
      <StoreHeader store={store} base={base} minimal />
      <Tracker
        storeId={store.id}
        type="CHECKOUT_VIEW"
        productId={product.id}
        pixelId={store.metaPixelId}
        ga4Id={store.ga4Id}
        tiktokId={store.tiktokPixelId}
        value={quote.total}
        currency={quote.currency}
        abVariant={data.ab?.variant ?? null}
      />
      <CheckoutClient
        storeId={store.id}
        productId={product.id}
        lang={store.language}
        d={d}
        currency={quote.currency}
        marketId={data.market?.id ?? null}
        markets={data.markets.map((m) => ({ id: m.id, name: m.name, currency: m.currency }))}
        product={{
          name: override?.title || product.checkoutTitle || product.name,
          subtitle: override?.subtitle || product.checkoutSubtitle || product.shortDescription,
          imageUrl: product.imageUrl,
          deliveryNotice: product.deliveryNotice,
        }}
        main={{ price: quote.main.price, compareAt: mainCompare }}
        bonuses={data.bonusList.map((b) => ({ name: b.name, imageUrl: b.imageUrl, value: b.value.compareAt || b.value.price || null }))}
        bumps={data.bumps.map(({ bump, price }) => ({
          id: bump.id,
          name: bump.offerProduct.name,
          headline: bump.headline,
          description: bump.description,
          buttonText: bump.buttonText,
          imageUrl: bump.imageUrl || bump.offerProduct.imageUrl,
          price: price.price,
          compareAt: price.compareAt,
          timerEnabled: bump.timerEnabled,
          timerMinutes: bump.timerMinutes,
        }))}
        quote={{ subtotal: quote.subtotal, discount: quote.discount, total: quote.total, coupon: quote.coupon }}
        gateways={data.gateways}
        settings={{ ...data.settings, buttonText: override?.buttonText || data.settings.buttonText }}
        guaranteeDays={store.guaranteeDays}
        ab={data.ab}
        prefill={{
          email: one(search.email),
          name: one(search.nombre),
          coupon: one(search.cupon),
          bumpIds,
          checkoutId: one(search.checkout),
        }}
      />
      <StoreFooter store={store} base={base} />
    </>
  );
}
