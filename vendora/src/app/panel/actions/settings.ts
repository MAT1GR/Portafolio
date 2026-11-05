"use server";

import { revalidatePath } from "next/cache";
import type { GatewayProvider, Prisma, StoreRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { decryptJson, encryptJson, randomToken, sha256 } from "@/lib/crypto";
import { GATEWAYS } from "@/lib/gateways";
import { CURRENCIES } from "@/lib/money";
import { deleteObject } from "@/lib/storage";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { ROLE_LABELS } from "@/lib/auth";
import { getStoreOwnerPlan } from "@/lib/plans";

// ───────────── Medios de pago ─────────────

export async function saveGatewayAction(storeId: string, provider: GatewayProvider, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "payments");
    const info = GATEWAYS[provider];
    if (!info) throw new UserError("Pasarela desconocida");
    const existing = await db.paymentGateway.findUnique({ where: { storeId_provider: { storeId, provider } } });
    const prevCreds = decryptJson<Record<string, string>>(existing?.credentialsEnc, {});
    const creds: Record<string, string> = {};
    for (const f of info.credentialFields) {
      const v = form.str(fd, `c_${f.key}`, 2000);
      creds[f.key] = v || (f.secret ? prevCreds[f.key] ?? "" : "");
    }
    const enabled = form.bool(fd, "enabled");
    if (enabled) {
      const missing = info.credentialFields.filter((f) => f.required && !creds[f.key]).map((f) => f.label);
      if (missing.length) throw new UserError(`Para activar ${info.label} completá: ${missing.join(", ")}`);
    }
    if (provider === "STRIPE" && creds.publishableKey && !creds.publishableKey.startsWith("pk_")) throw new UserError("La Publishable key de Stripe empieza con pk_");
    if (provider === "STRIPE" && creds.secretKey && !/^(sk|rk)_/.test(creds.secretKey)) throw new UserError("La Secret key de Stripe empieza con sk_ o rk_");
    const settings: Record<string, unknown> = {};
    for (const s of info.settingFields) settings[s.key] = s.type === "boolean" ? form.bool(fd, `s_${s.key}`) : s.type === "number" ? form.numOrNull(fd, `s_${s.key}`) : form.str(fd, `s_${s.key}`, 5000);
    if (provider === "TRANSFER" && enabled && !String(settings.instructions || "").trim()) throw new UserError("Cargá los datos bancarios para la transferencia");
    const data = {
      enabled,
      displayName: form.opt(fd, "displayName", 60),
      credentialsEnc: info.credentialFields.length ? encryptJson(creds) : null,
      settings: settings as Prisma.InputJsonValue,
      sortOrder: form.int(fd, "sortOrder", existing?.sortOrder ?? 0),
    };
    await db.paymentGateway.upsert({ where: { storeId_provider: { storeId, provider } }, create: { storeId, provider, ...data }, update: data });
    revalidatePath(`/panel/${storeId}/pagos`);
    return { ok: true, message: `${info.label} ${enabled ? "activado" : "guardado (desactivado)"}` };
  });
}

// ───────────── Markets ─────────────

export async function saveMarketAction(storeId: string, marketId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "settings");
    const currency = form.str(fd, "currency").toUpperCase();
    if (!CURRENCIES.includes(currency)) throw new UserError("Moneda no soportada");
    const rate = form.num(fd, "rate", 0);
    if (!(rate > 0)) throw new UserError("El tipo de cambio tiene que ser mayor a 0");
    const countries = form
      .str(fd, "countries", 500)
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c));
    const data = {
      name: form.req(fd, "name", "el nombre del market", 80),
      currency,
      countries,
      rate,
      rounding: form.str(fd, "rounding") || "none",
      active: form.bool(fd, "active"),
      isDefault: form.bool(fd, "isDefault"),
    };
    if (data.isDefault) await db.market.updateMany({ where: { storeId }, data: { isDefault: false } });
    if (marketId) await db.market.updateMany({ where: { id: marketId, storeId }, data });
    else await db.market.create({ data: { ...data, storeId } });
    revalidatePath(`/panel/${storeId}/markets`);
    return { ok: true, message: "Market guardado" };
  });
}

export async function deleteMarketAction(storeId: string, marketId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "settings");
    await db.market.deleteMany({ where: { id: marketId, storeId } });
    revalidatePath(`/panel/${storeId}/markets`);
    return { ok: true, message: "Market eliminado" };
  });
}

// ───────────── Recursos ─────────────

export async function deleteMediaAction(storeId: string, assetId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    const asset = await db.mediaAsset.findFirst({ where: { id: assetId, storeId } });
    if (!asset) throw new UserError("Archivo no encontrado");
    await db.mediaAsset.delete({ where: { id: asset.id } });
    if ((await db.mediaAsset.count({ where: { storageKey: asset.storageKey } })) === 0) await deleteObject(asset.storageKey).catch(() => undefined);
    revalidatePath(`/panel/${storeId}/recursos`);
    return { ok: true, message: "Eliminado" };
  });
}

// ───────────── Equipo ─────────────

const ROLES: StoreRole[] = ["ADMIN", "EDITOR", "SUPPORT", "ANALYST"];

export async function inviteMemberAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, store } = await requireStoreAction(storeId, "team");
    const plan = await getStoreOwnerPlan(storeId);
    if (!plan.teamRoles) throw new UserError("El equipo con roles está disponible en el plan Escala.");
    const email = form.email(fd, "email");
    const role = form.str(fd, "role") as StoreRole;
    if (!ROLES.includes(role)) throw new UserError("Rol inválido");
    if (email === store.owner.email) throw new UserError("Esa persona ya es la dueña de la tienda");
    const token = randomToken(24);
    await db.storeInvitation.create({ data: { storeId, email, role, tokenHash: sha256(token), invitedById: user.id, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
    await sendEmail({
      to: email,
      subject: `${user.name} te invitó a ${store.name} en ${env.brand}`,
      html: renderEmail({
        brandName: env.brand,
        title: `Te invitaron a ${store.name}`,
        paragraphs: [`${user.name} te sumó al equipo como ${ROLE_LABELS[role]}. La invitación vence en 7 días.`],
        cta: { text: "Aceptar invitación", url: `${env.appUrl}/invitacion/${token}` },
      }),
      kind: "team-invite",
      storeId,
    });
    revalidatePath(`/panel/${storeId}/equipo`);
    return { ok: true, message: `Invitación enviada a ${email}` };
  });
}

export async function changeRoleAction(storeId: string, memberId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "team");
    const role = form.str(fd, "role") as StoreRole;
    if (!ROLES.includes(role)) throw new UserError("Rol inválido");
    await db.storeMember.updateMany({ where: { id: memberId, storeId }, data: { role } });
    revalidatePath(`/panel/${storeId}/equipo`);
  });
}

export async function removeMemberAction(storeId: string, memberId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "team");
    await db.storeMember.deleteMany({ where: { id: memberId, storeId } });
    revalidatePath(`/panel/${storeId}/equipo`);
    return { ok: true, message: "Miembro quitado" };
  });
}

export async function revokeInviteAction(storeId: string, inviteId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "team");
    await db.storeInvitation.deleteMany({ where: { id: inviteId, storeId } });
    revalidatePath(`/panel/${storeId}/equipo`);
    return { ok: true, message: "Invitación cancelada" };
  });
}
