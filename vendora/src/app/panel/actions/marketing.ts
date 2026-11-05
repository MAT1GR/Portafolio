"use server";

import { revalidatePath } from "next/cache";
import type { CompareAgainst, CouponType, PricingMode } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { encrypt } from "@/lib/crypto";
import { sendCapi } from "@/lib/tracking";
import { storeUrl } from "@/lib/stores";

// ───────────── Checkout ─────────────

export async function updateCheckoutSettingsAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const min = Math.max(1, form.int(fd, "spMin", 3));
    const max = Math.max(min, form.int(fd, "spMax", 12));
    await db.store.update({
      where: { id: storeId },
      data: {
        checkoutSettings: {
          askName: form.bool(fd, "askName"),
          requireName: form.bool(fd, "requireName"),
          askPhone: form.bool(fd, "askPhone"),
          requirePhone: form.bool(fd, "requirePhone"),
          showCoupon: form.bool(fd, "showCoupon"),
          socialProof: { enabled: form.bool(fd, "spEnabled"), min, max },
          countdown: { enabled: form.bool(fd, "cdEnabled"), minutes: Math.max(1, form.int(fd, "cdMinutes", 15)) },
          showSecureBadges: form.bool(fd, "showSecureBadges"),
          showGuarantee: form.bool(fd, "showGuarantee"),
          buttonText: form.str(fd, "buttonText", 60),
          footerNote: form.str(fd, "footerNote", 300),
        },
      },
    });
    revalidatePath(`/panel/${storeId}/checkout`);
  });
}

function bumpData(fd: FormData) {
  const mode = (form.str(fd, "pricingMode") === "FIXED" ? "FIXED" : "DISCOUNT") as PricingMode;
  return {
    offerProductId: form.req(fd, "offerProductId", "el producto del bump"),
    pricingMode: mode,
    discountPercent: Math.min(100, Math.max(0, form.int(fd, "discountPercent", 0))),
    compareAgainst: (form.str(fd, "compareAgainst") === "COMPARE_AT" ? "COMPARE_AT" : "STORE_PRICE") as CompareAgainst,
    fixedPrice: mode === "FIXED" ? form.num(fd, "fixedPrice", 0) : null,
    headline: form.req(fd, "headline", "el encabezado", 200),
    description: form.opt(fd, "description", 1000),
    buttonText: form.req(fd, "buttonText", "el texto del botón", 80),
    imageUrl: form.opt(fd, "imageUrl", 1000),
    timerEnabled: form.bool(fd, "timerEnabled"),
    timerMinutes: Math.max(1, form.int(fd, "timerMinutes", 10)),
    active: form.bool(fd, "active"),
  };
}

export async function saveBumpAction(storeId: string, bumpId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const data = bumpData(fd);
    const mainProductId = form.req(fd, "mainProductId", "el producto principal");
    const owned = await db.product.count({ where: { id: { in: [mainProductId, data.offerProductId] }, storeId } });
    if (owned < (mainProductId === data.offerProductId ? 1 : 2)) throw new UserError("Producto inválido");
    if (mainProductId === data.offerProductId) throw new UserError("El bump tiene que ser otro producto");
    if (bumpId) await db.orderBump.updateMany({ where: { id: bumpId, storeId }, data: { ...data, mainProductId } });
    else await db.orderBump.create({ data: { ...data, storeId, mainProductId, sortOrder: await db.orderBump.count({ where: { storeId, mainProductId } }) } });
    revalidatePath(`/panel/${storeId}/checkout`);
    return { ok: true, message: bumpId ? "Order bump guardado" : "Order bump creado" };
  });
}

export async function deleteBumpAction(storeId: string, bumpId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await db.orderBump.deleteMany({ where: { id: bumpId, storeId } });
    revalidatePath(`/panel/${storeId}/checkout`);
    return { ok: true, message: "Order bump eliminado" };
  });
}

// ───────────── Tests A/B de checkout ─────────────

function variant(fd: FormData, p: "a" | "b") {
  return {
    title: form.str(fd, `${p}_title`, 200),
    subtitle: form.str(fd, `${p}_subtitle`, 200),
    price: form.numOrNull(fd, `${p}_price`),
    compareAtPrice: form.numOrNull(fd, `${p}_compare`),
    showBumps: form.bool(fd, `${p}_bumps`),
    buttonText: form.str(fd, `${p}_button`, 60),
  };
}

export async function createCheckoutTestAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "marketing");
    if (store.type !== "CHECKOUT") throw new UserError("Los tests A/B de checkout están disponibles en tiendas tipo Checkout. Para tiendas tipo Tienda usá los A/B de ofertas post-compra.");
    const productId = form.req(fd, "productId", "el producto");
    if (!(await db.product.findFirst({ where: { id: productId, storeId } }))) throw new UserError("Producto inválido");
    await db.checkoutTest.updateMany({ where: { storeId, productId, active: true }, data: { active: false, endedAt: new Date() } });
    await db.checkoutTest.create({ data: { storeId, productId, name: form.req(fd, "name", "el nombre del test", 120), variantA: variant(fd, "a"), variantB: variant(fd, "b") } });
    revalidatePath(`/panel/${storeId}/marketing/ab`);
    return { ok: true, message: "Test A/B iniciado (50/50 por visitante)" };
  });
}

export async function endCheckoutTestAction(storeId: string, testId: string, winner: string | null): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await db.checkoutTest.updateMany({ where: { id: testId, storeId }, data: { active: false, endedAt: new Date(), winner } });
    revalidatePath(`/panel/${storeId}/marketing/ab`);
    return { ok: true, message: "Test finalizado" };
  });
}

// ───────────── Cupones ─────────────

export async function saveCouponAction(storeId: string, couponId: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const code = form.req(fd, "code", "el código", 40).toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new UserError("El código solo puede tener letras, números, guion y guion bajo");
    const type = (form.str(fd, "type") === "FIXED" ? "FIXED" : "PERCENT") as CouponType;
    const value = form.num(fd, "value", 0);
    if (value <= 0) throw new UserError("El valor del descuento tiene que ser mayor a 0");
    if (type === "PERCENT" && value > 100) throw new UserError("El porcentaje no puede superar 100");
    const productIds = form.list(fd, "productIds");
    const startsAt = form.opt(fd, "startsAt");
    const endsAt = form.opt(fd, "endsAt");
    const data = {
      code,
      type,
      value,
      productIds,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      maxUses: form.numOrNull(fd, "maxUses"),
      active: form.bool(fd, "active"),
    };
    if (couponId) await db.coupon.updateMany({ where: { id: couponId, storeId }, data });
    else await db.coupon.create({ data: { ...data, storeId } });
    revalidatePath(`/panel/${storeId}/marketing/cupones`);
    return { ok: true, message: couponId ? "Cupón guardado" : `Cupón ${code} creado` };
  });
}

export async function deleteCouponAction(storeId: string, couponId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    await db.coupon.deleteMany({ where: { id: couponId, storeId } });
    revalidatePath(`/panel/${storeId}/marketing/cupones`);
    return { ok: true, message: "Cupón eliminado" };
  });
}

// ───────────── Píxel y tracking ─────────────

export async function savePixelAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "marketing");
    const id = (v: string | null) => (v && /^[\w-]{3,40}$/.test(v) ? v : null);
    const pixel = form.opt(fd, "metaPixelId");
    if (pixel && !id(pixel)) throw new UserError("El ID del píxel no es válido");
    const token = form.str(fd, "metaCapiToken", 1000);
    const clearToken = form.bool(fd, "clearToken");
    await db.store.update({
      where: { id: storeId },
      data: {
        metaPixelId: id(pixel),
        ...(token ? { metaCapiTokenEnc: encrypt(token) } : clearToken ? { metaCapiTokenEnc: null } : {}),
        metaTestEventCode: form.opt(fd, "metaTestEventCode", 40),
        ga4Id: id(form.opt(fd, "ga4Id")),
        tiktokPixelId: id(form.opt(fd, "tiktokPixelId")),
      },
    });
    revalidatePath(`/panel/${storeId}/marketing/pixel`);
  });
}

/** Envía un evento de prueba a la API de Conversiones (se ve en "Probar eventos" del Administrador de eventos). */
export async function testCapiAction(storeId: string): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "marketing");
    if (!store.metaPixelId || !store.metaCapiTokenEnc) throw new UserError("Cargá el ID del píxel y el token de la API de Conversiones");
    const r = await sendCapi(store, { eventName: "Lead", eventId: `test-${Date.now()}`, eventSourceUrl: storeUrl(store, "/"), email: "test@example.com", country: "ar" });
    if ("skipped" in r) throw new UserError("No se pudo leer el token guardado. Volvé a cargarlo.");
    if (!r.ok) throw new UserError(`Meta respondió con error: ${JSON.stringify("data" in r ? r.data : r.error).slice(0, 300)}`);
    return { ok: true, message: `Evento enviado. ${store.metaTestEventCode ? "Revisalo en Probar eventos." : "Cargá un código de prueba para verlo en Probar eventos."}` };
  });
}
