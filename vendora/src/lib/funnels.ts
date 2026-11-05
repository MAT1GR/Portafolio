import { db } from "./db";
import { num, roundMoney } from "./money";
import { advance, applyVariant, ensureImpression, loadNode } from "./funnel-core";
import { applyProviderStatus, approvePayment, getBuyerOrder, rejectPayment, orderUrls, webhookUrl } from "./orders";
import { chargeFor, createProviderPayment, gatewayCreds, gatewaySettings } from "./gateways";
import * as stripeGw from "./gateways/stripe";

export type OfferState = Awaited<ReturnType<typeof getOfferState>>;

/** Estado del embudo para el comprador: oferta actual (con reserva) o null si terminó. Resuelve vencimientos. */
export async function getOfferState(orderId: string, key: string | null | undefined) {
  for (let guard = 0; guard < 20; guard++) {
    const order = await getBuyerOrder(orderId, key);
    if (!order) return { error: "not_found" as const };
    if (order.status !== "PAID" || !order.funnelId || order.funnelDone || !order.currentNodeId) return { order, done: true as const };
    const node = await loadNode(order.currentNodeId);
    if (!node || node.funnel.status !== "ACTIVE") {
      await advance(order.id, null);
      continue;
    }
    const market = order.marketId ? await db.market.findUnique({ where: { id: order.marketId } }) : null;
    const impression = await ensureImpression(order, node, market, order.store.baseCurrency);
    if (impression.result === "ACCEPTED") {
      await advance(order.id, node.acceptNextId);
      continue;
    }
    if (impression.result === "DECLINED" || impression.result === "FAILED") {
      await advance(order.id, node.declineNextId);
      continue;
    }
    if (impression.result === "EXPIRED") {
      await advance(order.id, node.funnel.onTimerExpire === "NEXT_OFFER" ? node.declineNextId : null);
      continue;
    }
    const pendingPayment = await db.payment.findFirst({
      where: { orderId: order.id, kind: "OFFER", status: "PENDING", provider: { not: "TRANSFER" } },
      orderBy: { createdAt: "desc" },
    });
    if (!pendingPayment && impression.expiresAt < new Date()) {
      await db.offerImpression.update({ where: { id: impression.id }, data: { result: "EXPIRED", decidedAt: new Date() } });
      continue;
    }
    const variant = node.variants.find((v) => v.key === impression.variantKey) ?? null;
    return {
      order,
      done: false as const,
      node: applyVariant(node, variant),
      product: node.product,
      funnel: node.funnel,
      impression,
      price: num(impression.price),
      currency: impression.currency,
      compareAt: compareFor(node, variant, num(impression.price), impression.currency),
      remainingMs: Math.max(0, impression.expiresAt.getTime() - Date.now()),
      pendingPaymentId: pendingPayment?.id ?? null,
    };
  }
  return { error: "loop" as const };
}

function compareFor(node: NonNullable<Awaited<ReturnType<typeof loadNode>>>, variant: { discountPercent: number | null } | null, price: number, currency: string) {
  const pct = variant?.discountPercent ?? node.discountPercent;
  const base = num(node.product.compareAtPrice) || num(node.product.price);
  if (node.pricingMode === "DISCOUNT" && pct > 0 && pct < 100) return roundMoney(price / (1 - pct / 100), currency);
  return base > price ? base : null;
}

export type AcceptResult =
  | { status: "approved" | "added" | "stale" | "rejected" }
  | { status: "redirect"; url: string }
  | { status: "action_required"; clientSecret: string; publishableKey: string; paymentId: string };

export async function acceptOffer(orderId: string, key: string, nodeId: string): Promise<AcceptResult> {
  const state = await getOfferState(orderId, key);
  if ("error" in state || state.done || state.node.id !== nodeId) return { status: "stale" };
  const { order, node, product, price, currency, impression } = state;
  const store = await db.store.findUniqueOrThrow({ where: { id: order.storeId }, include: { gateways: true } });
  const initial = order.payments.find((p) => p.kind === "INITIAL")!;

  // Transferencia: la oferta se suma al pago pendiente (o queda como pago a aprobar por el vendedor).
  if (order.provider === "TRANSFER") {
    if (initial.status === "PENDING") {
      await db.orderItem.create({
        data: { orderId, productId: product.id, kind: node.type, name: product.name, unitPrice: price, total: price, nodeId, paymentId: initial.id },
      });
      await db.payment.update({ where: { id: initial.id }, data: { amount: { increment: price }, chargedAmount: { increment: price } } });
      await db.order.update({ where: { id: orderId }, data: { total: { increment: price }, subtotal: { increment: price } } });
    } else {
      const pay = await db.payment.create({ data: { orderId, provider: "TRANSFER", kind: "OFFER", amount: price, currency, chargedAmount: price, chargedCurrency: currency } });
      await db.orderItem.create({ data: { orderId, productId: product.id, kind: node.type, name: product.name, unitPrice: price, total: price, nodeId, paymentId: pay.id } });
    }
    await db.offerImpression.update({ where: { id: impression.id }, data: { result: "ACCEPTED", revenue: price, decidedAt: new Date() } });
    await advance(orderId, node.acceptNextId);
    return { status: "added" };
  }

  const gateway = store.gateways.find((g) => g.provider === order.provider && g.enabled);
  if (!gateway) {
    await db.offerImpression.update({ where: { id: impression.id }, data: { result: "FAILED", decidedAt: new Date() } });
    await advance(orderId, node.declineNextId);
    return { status: "rejected" };
  }
  const charge = (await chargeFor(gateway, currency, price)) ?? { currency, amount: price };
  const payment = await db.payment.create({
    data: { orderId, provider: gateway.provider, kind: "OFFER", amount: price, currency, chargedAmount: charge.amount, chargedCurrency: charge.currency },
  });
  await db.orderItem.create({
    data: { orderId, productId: product.id, kind: node.type, name: product.name, unitPrice: price, total: price, nodeId, paymentId: payment.id },
  });
  const urls = orderUrls(order.store, order, payment.id);
  const result = await createProviderPayment({
    store: order.store,
    gateway,
    creds: gatewayCreds(gateway),
    settings: gatewaySettings(gateway),
    order,
    payment,
    amount: charge.amount,
    chargeCurrency: charge.currency,
    description: product.name,
    buyer: { email: order.email, name: order.name, phone: order.phone },
    returnUrl: urls.returnUrl,
    cancelUrl: urls.cancelUrl,
    notificationUrl: webhookUrl(gateway.provider, gateway.id),
    kind: "OFFER",
    saved: { customerRef: initial.customerRef, paymentMethodRef: initial.paymentMethodRef },
  }).catch((e: Error) => ({ type: "rejected" as const, reason: e.message }));

  switch (result.type) {
    case "approved":
      await approvePayment(payment.id, { providerPaymentId: result.providerPaymentId ?? null });
      return { status: "approved" };
    case "action_required":
      await db.payment.update({ where: { id: payment.id }, data: { providerRef: result.providerRef } });
      return { status: "action_required", clientSecret: result.clientSecret, publishableKey: result.publishableKey, paymentId: payment.id };
    case "redirect":
      await db.payment.update({ where: { id: payment.id }, data: { providerRef: result.providerRef ?? null } });
      return { status: "redirect", url: result.url };
    case "stripe":
      // Sin medio de pago guardado: se completa con el formulario de Stripe en la página de la oferta.
      await db.payment.update({ where: { id: payment.id }, data: { providerRef: result.providerRef, customerRef: result.customerRef ?? null } });
      return { status: "action_required", clientSecret: result.clientSecret, publishableKey: result.publishableKey, paymentId: payment.id };
    case "rejected":
    default:
      await rejectPayment(payment.id, "reason" in result ? result.reason : "rejected");
      return { status: "rejected" };
  }
}

export async function declineOffer(orderId: string, key: string, nodeId: string) {
  const state = await getOfferState(orderId, key);
  if ("error" in state || state.done || state.node.id !== nodeId) return false;
  await db.offerImpression.update({ where: { id: state.impression.id }, data: { result: "DECLINED", decidedAt: new Date() } });
  await db.payment.updateMany({ where: { orderId, kind: "OFFER", status: "PENDING", provider: { not: "TRANSFER" } }, data: { status: "CANCELLED" } });
  await advance(orderId, state.node.declineNextId);
  return true;
}

/** Después de resolver la autenticación 3DS de una oferta con Stripe. */
export async function confirmStripeOffer(orderId: string, key: string, paymentId: string) {
  const order = await getBuyerOrder(orderId, key);
  if (!order) return false;
  const payment = await db.payment.findFirst({ where: { id: paymentId, orderId, provider: "STRIPE" } });
  if (!payment?.providerRef) return false;
  const gateway = await db.paymentGateway.findUniqueOrThrow({ where: { storeId_provider: { storeId: order.storeId, provider: "STRIPE" } } });
  const st = await stripeGw.fetchIntent(gatewayCreds(gateway), payment.providerRef);
  await applyProviderStatus(payment.id, st);
  return st.status === "APPROVED";
}
