import type { Funnel, FunnelNode, FunnelNodeVariant, Market, Order, Product, ProductMarketPrice } from "@prisma/client";
import { db } from "./db";
import { num } from "./money";
import { offerPrice, type Price } from "./pricing";

/** Embudo que corresponde al pedido: activo, con nodo inicial y disparador que coincide (mayor prioridad primero). */
export async function pickFunnel(storeId: string, productIds: string[]) {
  const funnels = await db.funnel.findMany({
    where: { storeId, status: "ACTIVE", entryNodeId: { not: null } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return funnels.find((f) => f.trigger === "ALWAYS" || f.triggerProductIds.some((id) => productIds.includes(id))) ?? null;
}

export type NodeWithProduct = FunnelNode & {
  product: Product & { marketPrices: ProductMarketPrice[] };
  variants: FunnelNodeVariant[];
};

export function applyVariant(node: FunnelNode, variant: FunnelNodeVariant | null | undefined) {
  if (!variant) return node;
  return {
    ...node,
    discountPercent: variant.discountPercent ?? node.discountPercent,
    pricingMode: variant.fixedPrice !== null && variant.fixedPrice !== undefined ? ("FIXED" as const) : variant.discountPercent !== null ? ("DISCOUNT" as const) : node.pricingMode,
    fixedPrice: variant.fixedPrice ?? node.fixedPrice,
    title: variant.title || node.title,
    body: variant.body || node.body,
    acceptText: variant.acceptText || node.acceptText,
    customHtml: variant.customHtml || node.customHtml,
    contentMode: variant.customHtml ? ("CUSTOM_HTML" as const) : node.contentMode,
  };
}

export function nodePrice(node: NodeWithProduct, variant: FunnelNodeVariant | null | undefined, market: Market | null, baseCurrency: string): Price {
  const n = applyVariant(node, variant);
  return offerPrice(node.product, { pricingMode: n.pricingMode, discountPercent: n.discountPercent, compareAgainst: n.compareAgainst, fixedPrice: n.fixedPrice }, market, baseCurrency);
}

export async function loadNode(nodeId: string) {
  return db.funnelNode.findUnique({
    where: { id: nodeId },
    include: { product: { include: { marketPrices: true } }, variants: true, funnel: true },
  });
}

/** Crea (una sola vez) la impresión de la oferta, con su variante A/B y el vencimiento de la reserva. */
export async function ensureImpression(order: Order, node: NodeWithProduct & { funnel: Funnel }, market: Market | null, baseCurrency: string) {
  const existing = await db.offerImpression.findUnique({ where: { orderId_nodeId: { orderId: order.id, nodeId: node.id } } });
  if (existing) return existing;
  let variantKey: string | null = null;
  if (node.abTestActive && node.variants.length >= 2) variantKey = Math.random() < 0.5 ? "A" : "B";
  const variant = node.variants.find((v) => v.key === variantKey);
  const price = nodePrice(node, variant, market, baseCurrency);
  try {
    return await db.offerImpression.create({
      data: {
        orderId: order.id,
        nodeId: node.id,
        variantKey,
        price: price.price,
        currency: price.currency,
        expiresAt: new Date(Date.now() + Math.max(1, node.funnel.reservationMinutes) * 60_000),
      },
    });
  } catch {
    return db.offerImpression.findUniqueOrThrow({ where: { orderId_nodeId: { orderId: order.id, nodeId: node.id } } });
  }
}

/** Mueve el pedido al siguiente nodo del embudo (o lo termina). */
export async function advance(orderId: string, nextNodeId: string | null) {
  if (nextNodeId) {
    const exists = await db.funnelNode.findUnique({ where: { id: nextNodeId }, select: { id: true } });
    if (exists) {
      await db.order.update({ where: { id: orderId }, data: { currentNodeId: nextNodeId } });
      return nextNodeId;
    }
  }
  await db.order.update({ where: { id: orderId }, data: { currentNodeId: null, funnelDone: true } });
  return null;
}

export type NodeStats = { nodeId: string; variant: string | null; views: number; accepted: number; revenue: number; rate: number; perView: number };

/** Estadísticas por oferta (y por variante) desde el último reinicio. */
export async function funnelStats(funnel: Pick<Funnel, "id" | "statsResetAt">): Promise<NodeStats[]> {
  const rows = await db.offerImpression.findMany({
    where: { node: { funnelId: funnel.id }, ...(funnel.statsResetAt ? { shownAt: { gte: funnel.statsResetAt } } : {}), order: { testMode: false } },
    select: { nodeId: true, variantKey: true, result: true, revenue: true },
  });
  const map = new Map<string, NodeStats>();
  const bump = (nodeId: string, variant: string | null, r: (typeof rows)[number]) => {
    const key = `${nodeId}|${variant ?? "*"}`;
    const s = map.get(key) ?? { nodeId, variant, views: 0, accepted: 0, revenue: 0, rate: 0, perView: 0 };
    s.views++;
    if (r.result === "ACCEPTED") {
      s.accepted++;
      s.revenue += num(r.revenue);
    }
    map.set(key, s);
  };
  for (const r of rows) {
    bump(r.nodeId, null, r);
    if (r.variantKey) bump(r.nodeId, r.variantKey, r);
  }
  return [...map.values()].map((s) => ({ ...s, rate: s.views ? s.accepted / s.views : 0, perView: s.views ? s.revenue / s.views : 0 }));
}

/** Sugerencia de ganador A/B: cada versión con ≥7 días y ≥30 cobros; gana el mayor facturado por vista. */
export function abWinner(stats: NodeStats[], nodeId: string, startedAt: Date | null) {
  const a = stats.find((s) => s.nodeId === nodeId && s.variant === "A");
  const b = stats.find((s) => s.nodeId === nodeId && s.variant === "B");
  const days = startedAt ? (Date.now() - startedAt.getTime()) / 86400_000 : 0;
  const ready = Boolean(a && b && days >= 7 && a.accepted >= 30 && b.accepted >= 30);
  if (!a || !b) return { ready: false, winner: null as string | null, days, a, b };
  return { ready, winner: ready ? (a.perView >= b.perView ? "A" : "B") : null, days, a, b };
}
