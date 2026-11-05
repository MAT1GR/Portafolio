import type { Plan } from "@prisma/client";
import { db } from "./db";

export class LimitError extends Error {}

export async function getStoreOwnerPlan(storeId: string) {
  const store = await db.store.findUniqueOrThrow({ where: { id: storeId }, include: { owner: { include: { plan: true } } } });
  return store.owner.plan;
}

/** Tiendas que cuentan para el límite del plan: las cerradas (con ventas, se conservan por historial) no cuentan. */
export function ownedStoreCount(userId: string) {
  return db.store.count({ where: { ownerId: userId, OR: [{ suspendedReason: null }, { NOT: { suspendedReason: "closed" } }] } });
}

export async function assertCanCreateStore(userId: string, plan: Plan) {
  const count = await ownedStoreCount(userId);
  if (count >= plan.maxStores) {
    throw new LimitError(`Tu plan ${plan.name} permite ${plan.maxStores} tienda(s). Pasate a un plan superior para crear más.`);
  }
}

export async function bonusCount(storeId: string) {
  return db.productBonus.count({ where: { product: { storeId } } });
}

export async function assertBonusLimit(storeId: string) {
  const plan = await getStoreOwnerPlan(storeId);
  const used = await bonusCount(storeId);
  if (used >= plan.maxBonusesPerStore) {
    throw new LimitError(`Tu plan permite ${plan.maxBonusesPerStore} bono(s) por tienda (${used}/${plan.maxBonusesPerStore}).`);
  }
}

/** Productos distintos usados como ofertas post-compra en la tienda (así cuenta el límite de upsells). */
export async function upsellProducts(storeId: string) {
  const nodes = await db.funnelNode.findMany({ where: { funnel: { storeId } }, select: { productId: true } });
  return new Set(nodes.map((n) => n.productId));
}

export async function assertUpsellLimit(storeId: string, productId: string) {
  const plan = await getStoreOwnerPlan(storeId);
  const used = await upsellProducts(storeId);
  if (used.has(productId)) return;
  if (used.size >= plan.maxUpsellsPerStore) {
    throw new LimitError(
      `Tu plan permite ${plan.maxUpsellsPerStore} producto(s) de upsell por tienda (${used.size}/${plan.maxUpsellsPerStore}). Reutilizá un producto ya usado o mejorá tu plan.`,
    );
  }
}

export function monthStart(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function aiEbooksUsed(userId: string) {
  return db.aiJob.count({
    where: { userId, kind: "EBOOK", countsQuota: true, status: { not: "FAILED" }, createdAt: { gte: monthStart() } },
  });
}

export async function assertAiEbookQuota(userId: string, plan: Plan) {
  if (plan.aiEbooksPerMonth === null) return;
  const used = await aiEbooksUsed(userId);
  if (used >= plan.aiEbooksPerMonth) {
    throw new LimitError(
      plan.aiEbooksPerMonth === 0
        ? `Tu plan ${plan.name} no incluye ebooks con IA.`
        : `Llegaste al límite de ${plan.aiEbooksPerMonth} ebooks con IA de este mes.`,
    );
  }
}

export function planFeatures(plan: Plan) {
  return [
    `${plan.maxStores} ${plan.maxStores === 1 ? "tienda" : "tiendas"} (con IA)`,
    plan.aiEbooksPerMonth === null ? "Ebooks con IA sin límite" : plan.aiEbooksPerMonth === 0 ? "Sin ebooks con IA" : `${plan.aiEbooksPerMonth} ebooks con IA por mes`,
    `${plan.maxBonusesPerStore} ${plan.maxBonusesPerStore === 1 ? "bono" : "bonos"} por tienda`,
    `${plan.maxUpsellsPerStore} ${plan.maxUpsellsPerStore === 1 ? "upsell" : "upsells"} por tienda`,
    "Checkout, order bumps y entrega automática",
    "Métricas, UTM, píxel y API de conversiones",
    plan.cartRecovery ? "Recuperación de carritos" : null,
    plan.teamRoles ? "Equipo con roles" : null,
    `Comisión ${(plan.commissionBps / 100).toLocaleString("es-AR")} % por venta (0 % en PayPal y transferencia)`,
  ].filter(Boolean) as string[];
}
