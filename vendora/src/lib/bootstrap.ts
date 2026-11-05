import { db } from "./db";
import { DEFAULT_RATES } from "./fx";

/** Planes por defecto (editables desde /admin/planes). */
export const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Gratis",
    description: "Para validar tu primer producto digital.",
    priceUsd: 0,
    commissionBps: 500,
    maxStores: 1,
    aiEbooksPerMonth: 1,
    maxBonusesPerStore: 1,
    maxUpsellsPerStore: 1,
    cartRecovery: false,
    teamRoles: false,
    trialDays: 0,
    sortOrder: 0,
  },
  {
    key: "starter",
    name: "Inicial",
    description: "Para vender todos los días con bonos y upsell.",
    priceUsd: 19,
    commissionBps: 400,
    maxStores: 2,
    aiEbooksPerMonth: 4,
    maxBonusesPerStore: 2,
    maxUpsellsPerStore: 1,
    cartRecovery: false,
    teamRoles: false,
    trialDays: 30,
    sortOrder: 1,
  },
  {
    key: "pro",
    name: "Crecimiento",
    description: "Embudos más largos y recuperación de carritos.",
    priceUsd: 49,
    commissionBps: 300,
    maxStores: 3,
    aiEbooksPerMonth: 8,
    maxBonusesPerStore: 3,
    maxUpsellsPerStore: 2,
    cartRecovery: true,
    teamRoles: false,
    trialDays: 30,
    sortOrder: 2,
  },
  {
    key: "max",
    name: "Escala",
    description: "Varias tiendas y mercados, con tu equipo.",
    priceUsd: 89,
    commissionBps: 200,
    maxStores: 6,
    aiEbooksPerMonth: null,
    maxBonusesPerStore: 5,
    maxUpsellsPerStore: 3,
    cartRecovery: true,
    teamRoles: true,
    trialDays: 30,
    sortOrder: 3,
  },
];

export async function ensurePlans() {
  const count = await db.plan.count();
  if (count > 0) return;
  for (const p of DEFAULT_PLANS) await db.plan.create({ data: p });
}

export async function ensureRates() {
  const count = await db.exchangeRate.count();
  if (count > 0) return;
  for (const [currency, perUsd] of Object.entries(DEFAULT_RATES)) {
    await db.exchangeRate.create({ data: { currency, perUsd, source: "default" } });
  }
}
