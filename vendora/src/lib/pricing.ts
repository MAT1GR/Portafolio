import type { CompareAgainst, CouponType, PricingMode } from "@prisma/client";
import { applyRounding, num, numOrNull, roundMoney, type Dec } from "./money";

export type MarketLike = { id: string; currency: string; rate: Dec; rounding: string } | null | undefined;

export type PriceInput = {
  price: Dec;
  compareAtPrice?: Dec;
  marketPrices?: { marketId: string; price: Dec; compareAtPrice: Dec }[];
};

export type Price = { price: number; compareAt: number | null; currency: string };

/** Convierte un monto en moneda base a la moneda del market (con su redondeo). */
export function convertToMarket(amount: number, market: MarketLike, baseCurrency: string) {
  if (!market || market.currency === baseCurrency) return roundMoney(amount, baseCurrency);
  return applyRounding(amount * num(market.rate), market.rounding, market.currency);
}

/** Precio de un producto en un market: precio propio del market o conversión del precio base. */
export function productPrice(product: PriceInput, market: MarketLike, baseCurrency: string): Price {
  const currency = market?.currency ?? baseCurrency;
  const override = market ? product.marketPrices?.find((m) => m.marketId === market.id) : undefined;
  if (override) {
    return { price: num(override.price), compareAt: numOrNull(override.compareAtPrice), currency };
  }
  const base = num(product.price);
  const cmp = numOrNull(product.compareAtPrice);
  return {
    price: convertToMarket(base, market, baseCurrency),
    compareAt: cmp ? convertToMarket(cmp, market, baseCurrency) : null,
    currency,
  };
}

export type OfferPricing = {
  pricingMode: PricingMode;
  discountPercent: number;
  compareAgainst: CompareAgainst;
  fixedPrice?: Dec;
};

/**
 * Precio de una oferta (order bump o upsell).
 * - DISCOUNT: % sobre el precio de tienda o sobre el tachado (según "comparar contra").
 * - FIXED: precio fijo en moneda base convertido al market.
 * El tachado mostrado es la referencia del descuento o, sin descuento, el tachado del producto.
 */
export function offerPrice(product: PriceInput, offer: OfferPricing, market: MarketLike, baseCurrency: string): Price {
  const p = productPrice(product, market, baseCurrency);
  if (offer.pricingMode === "FIXED" && offer.fixedPrice !== null && offer.fixedPrice !== undefined) {
    const price = convertToMarket(num(offer.fixedPrice), market, baseCurrency);
    const ref = p.compareAt && p.compareAt > price ? p.compareAt : p.price > price ? p.price : null;
    return { price, compareAt: ref, currency: p.currency };
  }
  const pct = Math.min(100, Math.max(0, offer.discountPercent || 0));
  const ref = offer.compareAgainst === "COMPARE_AT" ? (p.compareAt ?? p.price) : p.price;
  const price = roundMoney(ref * (1 - pct / 100), p.currency);
  const compareAt = pct > 0 ? ref : p.compareAt && p.compareAt > price ? p.compareAt : null;
  return { price, compareAt, currency: p.currency };
}

export type CouponLike = {
  code: string;
  type: CouponType;
  value: Dec;
  productIds: string[];
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
  usedCount: number;
};

export function couponIsValid(c: CouponLike, productId: string, now = new Date()) {
  if (!c.active) return false;
  if (c.startsAt && c.startsAt > now) return false;
  if (c.endsAt && c.endsAt < now) return false;
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return false;
  if (c.productIds.length && !c.productIds.includes(productId)) return false;
  return true;
}

/** Descuento de un cupón sobre el producto principal (los montos fijos están en moneda base). */
export function couponDiscount(c: CouponLike, mainPrice: number, market: MarketLike, baseCurrency: string, currency: string) {
  const value = num(c.value);
  const d = c.type === "PERCENT" ? mainPrice * (Math.min(100, value) / 100) : convertToMarket(value, market, baseCurrency);
  return roundMoney(Math.min(mainPrice, Math.max(0, d)), currency);
}

export function percentOff(price: number, compareAt: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}
