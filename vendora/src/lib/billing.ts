import { db } from "./db";
import { env } from "./env";
import { num, roundMoney } from "./money";
import { perUsd } from "./fx";
import { renderEmail, sendEmail } from "./email";
import { stripeClient } from "./gateways/stripe";
import { createPlatformPreference } from "./gateways/mercadopago";

const DAY = 86400_000;

function addMonth(d: Date) {
  const n = new Date(d);
  n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

/** Cambio de plan. Los planes pagos arrancan con prueba gratis la primera vez. Volver a Gratis no factura el abono. */
export async function changePlan(userId: string, planKey: string) {
  const [user, plan] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { plan: true } }),
    db.plan.findUniqueOrThrow({ where: { key: planKey } }),
  ]);
  if (!plan.active) throw new Error("Ese plan no está disponible");
  const now = new Date();
  const paid = num(plan.priceUsd) > 0;
  const startTrial = paid && !user.trialUsed && plan.trialDays > 0;
  await db.user.update({
    where: { id: userId },
    data: {
      planId: plan.id,
      planStartedAt: now,
      trialEndsAt: startTrial ? new Date(now.getTime() + plan.trialDays * DAY) : paid ? user.trialEndsAt : null,
      trialUsed: user.trialUsed || startTrial,
      nextBillingAt: startTrial ? new Date(now.getTime() + plan.trialDays * DAY) : paid ? now : user.nextBillingAt ?? addMonth(now),
    },
  });
  if (paid && !startTrial) await billUser(userId, now);
  return { trial: startTrial, trialDays: plan.trialDays };
}

export function inTrial(user: { trialEndsAt: Date | null }) {
  return Boolean(user.trialEndsAt && user.trialEndsAt > new Date());
}

/** Emite la factura del período: abono (si no está en prueba) + comisiones pendientes. */
export async function billUser(userId: string, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { plan: true } });
  const pending = await db.commissionEntry.findMany({ where: { userId, status: "PENDING", createdAt: { lte: now } } });
  const commissions = roundMoney(pending.reduce((s, e) => s + num(e.amountUsd), 0), "USD");
  const planAmount = num(user.plan.priceUsd) > 0 && !inTrial(user) ? num(user.plan.priceUsd) : 0;
  const total = roundMoney(planAmount + Math.max(0, commissions), "USD");
  const periodStart = user.planStartedAt > new Date(now.getTime() - 31 * DAY) ? user.planStartedAt : new Date(now.getTime() - 30 * DAY);
  let invoiceId: string | null = null;
  if (total > 0) {
    const invoice = await db.platformInvoice.create({
      data: {
        userId,
        periodStart,
        periodEnd: now,
        planKey: user.plan.key,
        planAmountUsd: planAmount,
        commissionsUsd: commissions,
        totalUsd: total,
        dueAt: new Date(now.getTime() + env.billingDueDays * DAY),
      },
    });
    invoiceId = invoice.id;
    await db.commissionEntry.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: "INVOICED", invoiceId } });
    await sendEmail({
      to: user.email,
      subject: `${env.brand}: tu factura #${invoice.number} por USD ${total.toFixed(2)}`,
      html: renderEmail({
        brandName: env.brand,
        title: `Factura #${invoice.number}`,
        paragraphs: [
          planAmount ? `Plan ${user.plan.name}: USD ${planAmount.toFixed(2)}` : `Plan ${user.plan.name}: sin cargo este período`,
          `Comisiones por ventas: USD ${commissions.toFixed(2)}`,
          `Total: USD ${total.toFixed(2)} · vence el ${invoice.dueAt.toLocaleDateString("es-AR")}`,
        ],
        cta: { text: "Pagar factura", url: `${env.appUrl}/panel/plan` },
        footer: "Si no se paga dentro del plazo de gracia, el checkout de tus tiendas se pausa hasta regularizar.",
      }),
      kind: "platform-invoice",
    });
  }
  await db.user.update({ where: { id: userId }, data: { nextBillingAt: addMonth(now) } });
  return invoiceId;
}

/** Tareas diarias de facturación: emitir facturas, marcar vencidas y suspender por falta de pago. */
export async function runBilling(now = new Date()) {
  const due = await db.user.findMany({ where: { nextBillingAt: { lte: now }, status: "ACTIVE" }, select: { id: true } });
  let issued = 0;
  for (const u of due) if (await billUser(u.id, now)) issued++;
  const overdue = await db.platformInvoice.updateMany({ where: { status: "OPEN", dueAt: { lt: now } }, data: { status: "OVERDUE" } });
  const grace = new Date(now.getTime() - env.billingGraceDays * DAY);
  const toSuspend = await db.platformInvoice.findMany({ where: { status: "OVERDUE", dueAt: { lt: grace } }, select: { userId: true } });
  let suspended = 0;
  for (const userId of new Set(toSuspend.map((i) => i.userId))) {
    const r = await db.store.updateMany({ where: { ownerId: userId, status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedReason: "billing" } });
    suspended += r.count;
  }
  return { issued, overdue: overdue.count, suspended };
}

export async function markInvoicePaid(invoiceId: string, provider: string, ref: string | null) {
  const inv = await db.platformInvoice.updateMany({
    where: { id: invoiceId, status: { in: ["OPEN", "OVERDUE"] } },
    data: { status: "PAID", paidAt: new Date(), provider, providerRef: ref },
  });
  if (inv.count === 0) return false;
  const invoice = await db.platformInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const stillOverdue = await db.platformInvoice.count({ where: { userId: invoice.userId, status: "OVERDUE" } });
  if (!stillOverdue) {
    await db.store.updateMany({ where: { ownerId: invoice.userId, status: "SUSPENDED", suspendedReason: "billing" }, data: { status: "ACTIVE", suspendedReason: null } });
  }
  return true;
}

export function platformPaymentMethods() {
  return { stripe: Boolean(process.env.PLATFORM_STRIPE_SECRET_KEY), mercadopago: Boolean(process.env.PLATFORM_MP_ACCESS_TOKEN) };
}

/** URL de pago de una factura con la cuenta de la plataforma (Stripe en USD o Mercado Pago en ARS). */
export async function invoicePaymentUrl(invoiceId: string, userId: string, method: "stripe" | "mercadopago") {
  const invoice = await db.platformInvoice.findFirstOrThrow({ where: { id: invoiceId, userId, status: { in: ["OPEN", "OVERDUE"] } }, include: { user: true } });
  const title = `${env.brand} · Factura #${invoice.number}`;
  const back = `${env.appUrl}/panel/plan?factura=${invoice.id}`;
  if (method === "stripe") {
    const key = process.env.PLATFORM_STRIPE_SECRET_KEY;
    if (!key) throw new Error("El cobro con Stripe de la plataforma no está configurado");
    const session = await stripeClient(key).checkout.sessions.create({
      mode: "payment",
      customer_email: invoice.user.email,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(num(invoice.totalUsd) * 100), product_data: { name: title } } }],
      success_url: `${back}&pago=ok`,
      cancel_url: back,
      metadata: { invoiceId: invoice.id },
    });
    return session.url!;
  }
  const token = process.env.PLATFORM_MP_ACCESS_TOKEN;
  if (!token) throw new Error("El cobro con Mercado Pago de la plataforma no está configurado");
  const ars = roundMoney(num(invoice.totalUsd) * (await perUsd("ARS")), "ARS");
  return createPlatformPreference({
    token,
    title,
    amount: ars,
    currency: "ARS",
    reference: `invoice:${invoice.id}`,
    email: invoice.user.email,
    successUrl: `${back}&pago=ok`,
    notificationUrl: `${env.appUrl}/api/webhooks/platform/mercadopago`,
  });
}
