"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { changePlan, markInvoicePaid, runBilling } from "@/lib/billing";
import { refreshRates } from "@/lib/fx";

async function admin() {
  const user = await getCurrentUser();
  if (!user || user.platformRole !== "SUPERADMIN") throw new AuthError("Solo administradores");
  return user;
}

export async function setUserPlanAction(userId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    await changePlan(userId, form.req(fd, "planKey", "el plan"));
    revalidatePath("/admin/usuarios");
  });
}

export async function toggleUserStatusAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await admin();
    if (me.id === userId) throw new UserError("No podés suspender tu propia cuenta");
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const status = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await db.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") {
      await db.session.deleteMany({ where: { userId } });
      await db.store.updateMany({ where: { ownerId: userId, status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedReason: "admin" } });
    } else {
      await db.store.updateMany({ where: { ownerId: userId, suspendedReason: "admin" }, data: { status: "ACTIVE", suspendedReason: null } });
    }
    revalidatePath("/admin/usuarios");
    return { ok: true, message: status === "ACTIVE" ? "Cuenta reactivada" : "Cuenta suspendida" };
  });
}

export async function toggleAdminAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await admin();
    if (me.id === userId) throw new UserError("No podés quitarte el rol a vos mismo");
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    await db.user.update({ where: { id: userId }, data: { platformRole: u.platformRole === "SUPERADMIN" ? "USER" : "SUPERADMIN" } });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Rol actualizado" };
  });
}

export async function toggleStoreStatusAction(storeId: string): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const s = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    await db.store.update({
      where: { id: storeId },
      data: s.status === "ACTIVE" ? { status: "SUSPENDED", suspendedReason: "admin" } : { status: "ACTIVE", suspendedReason: null },
    });
    revalidatePath("/admin/tiendas");
    return { ok: true, message: s.status === "ACTIVE" ? "Tienda suspendida" : "Tienda reactivada" };
  });
}

export async function markInvoicePaidAction(invoiceId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await admin();
    const ok = await markInvoicePaid(invoiceId, "manual", `admin:${me.email}`);
    if (!ok) throw new UserError("La factura ya estaba pagada o anulada");
    revalidatePath("/admin/facturas");
    return { ok: true, message: "Factura marcada como pagada" };
  });
}

export async function voidInvoiceAction(invoiceId: string): Promise<ActionResult> {
  return run(async () => {
    await admin();
    await db.$transaction([
      db.commissionEntry.updateMany({ where: { invoiceId }, data: { status: "PENDING", invoiceId: null } }),
      db.platformInvoice.update({ where: { id: invoiceId }, data: { status: "VOID" } }),
    ]);
    revalidatePath("/admin/facturas");
    return { ok: true, message: "Factura anulada (las comisiones vuelven a pendientes)" };
  });
}

export async function runBillingAction(): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const r = await runBilling();
    revalidatePath("/admin/facturas");
    return { ok: true, message: `Facturas emitidas: ${r.issued} · vencidas: ${r.overdue} · tiendas suspendidas: ${r.suspended}` };
  });
}

export async function savePlanAction(planId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const ebooks = form.str(fd, "aiEbooksPerMonth");
    await db.plan.update({
      where: { id: planId },
      data: {
        name: form.req(fd, "name", "el nombre", 60),
        description: form.str(fd, "description", 300),
        priceUsd: Math.max(0, form.num(fd, "priceUsd", 0)),
        commissionBps: Math.max(0, Math.round(form.num(fd, "commissionPct", 0) * 100)),
        maxStores: Math.max(1, form.int(fd, "maxStores", 1)),
        aiEbooksPerMonth: ebooks === "" ? null : Math.max(0, form.int(fd, "aiEbooksPerMonth", 0)),
        maxBonusesPerStore: Math.max(0, form.int(fd, "maxBonusesPerStore", 0)),
        maxUpsellsPerStore: Math.max(0, form.int(fd, "maxUpsellsPerStore", 0)),
        cartRecovery: form.bool(fd, "cartRecovery"),
        teamRoles: form.bool(fd, "teamRoles"),
        trialDays: Math.max(0, form.int(fd, "trialDays", 0)),
        sortOrder: form.int(fd, "sortOrder", 0),
        active: form.bool(fd, "active"),
      },
    });
    revalidatePath("/admin/planes");
  });
}

export async function saveRateAction(currency: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const v = form.num(fd, "perUsd", 0);
    if (!(v > 0)) throw new UserError("Valor inválido");
    await db.exchangeRate.upsert({ where: { currency }, create: { currency, perUsd: v, source: "manual" }, update: { perUsd: v, source: "manual" } });
    revalidatePath("/admin/tipos-de-cambio");
  });
}

export async function refreshRatesAction(): Promise<ActionResult> {
  return run(async () => {
    await admin();
    const r = await refreshRates();
    if (r.skipped) throw new UserError("Configurá FX_API_URL para actualizar automáticamente");
    revalidatePath("/admin/tipos-de-cambio");
    return { ok: true, message: `${r.updated} cotizaciones actualizadas` };
  });
}
