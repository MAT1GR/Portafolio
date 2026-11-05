import { Prisma } from "@prisma/client";
import { db } from "./db";
import { perUsd } from "./fx";
import { num, roundMoney } from "./money";
import { asUtm } from "./tracking";

export type Range = { from: Date; to: Date };

export const PRESETS: Record<string, string> = { today: "Hoy", yesterday: "Ayer", "7d": "Últimos 7 días", "30d": "Últimos 30 días", month: "Este mes", custom: "Personalizado" };

/** Inicio del día en una zona horaria, como Date UTC. */
export function startOfDayTz(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const guess = new Date(`${parts}T00:00:00Z`);
  const offset = tzOffsetMs(guess, tz);
  return new Date(guess.getTime() - offset);
}

function tzOffsetMs(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - date.getTime();
}

export function dayKey(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function parseRange(preset: string | undefined, fromStr: string | undefined, toStr: string | undefined, tz: string) {
  const now = new Date();
  const today = startOfDayTz(now, tz);
  let from: Date;
  let to: Date = new Date(now.getTime() + 1000);
  const key = preset && PRESETS[preset] ? preset : "30d";
  switch (key) {
    case "today":
      from = today;
      break;
    case "yesterday":
      from = new Date(today.getTime() - 86400_000);
      to = today;
      break;
    case "7d":
      from = new Date(today.getTime() - 6 * 86400_000);
      break;
    case "month": {
      const d = dayKey(now, tz).slice(0, 8) + "01";
      from = startOfDayTz(new Date(`${d}T12:00:00Z`), tz);
      break;
    }
    case "custom": {
      const f = fromStr ? new Date(`${fromStr}T12:00:00Z`) : null;
      const t = toStr ? new Date(`${toStr}T12:00:00Z`) : null;
      from = f && !Number.isNaN(f.getTime()) ? startOfDayTz(f, tz) : new Date(today.getTime() - 29 * 86400_000);
      to = t && !Number.isNaN(t.getTime()) ? new Date(startOfDayTz(t, tz).getTime() + 86400_000) : to;
      break;
    }
    default:
      from = new Date(today.getTime() - 29 * 86400_000);
  }
  const span = to.getTime() - from.getTime();
  return { key, from, to, prev: { from: new Date(from.getTime() - span), to: from } };
}

async function converter(target: string) {
  const cache = new Map<string, number>();
  const targetRate = await perUsd(target);
  return async (amount: number, currency: string) => {
    if (currency === target) return amount;
    if (!cache.has(currency)) cache.set(currency, await perUsd(currency));
    return (amount / cache.get(currency)!) * targetRate;
  };
}

const VISIT_TYPES = Prisma.sql`('PAGE_VIEW','PRODUCT_VIEW','CHECKOUT_VIEW')`;

async function distinctVisitors(storeIds: string[], range: Range, onlyCheckout = false) {
  const types = onlyCheckout ? Prisma.sql`('CHECKOUT_VIEW')` : VISIT_TYPES;
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT "visitorId")::int AS n FROM "AnalyticsEvent"
    WHERE "storeId" = ANY(${storeIds}) AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to} AND "type"::text IN ${types}`;
  return rows[0]?.n ?? 0;
}

export type Summary = {
  revenue: number;
  sales: number;
  avgTicket: number;
  visits: number;
  checkoutViews: number;
  paymentsInitiated: number;
  conversion: number;
  checkoutConversion: number;
  bumpRevenue: number;
  offerRevenue: number;
};

export async function summary(storeIds: string[], range: Range, currency: string): Promise<Summary> {
  const conv = await converter(currency);
  const [payments, sales, visits, checkoutViews, paymentsInitiated, bumpItems] = await Promise.all([
    db.payment.findMany({
      where: { status: "APPROVED", approvedAt: { gte: range.from, lt: range.to }, order: { storeId: { in: storeIds }, testMode: false } },
      select: { amount: true, currency: true, kind: true },
    }),
    db.order.count({ where: { storeId: { in: storeIds }, testMode: false, paidAt: { gte: range.from, lt: range.to } } }),
    distinctVisitors(storeIds, range),
    distinctVisitors(storeIds, range, true),
    db.order.count({ where: { storeId: { in: storeIds }, testMode: false, createdAt: { gte: range.from, lt: range.to } } }),
    db.orderItem.findMany({
      where: { kind: "BUMP", status: "PAID", order: { storeId: { in: storeIds }, testMode: false, paidAt: { gte: range.from, lt: range.to } } },
      select: { total: true, order: { select: { currency: true } } },
    }),
  ]);
  let revenue = 0;
  let offerRevenue = 0;
  for (const p of payments) {
    const v = await conv(num(p.amount), p.currency);
    revenue += v;
    if (p.kind === "OFFER") offerRevenue += v;
  }
  let bumpRevenue = 0;
  for (const i of bumpItems) bumpRevenue += await conv(num(i.total), i.order.currency);
  return {
    revenue: roundMoney(revenue, currency),
    sales,
    avgTicket: sales ? roundMoney(revenue / sales, currency) : 0,
    visits,
    checkoutViews,
    paymentsInitiated,
    conversion: visits ? sales / visits : 0,
    checkoutConversion: paymentsInitiated ? sales / paymentsInitiated : 0,
    bumpRevenue: roundMoney(bumpRevenue, currency),
    offerRevenue: roundMoney(offerRevenue, currency),
  };
}

export async function dailySeries(storeIds: string[], range: Range, currency: string, tz: string) {
  const conv = await converter(currency);
  const payments = await db.payment.findMany({
    where: { status: "APPROVED", approvedAt: { gte: range.from, lt: range.to }, order: { storeId: { in: storeIds }, testMode: false } },
    select: { amount: true, currency: true, approvedAt: true, kind: true },
  });
  const days = new Map<string, { date: string; revenue: number; sales: number }>();
  for (let t = range.from.getTime(); t < range.to.getTime(); t += 86400_000) {
    const k = dayKey(new Date(t + 3600_000), tz);
    days.set(k, { date: k, revenue: 0, sales: 0 });
  }
  for (const p of payments) {
    const k = dayKey(p.approvedAt!, tz);
    const d = days.get(k) ?? { date: k, revenue: 0, sales: 0 };
    d.revenue += await conv(num(p.amount), p.currency);
    if (p.kind === "INITIAL") d.sales++;
    days.set(k, d);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, revenue: roundMoney(d.revenue, currency) }));
}

export const UTM_DIMENSIONS = { campaign: "Campaña", source: "Fuente", medium: "Medio", content: "Anuncio (content)", term: "Término" } as const;
export type UtmDim = keyof typeof UTM_DIMENSIONS;

const UTM_COLUMNS: Record<UtmDim, Prisma.Sql> = {
  campaign: Prisma.sql`"utmCampaign"`,
  source: Prisma.sql`"utmSource"`,
  medium: Prisma.sql`"utmMedium"`,
  content: Prisma.sql`"utmContent"`,
  term: Prisma.sql`"utmTerm"`,
};

export async function utmTable(storeIds: string[], range: Range, currency: string, dim: UtmDim = "campaign") {
  const col = UTM_COLUMNS[dim];
  const visitRows = await db.$queryRaw<{ k: string | null; visits: number; checkouts: number }[]>`
    SELECT ${col} AS k,
      COUNT(DISTINCT CASE WHEN "type"::text IN ${VISIT_TYPES} THEN "visitorId" END)::int AS visits,
      COUNT(DISTINCT CASE WHEN "type"::text = 'CHECKOUT_VIEW' THEN "visitorId" END)::int AS checkouts
    FROM "AnalyticsEvent"
    WHERE "storeId" = ANY(${storeIds}) AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to}
    GROUP BY 1`;
  const conv = await converter(currency);
  const payments = await db.payment.findMany({
    where: { status: "APPROVED", approvedAt: { gte: range.from, lt: range.to }, order: { storeId: { in: storeIds }, testMode: false } },
    select: { amount: true, currency: true, kind: true, order: { select: { utm: true } } },
  });
  const map = new Map<string, { key: string; visits: number; checkouts: number; sales: number; revenue: number }>();
  const get = (k: string) => map.get(k) ?? { key: k, visits: 0, checkouts: 0, sales: 0, revenue: 0 };
  for (const r of visitRows) {
    const k = r.k || "(directo / sin UTM)";
    const e = get(k);
    e.visits += r.visits;
    e.checkouts += r.checkouts;
    map.set(k, e);
  }
  for (const p of payments) {
    const k = asUtm(p.order.utm)[dim] || "(directo / sin UTM)";
    const e = get(k);
    e.revenue += await conv(num(p.amount), p.currency);
    if (p.kind === "INITIAL") e.sales++;
    map.set(k, e);
  }
  return [...map.values()]
    .map((e) => ({ ...e, revenue: roundMoney(e.revenue, currency), conversion: e.visits ? e.sales / e.visits : 0 }))
    .sort((a, b) => b.revenue - a.revenue || b.visits - a.visits)
    .slice(0, 50);
}

export async function topProducts(storeIds: string[], range: Range, currency: string) {
  const conv = await converter(currency);
  const items = await db.orderItem.findMany({
    where: { status: "PAID", kind: { not: "BONUS" }, order: { storeId: { in: storeIds }, testMode: false, paidAt: { gte: range.from, lt: range.to } } },
    select: { productId: true, name: true, total: true, kind: true, order: { select: { currency: true } } },
  });
  const map = new Map<string, { productId: string; name: string; units: number; revenue: number }>();
  for (const i of items) {
    const e = map.get(i.productId) ?? { productId: i.productId, name: i.name, units: 0, revenue: 0 };
    e.units++;
    e.revenue += await conv(num(i.total), i.order.currency);
    map.set(i.productId, e);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((e) => ({ ...e, revenue: roundMoney(e.revenue, currency) }));
}

export async function cartStats(storeIds: string[], range: Range) {
  const [abandoned, recovered, open] = await Promise.all([
    db.checkout.count({ where: { storeId: { in: storeIds }, status: "ABANDONED", emailCapturedAt: { gte: range.from, lt: range.to } } }),
    db.checkout.count({ where: { storeId: { in: storeIds }, status: "RECOVERED", emailCapturedAt: { gte: range.from, lt: range.to } } }),
    db.checkout.count({ where: { storeId: { in: storeIds }, status: "OPEN", emailCapturedAt: { gte: range.from, lt: range.to } } }),
  ]);
  return { abandoned, recovered, open, recoveryRate: abandoned + recovered ? recovered / (abandoned + recovered) : 0 };
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}
