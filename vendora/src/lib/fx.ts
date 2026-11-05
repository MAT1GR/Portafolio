import { db } from "./db";
import { num } from "./money";

/** Valores de referencia (unidades por 1 USD). Se pueden editar en /admin/tipos-de-cambio. */
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1, ARS: 1450, EUR: 0.92, BRL: 5.4, MXN: 18.5, CLP: 940, COP: 4000, PEN: 3.75, UYU: 40, GBP: 0.78, CAD: 1.38, AUD: 1.52,
  NZD: 1.68, CHF: 0.86, RON: 4.6, CZK: 23, HUF: 365, PLN: 3.95, BGN: 1.8, SEK: 10.5, NOK: 10.8, DKK: 6.85, TRY: 34, ILS: 3.7,
  ZAR: 18, INR: 84, JPY: 150,
};

export async function perUsd(currency: string) {
  const c = currency.toUpperCase();
  if (c === "USD") return 1;
  const row = await db.exchangeRate.findUnique({ where: { currency: c } });
  return row ? num(row.perUsd) : (DEFAULT_RATES[c] ?? 1);
}

export async function toUsd(amount: number, currency: string) {
  const rate = await perUsd(currency);
  return Math.round((amount / rate) * 100) / 100;
}

/** Convierte entre dos monedas pasando por USD. */
export async function convert(amount: number, from: string, to: string) {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const usd = amount / (await perUsd(from));
  return usd * (await perUsd(to));
}

/** Actualiza las cotizaciones desde FX_API_URL (formato { rates: { ARS: 1450, ... } } con base USD). */
export async function refreshRates() {
  const url = process.env.FX_API_URL;
  if (!url) return { updated: 0, skipped: true };
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`FX API respondió ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  let updated = 0;
  for (const [currency, value] of Object.entries(data.rates ?? {})) {
    if (!(currency in DEFAULT_RATES) || !(value > 0)) continue;
    await db.exchangeRate.upsert({
      where: { currency },
      create: { currency, perUsd: value, source: "api" },
      update: { perUsd: value, source: "api" },
    });
    updated++;
  }
  return { updated, skipped: false };
}
