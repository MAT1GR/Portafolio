"use server";

import { revalidatePath } from "next/cache";
import type { CompareAgainst, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { assertUpsellLimit, getStoreOwnerPlan, upsellProducts } from "@/lib/plans";
import { copyFunnel } from "@/lib/duplicate";

async function funnelOf(storeId: string, funnelId: string) {
  const f = await db.funnel.findFirst({ where: { id: funnelId, storeId } });
  if (!f) throw new UserError("Embudo no encontrado");
  return f;
}

const refresh = (storeId: string, funnelId?: string) => {
  revalidatePath(`/panel/${storeId}/embudos`);
  if (funnelId) revalidatePath(`/panel/${storeId}/embudos/${funnelId}`);
};

function thankYou(fd: FormData): Prisma.InputJsonValue | undefined {
  const o = { title: form.str(fd, "tyTitle", 200), message: form.str(fd, "tyMessage", 1000), buttonText: form.str(fd, "tyButton", 80), buttonUrl: form.str(fd, "tyButtonUrl", 1000), redirectUrl: form.str(fd, "tyRedirect", 1000) };
  return Object.values(o).some(Boolean) ? o : undefined;
}

export async function createFunnelAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const f = await db.funnel.create({
      data: {
        storeId,
        name: form.req(fd, "name", "el nombre", 120),
        trigger: form.str(fd, "trigger") === "PRODUCTS" ? "PRODUCTS" : "ALWAYS",
        triggerProductIds: form.list(fd, "triggerProductIds"),
        reservationMinutes: Math.max(1, form.int(fd, "reservationMinutes", 10)),
        onTimerExpire: form.str(fd, "onTimerExpire") === "THANK_YOU" ? "THANK_YOU" : "NEXT_OFFER",
      },
    });
    refresh(storeId);
    return { ok: true, redirect: `/panel/${storeId}/embudos/${f.id}` };
  });
}

export async function updateFunnelAction(storeId: string, funnelId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    const entry = form.opt(fd, "entryNodeId");
    if (entry && !(await db.funnelNode.findFirst({ where: { id: entry, funnelId } }))) throw new UserError("Oferta inicial inválida");
    await db.funnel.update({
      where: { id: funnelId },
      data: {
        name: form.req(fd, "name", "el nombre", 120),
        trigger: form.str(fd, "trigger") === "PRODUCTS" ? "PRODUCTS" : "ALWAYS",
        triggerProductIds: form.list(fd, "triggerProductIds"),
        priority: form.int(fd, "priority", 0),
        reservationMinutes: Math.max(1, form.int(fd, "reservationMinutes", 10)),
        onTimerExpire: form.str(fd, "onTimerExpire") === "THANK_YOU" ? "THANK_YOU" : "NEXT_OFFER",
        entryNodeId: entry,
        thankYouOverride: thankYou(fd) ?? undefined,
      },
    });
    refresh(storeId, funnelId);
  });
}

export async function toggleFunnelAction(storeId: string, funnelId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const f = await funnelOf(storeId, funnelId);
    if (f.status === "PAUSED" && !f.entryNodeId) throw new UserError("Elegí la oferta inicial antes de activar el embudo");
    await db.funnel.update({ where: { id: funnelId }, data: { status: f.status === "ACTIVE" ? "PAUSED" : "ACTIVE" } });
    refresh(storeId, funnelId);
    return { ok: true, message: f.status === "ACTIVE" ? "Embudo pausado" : "Embudo activado" };
  });
}

export async function resetFunnelStatsAction(storeId: string, funnelId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    await db.funnel.update({ where: { id: funnelId }, data: { statsResetAt: new Date() } });
    refresh(storeId, funnelId);
    return { ok: true, message: "Estadísticas reiniciadas (las ventas no se tocan)" };
  });
}

export async function deleteFunnelAction(storeId: string, funnelId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    await db.order.updateMany({ where: { funnelId }, data: { funnelId: null, currentNodeId: null, funnelDone: true } });
    await db.funnel.delete({ where: { id: funnelId } });
    refresh(storeId);
    return { ok: true, redirect: `/panel/${storeId}/embudos` };
  });
}

export async function duplicateFunnelAction(storeId: string, funnelId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    const target = form.str(fd, "targetStoreId") || storeId;
    await requireStoreAction(target, "marketing");
    if (target !== storeId) {
      const nodes = await db.funnelNode.findMany({ where: { funnelId }, select: { productId: true } });
      const incoming = new Set(nodes.map((x) => x.productId)).size;
      const [plan, used] = await Promise.all([getStoreOwnerPlan(target), upsellProducts(target)]);
      if (used.size + incoming > plan.maxUpsellsPerStore) {
        throw new UserError(`La tienda destino admite ${plan.maxUpsellsPerStore} upsell(s) y ya usa ${used.size}; este embudo suma ${incoming}.`);
      }
    }
    const id = await copyFunnel(funnelId, target);
    refresh(target);
    return { ok: true, redirect: `/panel/${target}/embudos/${id}`, message: "Embudo copiado (queda pausado)" };
  });
}

export async function saveNodeAction(storeId: string, funnelId: string, nodeId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const funnel = await funnelOf(storeId, funnelId);
    const productId = form.req(fd, "productId", "el producto de la oferta");
    if (!(await db.product.findFirst({ where: { id: productId, storeId } }))) throw new UserError("Producto inválido");
    await assertUpsellLimit(storeId, productId);
    const nodeIds = new Set((await db.funnelNode.findMany({ where: { funnelId }, select: { id: true } })).map((n) => n.id));
    const next = (k: string) => {
      const v = form.opt(fd, k);
      if (!v) return null;
      if (!nodeIds.has(v) || v === nodeId) throw new UserError("La rama apunta a una oferta inválida");
      return v;
    };
    const mode = form.str(fd, "pricingMode") === "FIXED" ? "FIXED" : "DISCOUNT";
    const data = {
      type: form.str(fd, "type") === "DOWNSELL" ? ("DOWNSELL" as const) : ("UPSELL" as const),
      label: form.req(fd, "label", "el nombre de la oferta", 60),
      productId,
      pricingMode: mode as "FIXED" | "DISCOUNT",
      discountPercent: Math.min(100, Math.max(0, form.int(fd, "discountPercent", 0))),
      compareAgainst: (form.str(fd, "compareAgainst") === "COMPARE_AT" ? "COMPARE_AT" : "STORE_PRICE") as CompareAgainst,
      fixedPrice: mode === "FIXED" ? form.num(fd, "fixedPrice", 0) : null,
      contentMode: form.str(fd, "contentMode") === "CUSTOM_HTML" ? ("CUSTOM_HTML" as const) : ("TEMPLATE" as const),
      title: form.str(fd, "title", 300),
      subtitle: form.opt(fd, "subtitle", 500),
      body: form.opt(fd, "body", 10000),
      imageUrl: form.opt(fd, "imageUrl", 1000),
      videoUrl: form.opt(fd, "videoUrl", 1000),
      acceptText: form.str(fd, "acceptText", 120),
      declineText: form.str(fd, "declineText", 120),
      timerText: form.opt(fd, "timerText", 200),
      customHtml: form.opt(fd, "customHtml", 2_000_000),
      acceptNextId: next("acceptNextId"),
      declineNextId: next("declineNextId"),
    };
    if (data.contentMode === "CUSTOM_HTML" && !data.customHtml) throw new UserError("Pegá el HTML propio o elegí la plantilla");
    let id = nodeId;
    if (nodeId) {
      if (!nodeIds.has(nodeId)) throw new UserError("Oferta no encontrada");
      await db.funnelNode.update({ where: { id: nodeId }, data });
    } else {
      const created = await db.funnelNode.create({ data: { ...data, funnelId } });
      id = created.id;
    }
    if (!funnel.entryNodeId || form.bool(fd, "isEntry")) await db.funnel.update({ where: { id: funnelId }, data: { entryNodeId: id } });
    refresh(storeId, funnelId);
    return { ok: true, message: nodeId ? "Oferta guardada" : "Oferta creada" };
  });
}

export async function deleteNodeAction(storeId: string, funnelId: string, nodeId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const funnel = await funnelOf(storeId, funnelId);
    await db.funnelNode.updateMany({ where: { funnelId, acceptNextId: nodeId }, data: { acceptNextId: null } });
    await db.funnelNode.updateMany({ where: { funnelId, declineNextId: nodeId }, data: { declineNextId: null } });
    await db.order.updateMany({ where: { currentNodeId: nodeId }, data: { currentNodeId: null, funnelDone: true } });
    await db.funnelNode.deleteMany({ where: { id: nodeId, funnelId } });
    if (funnel.entryNodeId === nodeId) await db.funnel.update({ where: { id: funnelId }, data: { entryNodeId: null, status: "PAUSED" } });
    refresh(storeId, funnelId);
    return { ok: true, message: "Oferta eliminada" };
  });
}

/** Test A/B de una oferta: variantes A y B con descuento, textos o HTML distintos (50/50). */
export async function saveVariantsAction(storeId: string, funnelId: string, nodeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    const node = await db.funnelNode.findFirst({ where: { id: nodeId, funnelId } });
    if (!node) throw new UserError("Oferta no encontrada");
    for (const key of ["A", "B"]) {
      const p = key.toLowerCase();
      const data = {
        discountPercent: form.numOrNull(fd, `${p}_discount`),
        fixedPrice: form.numOrNull(fd, `${p}_fixed`),
        title: form.opt(fd, `${p}_title`, 300),
        body: form.opt(fd, `${p}_body`, 10000),
        acceptText: form.opt(fd, `${p}_accept`, 120),
        customHtml: form.opt(fd, `${p}_html`, 2_000_000),
      };
      if (data.discountPercent !== null) data.discountPercent = Math.min(100, Math.max(0, Math.round(data.discountPercent)));
      await db.funnelNodeVariant.upsert({ where: { nodeId_key: { nodeId, key } }, create: { nodeId, key, ...data }, update: data });
    }
    const active = form.bool(fd, "abTestActive");
    await db.funnelNode.update({ where: { id: nodeId }, data: { abTestActive: active, abStartedAt: active && !node.abTestActive ? new Date() : active ? node.abStartedAt : null } });
    refresh(storeId, funnelId);
    revalidatePath(`/panel/${storeId}/marketing/ab`);
    return { ok: true, message: active ? "Test A/B activo" : "Variantes guardadas (test apagado)" };
  });
}

/** Aplica la variante ganadora a la oferta y apaga el test. */
export async function applyWinnerAction(storeId: string, funnelId: string, nodeId: string, key: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await funnelOf(storeId, funnelId);
    const v = await db.funnelNodeVariant.findUnique({ where: { nodeId_key: { nodeId, key } } });
    if (!v) throw new UserError("Variante no encontrada");
    await db.funnelNode.update({
      where: { id: nodeId },
      data: {
        abTestActive: false,
        abStartedAt: null,
        ...(v.discountPercent !== null ? { discountPercent: v.discountPercent, pricingMode: "DISCOUNT" } : {}),
        ...(v.fixedPrice !== null ? { fixedPrice: v.fixedPrice, pricingMode: "FIXED" } : {}),
        ...(v.title ? { title: v.title } : {}),
        ...(v.body ? { body: v.body } : {}),
        ...(v.acceptText ? { acceptText: v.acceptText } : {}),
        ...(v.customHtml ? { customHtml: v.customHtml, contentMode: "CUSTOM_HTML" } : {}),
      },
    });
    refresh(storeId, funnelId);
    revalidatePath(`/panel/${storeId}/marketing/ab`);
    return { ok: true, message: `Variante ${key} aplicada` };
  });
}
