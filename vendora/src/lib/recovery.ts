import { db } from "./db";
import { dict, fill } from "./i18n";
import { esc, renderEmail, sendEmail } from "./email";
import { getRecoverySettings } from "./store-settings";
import { storeUrl } from "./stores";
import { formatMoney } from "./money";

const ABANDON_AFTER_MIN = 30;

/** Marca carritos abandonados y envía la secuencia de recuperación (solo planes con recuperación de carritos). */
export async function runRecovery(now = new Date()) {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_MIN * 60_000);
  const open = await db.checkout.findMany({
    where: { status: "OPEN", email: { not: null }, emailCapturedAt: { lt: cutoff } },
    select: { id: true, storeId: true, email: true, productId: true, createdAt: true, orderId: true },
    take: 500,
  });
  let abandoned = 0;
  for (const c of open) {
    const paid = await db.order.findFirst({
      where: { storeId: c.storeId, email: c.email!, status: "PAID", createdAt: { gte: c.createdAt }, items: { some: { productId: c.productId, kind: "MAIN" } } },
      select: { id: true },
    });
    if (paid) {
      await db.checkout.update({ where: { id: c.id }, data: { status: "COMPLETED", orderId: paid.id } });
      continue;
    }
    await db.checkout.update({ where: { id: c.id }, data: { status: "ABANDONED" } });
    abandoned++;
  }

  const candidates = await db.checkout.findMany({
    where: { status: "ABANDONED", email: { not: null }, recoveryStep: { lt: 3 }, store: { status: "ACTIVE", owner: { plan: { cartRecovery: true } } } },
    include: { store: true },
    take: 500,
  });
  let sent = 0;
  for (const c of candidates) {
    const settings = getRecoverySettings(c.store);
    if (!settings.enabled) continue;
    const step = settings.steps[c.recoveryStep];
    if (!step || !c.emailCapturedAt) continue;
    if (c.emailCapturedAt.getTime() + step.delayMinutes * 60_000 > now.getTime()) continue;
    const paid = await db.order.findFirst({ where: { storeId: c.storeId, email: c.email!, status: "PAID", createdAt: { gte: c.createdAt } }, select: { id: true } });
    if (paid) {
      await db.checkout.update({ where: { id: c.id }, data: { status: "COMPLETED", orderId: paid.id } });
      continue;
    }
    const product = await db.product.findUnique({ where: { id: c.productId }, select: { name: true, imageUrl: true } });
    if (!product) continue;
    const d = dict(c.store.language);
    const n = (c.recoveryStep + 1) as 1 | 2 | 3;
    const subject = fill(step.subject || d[`emailRecoverySubject${n}`], { product: product.name, store: c.store.name });
    const body = fill(step.body || d[`emailRecoveryBody${n}`], { product: product.name, store: c.store.name });
    const coupon = step.couponCode?.trim().toUpperCase();
    const url = storeUrl(c.store, `/recuperar/${c.id}${coupon ? `?cupon=${encodeURIComponent(coupon)}` : ""}`);
    const html = renderEmail({
      brandName: c.store.name,
      color: c.store.primaryColor,
      logoUrl: c.store.logoUrl,
      title: subject,
      paragraphs: body.split("\n").filter(Boolean),
      htmlBlocks: [
        product.imageUrl ? `<p><img src="${esc(product.imageUrl)}" alt="" style="max-width:220px;border-radius:12px"></p>` : "",
        `<p style="font-weight:600">${esc(product.name)} · ${esc(formatMoney(c.total, c.currency, c.store.language))}</p>`,
        coupon ? `<p style="background:#fff4ec;border-radius:10px;padding:10px 12px">${esc(fill(d.emailCouponLine, { code: coupon }))}</p>` : "",
      ],
      cta: { text: d.emailRecoveryCta, url },
      footer: fill(d.emailFooter, { store: c.store.name }),
    });
    await sendEmail({ to: c.email!, subject, html, kind: `recovery-${n}`, storeId: c.storeId, fromName: c.store.name, replyTo: c.store.supportEmail });
    await db.checkout.update({ where: { id: c.id }, data: { recoveryStep: { increment: 1 }, lastRecoveryAt: now } });
    sent++;
  }
  return { abandoned, sent };
}
