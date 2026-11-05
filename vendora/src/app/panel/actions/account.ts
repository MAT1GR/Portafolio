"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AuthError, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { changePlan, invoicePaymentUrl } from "@/lib/billing";
import { ownedStoreCount } from "@/lib/plans";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Tu sesión expiró. Volvé a ingresar.");
  return user;
}

export async function updateProfileAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    const email = form.email(fd, "email");
    if (email !== user.email && (await db.user.findUnique({ where: { email } }))) throw new UserError("Ese email ya está en uso");
    await db.user.update({ where: { id: user.id }, data: { name: form.req(fd, "name", "tu nombre", 80), email, notifyEmailOnSale: form.bool(fd, "notifyEmailOnSale") } });
    revalidatePath("/panel", "layout");
  });
}

export async function changePasswordAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    if (!(await verifyPassword(form.str(fd, "current", 200), user.passwordHash))) throw new UserError("La contraseña actual no es correcta");
    const next = form.str(fd, "next", 200);
    if (next.length < 8) throw new UserError("La contraseña nueva debe tener al menos 8 caracteres");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
    return { ok: true, message: "Contraseña actualizada" };
  });
}

export async function changePlanAction(planKey: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    const plan = await db.plan.findUnique({ where: { key: planKey } });
    if (!plan || !plan.active) throw new UserError("Plan no disponible");
    const stores = await ownedStoreCount(user.id);
    if (stores > plan.maxStores) throw new UserError(`Tenés ${stores} tiendas y el plan ${plan.name} permite ${plan.maxStores}. Eliminá o cerrá tiendas antes de bajar de plan.`);
    const r = await changePlan(user.id, planKey);
    revalidatePath("/panel", "layout");
    return { ok: true, message: r.trial ? `Plan ${plan.name} activo con ${r.trialDays} días de prueba gratis.` : `Ahora estás en el plan ${plan.name}.` };
  });
}

export async function payInvoiceAction(invoiceId: string, method: "stripe" | "mercadopago"): Promise<ActionResult> {
  const user = await me();
  let url: string;
  try {
    url = await invoicePaymentUrl(invoiceId, user.id, method);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  redirect(url);
}
