import type { Order, Store } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";
import { dict, fill } from "./i18n";
import { emailLinkRow, esc, renderEmail, sendEmail } from "./email";
import { getDeliverySettings } from "./store-settings";
import { storeUrl } from "./stores";

type Delivered = { productId: string; name: string; links: { label: string; url: string }[]; isCourse: boolean };

function expiryDate(store: Store) {
  const s = getDeliverySettings(store);
  return s.linkExpiryHours && s.linkExpiryHours > 0 ? new Date(Date.now() + s.linkExpiryHours * 3600_000) : null;
}

/** Crea accesos (y links de descarga) para los ítems pagados y sus bonos. Devuelve lo entregado. */
export async function grantForItems(orderId: string, itemIds: string[]): Promise<Delivered[]> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      store: true,
      items: {
        where: { id: { in: itemIds }, status: "PAID" },
        include: { product: { include: { bonuses: { include: { bonusProduct: true }, orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  const delivery = getDeliverySettings(order.store);
  const productIds = new Set<string>();
  for (const item of order.items) {
    productIds.add(item.productId);
    if (item.kind !== "BONUS") for (const b of item.product.bonuses) productIds.add(b.bonusProductId);
  }
  const products = await db.product.findMany({
    where: { id: { in: [...productIds] } },
    include: { files: { orderBy: { sortOrder: "asc" } }, modules: { select: { id: true } } },
  });
  const delivered: Delivered[] = [];
  for (const product of products) {
    const item = order.items.find((i) => i.productId === product.id);
    const grant = await db.accessGrant.upsert({
      where: { orderId_productId: { orderId, productId: product.id } },
      create: { orderId, customerId: order.customerId, productId: product.id, orderItemId: item?.id ?? null },
      update: { revokedAt: null },
    });
    const links: Delivered["links"] = [];
    for (const file of product.files) {
      if (file.kind === "LINK" && file.url) {
        links.push({ label: file.name, url: file.url });
        continue;
      }
      let dl = await db.download.findFirst({ where: { grantId: grant.id, fileId: file.id } });
      if (!dl) {
        dl = await db.download.create({
          data: { grantId: grant.id, fileId: file.id, token: randomToken(24), maxDownloads: delivery.maxDownloads, expiresAt: expiryDate(order.store) },
        });
      }
      links.push({ label: file.name, url: storeUrl(order.store, `/d/${dl.token}`) });
    }
    delivered.push({ productId: product.id, name: product.name, links, isCourse: product.modules.length > 0 });
  }
  return delivered;
}

/** Link de ingreso al área de miembros (enlace mágico). */
export async function buyerLoginUrl(store: Store, email: string, ttlMinutes: number) {
  const token = randomToken(24);
  await db.buyerLoginToken.create({
    data: { storeId: store.id, email: email.toLowerCase(), tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return storeUrl(store, `/mis-compras/ingresar?token=${token}`);
}

export async function sendDeliveryEmail(order: Order & { store: Store }, delivered: Delivered[]) {
  if (delivered.length === 0) return;
  const store = order.store;
  const d = dict(store.language);
  const delivery = getDeliverySettings(store);
  const blocks = delivered.map((p) => {
    const rows = p.links.map((l) => emailLinkRow(`${p.name} · ${l.label}`, l.url, d.download)).join("");
    return rows || `<div style="border:1px solid #ece8e1;border-radius:12px;padding:12px 14px;margin:0 0 10px;font-weight:600">${esc(p.name)}</div>`;
  });
  const note =
    delivery.linkExpiryHours && delivery.maxDownloads
      ? fill(d.emailLinkNote, { hours: delivery.linkExpiryHours, n: delivery.maxDownloads })
      : d.emailLinkNoteNoExpiry;
  const loginUrl = await buyerLoginUrl(store, order.email, 60 * 24 * 7);
  const html = renderEmail({
    brandName: store.name,
    color: store.primaryColor,
    logoUrl: store.logoUrl,
    title: fill(d.emailHi, { name: order.name ? ` ${order.name.split(" ")[0]}` : "" }),
    paragraphs: [d.emailPurchaseIntro],
    htmlBlocks: [
      ...blocks,
      `<p style="font-size:13px;color:#5d576b;line-height:1.5">${esc(note)}</p>`,
      delivery.extraMessage ? `<p style="line-height:1.55">${esc(delivery.extraMessage)}</p>` : "",
    ],
    cta: { text: d.emailMembersCta, url: loginUrl },
    footer: `${fill(d.orderNumber, { number: order.number })} · ${fill(d.emailFooter, { store: store.name })}`,
  });
  await sendEmail({
    to: order.email,
    subject: fill(d.emailPurchaseSubject, { store: store.name }),
    html,
    kind: "delivery",
    storeId: store.id,
    fromName: store.name,
    replyTo: store.supportEmail,
  });
}

/** Reenvía accesos: renueva los links vencidos y vuelve a mandar el email. */
export async function resendAccess(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { store: true, items: true } });
  const exp = expiryDate(order.store);
  await db.download.updateMany({ where: { grant: { orderId }, expiresAt: { lt: new Date() } }, data: { expiresAt: exp } });
  const delivered = await grantForItems(orderId, order.items.filter((i) => i.status === "PAID").map((i) => i.id));
  await sendDeliveryEmail(order, delivered);
  return delivered.length;
}

export async function resetDownloads(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { store: true } });
  await db.download.updateMany({ where: { grant: { orderId } }, data: { count: 0, expiresAt: expiryDate(order.store) } });
}

export async function revokeAccess(orderId: string, productIds?: string[]) {
  await db.accessGrant.updateMany({
    where: { orderId, ...(productIds ? { productId: { in: productIds } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export function absoluteAppUrl(path: string) {
  return `${env.appUrl}${path}`;
}
