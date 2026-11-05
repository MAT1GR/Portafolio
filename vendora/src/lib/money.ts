import type { Prisma } from "@prisma/client";

export type Dec = Prisma.Decimal | number | string | null | undefined;

export function num(d: Dec): number {
  if (d === null || d === undefined || d === "") return 0;
  if (typeof d === "number") return d;
  return Number(d.toString());
}

export function numOrNull(d: Dec): number | null {
  if (d === null || d === undefined || d === "") return null;
  return num(d);
}

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function currencyDecimals(currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function roundMoney(n: number, currency: string) {
  const f = 10 ** currencyDecimals(currency);
  return Math.round((n + Number.EPSILON) * f) / f;
}

export const ROUNDING_MODES = [
  { value: "none", label: "Sin redondeo (2 decimales)" },
  { value: "integer", label: "Entero (18,40 → 18)" },
  { value: "99", label: "Terminar en ,99 (18,40 → 18,99)" },
  { value: "90", label: "Terminar en ,90 (18,40 → 18,90)" },
  { value: "10", label: "Subir a la decena (184 → 190)" },
  { value: "990", label: "Terminar en 990 (18.420 → 18.990)" },
] as const;

export function applyRounding(n: number, mode: string, currency: string) {
  if (n <= 0) return 0;
  const noCents = currencyDecimals(currency) === 0;
  switch (mode) {
    case "integer":
      return Math.round(n);
    case "99":
      // Monedas sin centavos (JPY, CLP…): ,99 no existe → entero.
      return noCents ? Math.round(n) : roundMoney(Math.floor(n) + 0.99, currency);
    case "90":
      return noCents ? Math.round(n) : roundMoney(Math.floor(n) + 0.9, currency);
    case "10":
      return Math.ceil(n / 10) * 10;
    case "990":
      return Math.max(990, Math.ceil((n + 10) / 1000) * 1000 - 10);
    default:
      return roundMoney(n, currency);
  }
}

export const LOCALES: Record<string, string> = {
  es: "es-AR",
  en: "en-US",
  pt: "pt-BR",
  it: "it-IT",
  fr: "fr-FR",
  de: "de-DE",
  ro: "ro-RO",
  cs: "cs-CZ",
  hu: "hu-HU",
  pl: "pl-PL",
};

export function formatMoney(amount: Dec, currency: string, lang = "es") {
  const n = num(amount);
  const d = currencyDecimals(currency);
  const integer = Math.abs(n % 1) < 0.0001;
  try {
    return new Intl.NumberFormat(LOCALES[lang] || lang, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: integer ? 0 : d,
      maximumFractionDigits: d,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(d)}`;
  }
}

export const CURRENCIES = [
  "USD", "ARS", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU", "GBP", "CAD", "AUD", "NZD", "CHF",
  "RON", "CZK", "HUF", "PLN", "BGN", "SEK", "NOK", "DKK", "TRY", "ILS", "ZAR", "INR", "JPY",
];
