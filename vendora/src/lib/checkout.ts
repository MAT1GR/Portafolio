import type { PaymentGateway, Store } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { chargeFor, GATEWAYS } from "./gateways";
import { abVariantData, loadCheckoutProduct, quoteCheckout } from "./orders";
import { pickMarket } from "./geo";
import { offerPrice, productPrice } from "./pricing";
import { getCheckoutSettings } from "./store-settings";

export type GatewayOption = { provider: PaymentGateway["provider"]; label: string; chargeCurrency: string; chargeAmount: number; converted: boolean };

export async function availableGateways(store: Store & { gateways: PaymentGateway[] }, currency: string, total: number): Promise<GatewayOption[]> {
  const out: GatewayOption[] = [];
  for (const g of [...store.gateways].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!g.enabled) continue;
    if (g.provider === "TEST" && !(store.testMode && env.allowTestPayments)) continue;
    const c = await chargeFor(g, currency, total);
    if (!c) continue;
    out.push({ provider: g.provider, label: g.displayName || GATEWAYS[g.provider].label, chargeCurrency: c.currency, chargeAmount: c.amount, converted: c.currency !== currency });
  }
  return out;
}

/** Datos iniciales del checkout (render en servidor). */
export async function loadCheckoutPage(opts: {
  store: Store;
  productId: string;
  country: string | null;
  marketId?: string | null;
  abCookie?: (testId: string) => string | undefined;
  couponCode?: string | null;
  prefill?: { email?: string | null; name?: string | null };
}) {
  const store = await db.store.findUniqueOrThrow({ where: { id: opts.store.id }, include: { markets: true, gateways: true } });
  const product = await loadCheckoutProduct(store.id, opts.productId);
  if (!product) return null;
  const market = (opts.marketId ? store.markets.find((m) => m.id === opts.marketId && m.active) : null) ?? pickMarket(store.markets, opts.country);

  // Test A/B de checkout (solo tiendas tipo Checkout): variante fija por visitante (cookie).
  let ab: { testId: string; variant: "A" | "B" } | null = null;
  if (store.type === "CHECKOUT") {
    const test = await db.checkoutTest.findFirst({ where: { storeId: store.id, productId: product.id, active: true }, orderBy: { createdAt: "desc" } });
    if (test) {
      const fromCookie = opts.abCookie?.(test.id);
      ab = { testId: test.id, variant: fromCookie === "A" || fromCookie === "B" ? fromCookie : Math.random() < 0.5 ? "A" : "B" };
    }
  }
  const abTest = ab ? await db.checkoutTest.findUnique({ where: { id: ab.testId } }) : null;
  const override = abVariantData(abTest, ab?.variant);
  const quote = await quoteCheckout({ store, product, market, bumps: product.bumpsAsMain, selectedBumpIds: [], couponCode: opts.couponCode, ab: override });
  const gateways = await availableGateways(store, quote.currency, quote.total);
  const bumps = override?.showBumps === false ? [] : product.bumpsAsMain.map((b) => ({ bump: b, price: offerPrice(b.offerProduct, b, market, store.baseCurrency) }));
  const bonusList = product.bonuses.map((b) => ({ id: b.bonusProductId, name: b.bonusProduct.name, imageUrl: b.bonusProduct.imageUrl, value: productPrice({ price: b.bonusProduct.price, compareAtPrice: b.bonusProduct.compareAtPrice }, market, store.baseCurrency) }));
  return {
    store,
    product,
    market,
    markets: store.markets.filter((m) => m.active),
    quote,
    gateways,
    bumps,
    bonusList,
    ab,
    override,
    settings: getCheckoutSettings(store),
  };
}
