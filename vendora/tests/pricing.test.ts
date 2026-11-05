import { describe, expect, it } from "vitest";
import { convertToMarket, couponDiscount, couponIsValid, offerPrice, percentOff, productPrice, type CouponLike } from "@/lib/pricing";

const ars = { id: "m-ar", currency: "ARS", rate: 1450, rounding: "990" };
const eur = { id: "m-eu", currency: "EUR", rate: 0.92, rounding: "99" };
const product = { price: 12.99, compareAtPrice: 24.99, marketPrices: [{ marketId: "m-eu", price: 9.99, compareAtPrice: 19.99 }] };

describe("precios por market", () => {
  it("convierte el precio base con tipo de cambio y redondeo del market", () => {
    expect(convertToMarket(12.99, ars, "USD")).toBe(18990);
    expect(productPrice(product, ars, "USD")).toEqual({ price: 18990, compareAt: 36990, currency: "ARS" });
  });
  it("respeta el precio propio cargado para el market", () => {
    expect(productPrice(product, eur, "USD")).toEqual({ price: 9.99, compareAt: 19.99, currency: "EUR" });
  });
  it("sin market usa la moneda base", () => {
    expect(productPrice(product, null, "USD")).toEqual({ price: 12.99, compareAt: 24.99, currency: "USD" });
  });
});

describe("precio de ofertas (bump / upsell)", () => {
  it("descuento sobre el precio de tienda y muestra ese precio tachado", () => {
    const p = offerPrice({ price: 9.99 }, { pricingMode: "DISCOUNT", discountPercent: 50, compareAgainst: "STORE_PRICE" }, null, "USD");
    expect(p).toEqual({ price: 5, compareAt: 9.99, currency: "USD" });
  });
  it("descuento sobre el precio tachado", () => {
    const p = offerPrice({ price: 19, compareAtPrice: 29 }, { pricingMode: "DISCOUNT", discountPercent: 20, compareAgainst: "COMPARE_AT" }, null, "USD");
    expect(p.price).toBe(23.2);
    expect(p.compareAt).toBe(29);
  });
  it("precio fijo convertido al market", () => {
    const p = offerPrice({ price: 19 }, { pricingMode: "FIXED", discountPercent: 0, compareAgainst: "STORE_PRICE", fixedPrice: 7 }, ars, "USD");
    expect(p.price).toBe(10990);
    expect(p.currency).toBe("ARS");
    expect(p.compareAt).toBe(27990);
  });
  it("el descuento nunca supera el 100 %", () => {
    expect(offerPrice({ price: 10 }, { pricingMode: "DISCOUNT", discountPercent: 150, compareAgainst: "STORE_PRICE" }, null, "USD").price).toBe(0);
  });
  it("porcentaje de ahorro", () => {
    expect(percentOff(12.99, 24.99)).toBe(48);
    expect(percentOff(10, null)).toBe(0);
    expect(percentOff(10, 8)).toBe(0);
  });
});

describe("cupones", () => {
  const base: CouponLike = { code: "BIENVENIDA10", type: "PERCENT", value: 10, productIds: [], active: true, startsAt: null, endsAt: null, maxUses: null, usedCount: 0 };
  it("validez por estado, fechas, usos y productos", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(couponIsValid(base, "p1", now)).toBe(true);
    expect(couponIsValid({ ...base, active: false }, "p1", now)).toBe(false);
    expect(couponIsValid({ ...base, startsAt: new Date("2026-12-01") }, "p1", now)).toBe(false);
    expect(couponIsValid({ ...base, endsAt: new Date("2026-11-01") }, "p1", now)).toBe(false);
    expect(couponIsValid({ ...base, maxUses: 3, usedCount: 3 }, "p1", now)).toBe(false);
    expect(couponIsValid({ ...base, productIds: ["p2"] }, "p1", now)).toBe(false);
    expect(couponIsValid({ ...base, productIds: ["p1"] }, "p1", now)).toBe(true);
  });
  it("porcentaje sobre el producto principal", () => {
    expect(couponDiscount(base, 12.99, null, "USD", "USD")).toBe(1.3);
  });
  it("monto fijo en moneda base convertido y nunca mayor al precio", () => {
    expect(couponDiscount({ ...base, type: "FIXED", value: 2 }, 18990, ars, "USD", "ARS")).toBe(2990);
    expect(couponDiscount({ ...base, type: "FIXED", value: 50 }, 12.99, null, "USD", "USD")).toBe(12.99);
  });
});
