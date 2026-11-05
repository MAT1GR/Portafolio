"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { applyProviderStatus, approveTransfer, refundOrder } from "@/lib/orders";
import { resendAccess, resetDownloads } from "@/lib/delivery";
import { getPlanForRecovery } from "./helpers";

async function orderOf(storeId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, storeId } });
  if (!order) throw new UserError("Pedido no encontrado");
  return order;
}

export async function approveTransferAction(storeId: string, orderId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "orders");
    await orderOf(storeId, orderId);
    const n = await approveTransfer(orderId);
    if (!n) throw new UserError("No hay pagos por transferencia pendientes en este pedido");
    revalidatePath(`/panel/${storeId}/ventas/${orderId}`);
    return { ok: true, message: "Pago aprobado: se envió el acceso al comprador" };
  });
}

export async function refundAction(storeId: string, orderId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "orders");
    await orderOf(storeId, orderId);
    const errors = await refundOrder(orderId);
    revalidatePath(`/panel/${storeId}/ventas/${orderId}`);
    if (errors.length) throw new UserError(`No se pudo reembolsar por API: ${errors.join(" · ")}. Si lo hiciste desde la pasarela, marcalo manualmente.`);
    return { ok: true, message: "Reembolso registrado y accesos desactivados" };
  });
}

export async function markRefundedAction(storeId: string, orderId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "orders");
    const order = await orderOf(storeId, orderId);
    const approved = await db.payment.findMany({ where: { orderId: order.id, status: "APPROVED" } });
    for (const p of approved) await applyProviderStatus(p.id, { status: "REFUNDED" });
    revalidatePath(`/panel/${storeId}/ventas/${orderId}`);
    return { ok: true, message: "Marcado como reembolsado (sin llamar a la pasarela)" };
  });
}

export async function resendAccessAction(storeId: string, orderId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "orders");
    const order = await orderOf(storeId, orderId);
    if (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") throw new UserError("El pedido no está pagado");
    await resendAccess(orderId);
    return { ok: true, message: `Accesos reenviados a ${order.email}` };
  });
}

export async function resetDownloadsAction(storeId: string, orderId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "orders");
    await orderOf(storeId, orderId);
    await resetDownloads(orderId);
    revalidatePath(`/panel/${storeId}/ventas/${orderId}`);
    return { ok: true, message: "Descargas restablecidas" };
  });
}

export async function updateRecoveryAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const enabled = form.bool(fd, "enabled");
    if (enabled && !(await getPlanForRecovery(storeId)).cartRecovery) {
      throw new UserError("La recuperación de carritos está disponible en los planes Crecimiento y Escala.");
    }
    const steps = [0, 1, 2].map((i) => ({
      delayMinutes: Math.max(15, Math.round(form.num(fd, `delay${i}`, [1, 24, 72][i]) * 60)),
      subject: form.str(fd, `subject${i}`, 200),
      body: form.str(fd, `body${i}`, 2000),
      couponCode: form.str(fd, `coupon${i}`, 60).toUpperCase(),
    }));
    await db.store.update({ where: { id: storeId }, data: { recoverySettings: { enabled, steps } } });
    revalidatePath(`/panel/${storeId}/carritos`);
  });
}
