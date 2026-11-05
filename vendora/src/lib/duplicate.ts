import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { uniqueProductSlug, uniqueStoreSlug } from "./stores";
import { assertCanCreateStore } from "./plans";

type Json = Prisma.InputJsonValue;

/** Copia un producto (con precios por market, archivos, curso y su estado) a una tienda. Devuelve el id nuevo. */
export async function copyProduct(productId: string, targetStoreId: string, marketMap: Map<string, string> = new Map(), opts: { keepName?: boolean } = {}) {
  const p = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { files: true, modules: { include: { lessons: true } }, marketPrices: true },
  });
  const sameStore = p.storeId === targetStoreId;
  const name = opts.keepName || !sameStore ? p.name : `${p.name} (copia)`;
  const copy = await db.product.create({
    data: {
      storeId: targetStoreId,
      name,
      slug: await uniqueProductSlug(targetStoreId, sameStore ? `${p.slug}-copia` : p.slug),
      type: p.type,
      status: sameStore ? "DRAFT" : p.status,
      visibility: p.visibility,
      shortDescription: p.shortDescription,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      checkoutTitle: p.checkoutTitle,
      checkoutSubtitle: p.checkoutSubtitle,
      deliveryNotice: p.deliveryNotice,
      salesPageMode: p.salesPageMode,
      salesPage: p.salesPage as Json,
      salesPageHtml: p.salesPageHtml,
      aiGenerated: p.aiGenerated,
      sortOrder: p.sortOrder,
      files: { create: p.files.map((f) => ({ kind: f.kind, name: f.name, storageKey: f.storageKey, url: f.url, size: f.size, mimeType: f.mimeType, sortOrder: f.sortOrder, aiGenerated: f.aiGenerated })) },
    },
  });
  for (const m of p.modules) {
    await db.courseModule.create({
      data: {
        productId: copy.id,
        title: m.title,
        sortOrder: m.sortOrder,
        lessons: { create: m.lessons.map((l) => ({ title: l.title, content: l.content, videoUrl: l.videoUrl, fileUrl: l.fileUrl, sortOrder: l.sortOrder })) },
      },
    });
  }
  for (const mp of p.marketPrices) {
    const marketId = sameStore ? mp.marketId : marketMap.get(mp.marketId);
    if (marketId) await db.productMarketPrice.create({ data: { productId: copy.id, marketId, price: mp.price, compareAtPrice: mp.compareAtPrice } });
  }
  return copy.id;
}

/** Copia un embudo (nodos, ramas y variantes A/B). Si es a otra tienda, copia también los productos que usa. */
export async function copyFunnel(funnelId: string, targetStoreId: string, productMap?: Map<string, string>) {
  const f = await db.funnel.findUniqueOrThrow({ where: { id: funnelId }, include: { nodes: { include: { variants: true } } } });
  const sameStore = f.storeId === targetStoreId;
  const pmap = productMap ?? new Map<string, string>();
  if (!sameStore && !productMap) {
    for (const n of f.nodes) if (!pmap.has(n.productId)) pmap.set(n.productId, await copyProduct(n.productId, targetStoreId));
  }
  const mapProduct = (id: string) => (sameStore ? id : pmap.get(id) ?? id);
  const copy = await db.funnel.create({
    data: {
      storeId: targetStoreId,
      name: sameStore ? `${f.name} (copia)` : f.name,
      status: "PAUSED",
      trigger: f.trigger,
      triggerProductIds: f.triggerProductIds.map(mapProduct),
      priority: f.priority,
      reservationMinutes: f.reservationMinutes,
      onTimerExpire: f.onTimerExpire,
      thankYouOverride: (f.thankYouOverride ?? undefined) as Json | undefined,
    },
  });
  const idMap = new Map<string, string>();
  for (const n of f.nodes) {
    const node = await db.funnelNode.create({
      data: {
        funnelId: copy.id,
        type: n.type,
        label: n.label,
        productId: mapProduct(n.productId),
        pricingMode: n.pricingMode,
        discountPercent: n.discountPercent,
        compareAgainst: n.compareAgainst,
        fixedPrice: n.fixedPrice,
        contentMode: n.contentMode,
        title: n.title,
        subtitle: n.subtitle,
        body: n.body,
        imageUrl: n.imageUrl,
        videoUrl: n.videoUrl,
        acceptText: n.acceptText,
        declineText: n.declineText,
        timerText: n.timerText,
        customHtml: n.customHtml,
        abTestActive: n.abTestActive,
        variants: { create: n.variants.map((v) => ({ key: v.key, discountPercent: v.discountPercent, fixedPrice: v.fixedPrice, title: v.title, body: v.body, acceptText: v.acceptText, customHtml: v.customHtml })) },
      },
    });
    idMap.set(n.id, node.id);
  }
  for (const n of f.nodes) {
    await db.funnelNode.update({
      where: { id: idMap.get(n.id)! },
      data: { acceptNextId: n.acceptNextId ? idMap.get(n.acceptNextId) ?? null : null, declineNextId: n.declineNextId ? idMap.get(n.declineNextId) ?? null : null },
    });
  }
  await db.funnel.update({ where: { id: copy.id }, data: { entryNodeId: f.entryNodeId ? idMap.get(f.entryNodeId) ?? null : null } });
  return copy.id;
}

/** Duplica una tienda completa: configuración, markets, pagos, productos, bonos, bumps, embudos, cupones, contenido y recursos. */
export async function duplicateStore(storeId: string, userId: string, newName: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { plan: true } });
  await assertCanCreateStore(userId, user.plan);
  const s = await db.store.findUniqueOrThrow({
    where: { id: storeId },
    include: { markets: true, gateways: true, products: { select: { id: true } }, orderBumps: true, funnels: { select: { id: true } }, coupons: true, media: true },
  });
  const copy = await db.store.create({
    data: {
      ownerId: userId,
      name: newName,
      slug: await uniqueStoreSlug(newName),
      type: s.type,
      language: s.language,
      timezone: s.timezone,
      baseCurrency: s.baseCurrency,
      testMode: s.testMode,
      logoUrl: s.logoUrl,
      bannerUrl: s.bannerUrl,
      primaryColor: s.primaryColor,
      accentColor: s.accentColor,
      headline: s.headline,
      description: s.description,
      metaTitle: s.metaTitle,
      metaDescription: s.metaDescription,
      noindex: s.noindex,
      aiContext: s.aiContext,
      supportEmail: s.supportEmail,
      supportWhatsapp: s.supportWhatsapp,
      legalName: s.legalName,
      legalTaxId: s.legalTaxId,
      legalAddress: s.legalAddress,
      guaranteeDays: s.guaranteeDays,
      termsText: s.termsText,
      privacyText: s.privacyText,
      refundText: s.refundText,
      landingMode: s.landingMode,
      landingHtml: s.landingHtml,
      checkoutSettings: s.checkoutSettings as Json,
      deliverySettings: s.deliverySettings as Json,
      thankYouSettings: s.thankYouSettings as Json,
      recoverySettings: s.recoverySettings as Json,
      notifySettings: s.notifySettings as Json,
      metaPixelId: s.metaPixelId,
      metaCapiTokenEnc: s.metaCapiTokenEnc,
      ga4Id: s.ga4Id,
      tiktokPixelId: s.tiktokPixelId,
    },
  });
  const marketMap = new Map<string, string>();
  for (const m of s.markets) {
    const nm = await db.market.create({ data: { storeId: copy.id, name: m.name, currency: m.currency, countries: m.countries, isDefault: m.isDefault, rate: m.rate, rounding: m.rounding, active: m.active } });
    marketMap.set(m.id, nm.id);
  }
  for (const g of s.gateways) {
    await db.paymentGateway.create({ data: { storeId: copy.id, provider: g.provider, enabled: g.enabled, displayName: g.displayName, credentialsEnc: g.credentialsEnc, settings: g.settings as Json, sortOrder: g.sortOrder } });
  }
  const productMap = new Map<string, string>();
  for (const p of s.products) productMap.set(p.id, await copyProduct(p.id, copy.id, marketMap, { keepName: true }));
  const bonuses = await db.productBonus.findMany({ where: { product: { storeId } } });
  for (const b of bonuses) {
    await db.productBonus.create({ data: { productId: productMap.get(b.productId)!, bonusProductId: productMap.get(b.bonusProductId)!, sortOrder: b.sortOrder } });
  }
  for (const b of s.orderBumps) {
    await db.orderBump.create({
      data: {
        storeId: copy.id,
        mainProductId: productMap.get(b.mainProductId)!,
        offerProductId: productMap.get(b.offerProductId)!,
        pricingMode: b.pricingMode,
        discountPercent: b.discountPercent,
        compareAgainst: b.compareAgainst,
        fixedPrice: b.fixedPrice,
        headline: b.headline,
        description: b.description,
        buttonText: b.buttonText,
        imageUrl: b.imageUrl,
        timerEnabled: b.timerEnabled,
        timerMinutes: b.timerMinutes,
        active: b.active,
        sortOrder: b.sortOrder,
      },
    });
  }
  for (const f of s.funnels) await copyFunnel(f.id, copy.id, productMap);
  for (const c of s.coupons) {
    await db.coupon.create({
      data: { storeId: copy.id, code: c.code, type: c.type, value: c.value, productIds: c.productIds.map((id) => productMap.get(id) ?? id), startsAt: c.startsAt, endsAt: c.endsAt, maxUses: c.maxUses, active: c.active },
    });
  }
  for (const m of s.media) {
    await db.mediaAsset.create({ data: { storeId: copy.id, name: m.name, storageKey: m.storageKey, url: m.url, mimeType: m.mimeType, size: m.size } });
  }
  if (s.mainProductId && productMap.has(s.mainProductId)) {
    await db.store.update({ where: { id: copy.id }, data: { mainProductId: productMap.get(s.mainProductId) } });
  }
  return copy.id;
}
