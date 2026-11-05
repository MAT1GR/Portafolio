"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma, StoreType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAction, getCurrentUser, AuthError } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { assertCanCreateStore } from "@/lib/plans";
import { RESERVED_SLUGS, slugify, uniqueStoreSlug } from "@/lib/stores";
import { duplicateStore } from "@/lib/duplicate";
import { processAiJob } from "@/lib/ai-jobs";
import { aiConfigured } from "@/lib/ai";
import { LANGUAGES } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money";
import { DEFAULT_RATES } from "@/lib/fx";
import { DEFAULT_CHECKOUT, DEFAULT_DELIVERY, DEFAULT_NOTIFY, DEFAULT_RECOVERY, DEFAULT_THANKYOU } from "@/lib/store-settings";

type Json = Prisma.InputJsonValue;

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Tu sesión expiró. Volvé a ingresar.");
  return user;
}

function lang(v: string) {
  return v in LANGUAGES ? v : "es";
}

function currency(v: string) {
  return CURRENCIES.includes(v) ? v : "USD";
}

/** Crea una tienda vacía con la configuración por defecto y la pasarela de prueba. */
export async function createStoreAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await assertCanCreateStore(user.id, user.plan);
    const name = form.req(fd, "name", "el nombre de la tienda", 80);
    const base = currency(form.str(fd, "baseCurrency") || "USD");
    const language = lang(form.str(fd, "language") || "es");
    const store = await db.store.create({
      data: {
        ownerId: user.id,
        name,
        slug: await uniqueStoreSlug(form.str(fd, "slug") || name),
        type: (form.str(fd, "type") === "CHECKOUT" ? "CHECKOUT" : "STORE") as StoreType,
        language,
        baseCurrency: base,
        timezone: form.str(fd, "timezone") || "America/Argentina/Buenos_Aires",
        supportEmail: user.email,
        testMode: true,
        checkoutSettings: DEFAULT_CHECKOUT as unknown as Json,
        deliverySettings: DEFAULT_DELIVERY as unknown as Json,
        thankYouSettings: DEFAULT_THANKYOU as unknown as Json,
        recoverySettings: DEFAULT_RECOVERY as unknown as Json,
        notifySettings: DEFAULT_NOTIFY as unknown as Json,
      },
    });
    await db.paymentGateway.create({ data: { storeId: store.id, provider: "TEST", enabled: true } });
    const marketCurrency = form.str(fd, "marketCurrency");
    if (marketCurrency && marketCurrency !== base && CURRENCIES.includes(marketCurrency)) {
      const rate = (DEFAULT_RATES[marketCurrency] ?? 1) / (DEFAULT_RATES[base] ?? 1);
      await db.market.create({
        data: { storeId: store.id, name: form.str(fd, "marketName") || marketCurrency, currency: marketCurrency, countries: form.str(fd, "marketCountries").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean), rate, rounding: "integer", isDefault: false },
      });
    }
    revalidatePath("/panel");
    return { ok: true, redirect: `/panel/${store.id}/productos/nuevo` };
  });
}

/** Encola la creación de tienda con IA y la procesa en segundo plano. */
export async function createStoreAiAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await assertCanCreateStore(user.id, user.plan);
    if (!aiConfigured()) throw new UserError("La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).");
    const idea = form.req(fd, "idea", "la idea del producto", 2000);
    const job = await db.aiJob.create({
      data: {
        userId: user.id,
        kind: "STORE",
        input: {
          idea,
          audience: form.str(fd, "audience", 500),
          tone: form.str(fd, "tone", 200),
          language: lang(form.str(fd, "language") || "es"),
          baseCurrency: currency(form.str(fd, "baseCurrency") || "USD"),
          type: form.str(fd, "type") === "CHECKOUT" ? "CHECKOUT" : "STORE",
          withEbook: form.bool(fd, "withEbook"),
        },
      },
    });
    after(() => processAiJob(job.id));
    return { ok: true, redirect: `/panel/nueva/ia/${job.id}` };
  });
}

export async function updateGeneralAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "settings");
    let slug = slugify(form.str(fd, "slug") || store.slug);
    if (!slug) throw new UserError("El subdominio no puede quedar vacío");
    if (RESERVED_SLUGS.has(slug)) throw new UserError("Ese subdominio está reservado");
    if (slug !== store.slug && (await db.store.findUnique({ where: { slug } }))) throw new UserError("Ese subdominio ya está en uso");
    const domainRaw = form.str(fd, "customDomain").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (domainRaw && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domainRaw)) throw new UserError("El dominio no es válido (ej. tienda.midominio.com)");
    if (domainRaw && domainRaw !== store.customDomain && (await db.store.findUnique({ where: { customDomain: domainRaw } }))) throw new UserError("Ese dominio ya está conectado a otra tienda");
    const mainProductId = form.opt(fd, "mainProductId");
    if (mainProductId && !(await db.product.findFirst({ where: { id: mainProductId, storeId } }))) throw new UserError("Producto principal inválido");
    slug = slug.slice(0, 48);
    await db.store.update({
      where: { id: storeId },
      data: {
        name: form.req(fd, "name", "el nombre", 80),
        slug,
        customDomain: domainRaw || null,
        type: form.str(fd, "type") === "CHECKOUT" ? "CHECKOUT" : "STORE",
        language: lang(form.str(fd, "language")),
        timezone: form.str(fd, "timezone") || store.timezone,
        baseCurrency: currency(form.str(fd, "baseCurrency") || store.baseCurrency),
        testMode: form.bool(fd, "testMode"),
        mainProductId,
        metaTitle: form.opt(fd, "metaTitle", 120),
        metaDescription: form.opt(fd, "metaDescription", 300),
        noindex: form.bool(fd, "noindex"),
        aiContext: form.opt(fd, "aiContext", 4000),
      },
    });
    revalidatePath(`/panel/${storeId}`, "layout");
  });
}

export async function updateBrandAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    const color = (v: string, fb: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : fb);
    await db.store.update({
      where: { id: storeId },
      data: {
        logoUrl: form.opt(fd, "logoUrl", 1000),
        bannerUrl: form.opt(fd, "bannerUrl", 1000),
        primaryColor: color(form.str(fd, "primaryColor"), "#FF5B2E"),
        accentColor: color(form.str(fd, "accentColor"), "#17142A"),
        headline: form.opt(fd, "headline", 200),
        description: form.opt(fd, "description", 1000),
      },
    });
    revalidatePath(`/panel/${storeId}`, "layout");
  });
}

export async function updateLegalAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    await db.store.update({
      where: { id: storeId },
      data: {
        supportEmail: form.opt(fd, "supportEmail", 200),
        supportWhatsapp: form.opt(fd, "supportWhatsapp", 40),
        legalName: form.opt(fd, "legalName", 200),
        legalTaxId: form.opt(fd, "legalTaxId", 60),
        legalAddress: form.opt(fd, "legalAddress", 300),
        guaranteeDays: Math.max(0, Math.min(365, form.int(fd, "guaranteeDays", 7))),
        termsText: form.opt(fd, "termsText", 30000),
        privacyText: form.opt(fd, "privacyText", 30000),
        refundText: form.opt(fd, "refundText", 30000),
      },
    });
    revalidatePath(`/panel/${storeId}/contenido`);
  });
}

export async function updateLandingAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    const html = form.str(fd, "landingHtml", 2_000_000);
    const mode = form.str(fd, "landingMode") === "CUSTOM_HTML" ? "CUSTOM_HTML" : "DEFAULT";
    if (mode === "CUSTOM_HTML" && !html.trim()) throw new UserError("Pegá el HTML de la landing o elegí la portada estándar");
    await db.store.update({ where: { id: storeId }, data: { landingMode: mode, landingHtml: html || null } });
    revalidatePath(`/panel/${storeId}/contenido`);
    return { ok: true, message: "Landing guardada. Puede tardar hasta 30 segundos en verse publicada." };
  });
}

export async function updateThankYouAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    const redirectUrl = form.str(fd, "redirectUrl", 1000);
    if (redirectUrl && !/^https?:\/\//.test(redirectUrl)) throw new UserError("La URL de redirección debe empezar con https://");
    await db.store.update({
      where: { id: storeId },
      data: {
        thankYouSettings: {
          title: form.str(fd, "title", 200),
          message: form.str(fd, "message", 1000),
          buttonText: form.str(fd, "buttonText", 80),
          buttonUrl: form.str(fd, "buttonUrl", 1000),
          redirectUrl,
        },
      },
    });
    revalidatePath(`/panel/${storeId}/contenido`);
  });
}

export async function updateDeliveryAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "settings");
    const hours = form.numOrNull(fd, "linkExpiryHours");
    const max = form.numOrNull(fd, "maxDownloads");
    await db.store.update({
      where: { id: storeId },
      data: {
        deliverySettings: {
          linkExpiryHours: hours && hours > 0 ? Math.round(hours) : null,
          maxDownloads: max && max > 0 ? Math.round(max) : null,
          extraMessage: form.str(fd, "extraMessage", 1000),
        },
        notifySettings: { emailOnSale: form.bool(fd, "emailOnSale"), emailOnTransfer: form.bool(fd, "emailOnTransfer") },
      },
    });
    revalidatePath(`/panel/${storeId}/configuracion`);
  });
}

export async function duplicateStoreAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user } = await requireStoreAction(storeId, "danger");
    const name = form.req(fd, "name", "el nombre de la copia", 80);
    const id = await duplicateStore(storeId, user.id, name);
    revalidatePath("/panel");
    return { ok: true, redirect: `/panel/${id}` };
  });
}

export async function deleteStoreAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "danger");
    if (form.str(fd, "confirm") !== store.slug) throw new UserError(`Escribí "${store.slug}" para confirmar`);
    const paid = await db.order.count({ where: { storeId, status: "PAID" } });
    if (paid > 0) {
      await db.store.update({ where: { id: storeId }, data: { status: "SUSPENDED", suspendedReason: "closed", customDomain: null } });
    } else {
      // Primero los pedidos impagos (sus ítems referencian productos y clientes de la tienda), después la tienda.
      await db.$transaction([db.order.deleteMany({ where: { storeId } }), db.store.delete({ where: { id: storeId } })]);
    }
    revalidatePath("/panel");
    return { ok: true, redirect: "/panel" };
  });
}
