import type { CheckoutTest, GatewayProvider, Market, OrderBump, Product, ProductBonus, ProductMarketPrice, Store } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { randomToken } from "./crypto";
import { dict, fill } from "./i18n";
import { formatMoney, num, roundMoney } from "./money";
import { couponDiscount, couponIsValid, offerPrice, productPrice, type Price } from "./pricing";
import { pickMarket } from "./geo";
import { chargeFor, commissionApplies, createProviderPayment, gatewayCreds, gatewaySettings, GatewayError } from "./gateways";
import type { CreatePaymentResult } from "./gateways/types";
import { storeUrl } from "./stores";
import { grantForItems, sendDeliveryEmail, revokeAccess } from "./delivery";
import { recordEvent, sendCapi, asUtm, type Utm } from "./tracking";
import { toUsd } from "./fx";
import { pushToUsers } from "./push";
import { renderEmail, sendEmail } from "./email";
import { getNotifySettings } from "./store-settings";
import { advance, pickFunnel } from "./funnel-core";
import * as mercadopago from "./gateways/mercadopago";
import * as stripeGw from "./gateways/stripe";
import * as paypal from "./gateways/paypal";
import * as whop from "./gateways/whop";

export class CheckoutError extends Error {}

type ProductForQuote = Product & { marketPrices: ProductMarketPrice[] };
type BumpForQuote = OrderBump & { offerProduct: ProductForQuote };

export type AbOverride = {
  title?: string;
  subtitle?: string;
  price?: number | null;
  compareAtPrice?: number | null;
  showBumps?: boolean;
  buttonText?: string;
};

export function abVariantData(test: CheckoutTest | null | undefined, variant: string | null | undefined): AbOverride | null {
  if (!test || !variant) return null;
  const raw = (variant === "B" ? test.variantB : test.variantA) as Record<string, unknown> | null;
  if (!raw) return null;
  const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : undefined,
    price: n(raw.price),
    compareAtPrice: n(raw.compareAtPrice),
    showBumps: raw.showBumps === undefined ? true : Boolean(raw.showBumps),
    buttonText: typeof raw.buttonText === "string" ? raw.buttonText : undefined,
  };
}

export type Quote = {
  currency: string;
  main: Price;
  bumps: { bump: BumpForQuote; price: Price }[];
  coupon: { code: string; discount: number } | null;
  subtotal: number;
  discount: number;
  total: number;
};

/** Cálculo autoritativo del checkout (precio por market, A/B, order bumps elegidos y cupón). */
export async function quoteCheckout(input: {
  store: Store;
  product: ProductForQuote;
  market: Market | null;
  bumps: BumpForQuote[];
  selectedBumpIds: string[];
  couponCode?: string | null;
  ab?: AbOverride | null;
}): Promise<Quote> {
  const { store, product, market, ab } = input;
  let main = productPrice(product, market, store.baseCurrency);
  if (ab && ab.price !== null && ab.price !== undefined) {
    main = productPrice({ price: ab.price, compareAtPrice: ab.compareAtPrice ?? product.compareAtPrice }, market, store.baseCurrency);
  }
  const currency = main.currency;
  const allowBumps = ab?.showBumps !== false;
  const bumps = allowBumps
    ? input.bumps
        .filter((b) => b.active && input.selectedBumpIds.includes(b.id))
        .map((bump) => ({ bump, price: offerPrice(bump.offerProduct, bump, market, store.baseCurrency) }))
    : [];
  let coupon: Quote["coupon"] = null;
  if (input.couponCode) {
    const c = await db.coupon.findUnique({ where: { storeId_code: { storeId: store.id, code: input.couponCode.trim().toUpperCase() } } });
    if (c && couponIsValid(c, product.id)) {
      coupon = { code: c.code, discount: couponDiscount(c, main.price, market, store.baseCurrency, currency) };
    }
  }
  const subtotal = roundMoney(main.price + bumps.reduce((s, b) => s + b.price.price, 0), currency);
  const discount = coupon?.discount ?? 0;
  return { currency, main, bumps, coupon, subtotal, discount, total: roundMoney(Math.max(0, subtotal - discount), currency) };
}

export async function loadCheckoutProduct(storeId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, storeId, status: "PUBLISHED", visibility: { in: ["PUBLIC", "HIDDEN"] } },
    include: {
      marketPrices: true,
      bonuses: { include: { bonusProduct: true }, orderBy: { sortOrder: "asc" } },
      bumpsAsMain: {
        where: { active: true, offerProduct: { status: { not: "ARCHIVED" } } },
        orderBy: { sortOrder: "asc" },
        include: { offerProduct: { include: { marketPrices: true } } },
      },
    },
  });
}

export function orderUrls(store: Store, order: { id: string; accessKey: string }, paymentId: string) {
  return {
    returnUrl: storeUrl(store, `/pago/${order.id}?k=${order.accessKey}&p=${paymentId}`),
    cancelUrl: storeUrl(store, `/pago/${order.id}?k=${order.accessKey}&p=${paymentId}&cancel=1`),
  };
}

export function webhookUrl(provider: GatewayProvider, gatewayId: string) {
  return `${env.appUrl}/api/webhooks/${provider.toLowerCase()}/${gatewayId}`;
}

export type PayInput = {
  storeId: string;
  productId: string;
  checkoutId?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  marketId?: string | null;
  provider: GatewayProvider;
  bumpIds: string[];
  couponCode?: string | null;
  visitorId?: string | null;
  utm?: Utm;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
  abTestId?: string | null;
  abVariant?: string | null;
};

/** Crea el pedido y el pago inicial, y abre el cobro en la pasarela elegida. */
export async function createOrder(input: PayInput) {
  const store = await db.store.findUnique({ where: { id: input.storeId }, include: { markets: true, gateways: true } });
  if (!store) throw new CheckoutError("Tienda no encontrada");
  const d = dict(store.language);
  if (store.status !== "ACTIVE") throw new CheckoutError(d.storeUnavailable);
  const product = await loadCheckoutProduct(store.id, input.productId);
  if (!product) throw new CheckoutError("Producto no disponible");
  const market = (input.marketId ? store.markets.find((m) => m.id === input.marketId && m.active) : null) ?? pickMarket(store.markets, input.country ?? null);
  const gateway = store.gateways.find((g) => g.provider === input.provider && g.enabled);
  if (!gateway) throw new CheckoutError(d.noGateways);
  if (gateway.provider === "TEST" && !(store.testMode && env.allowTestPayments)) throw new CheckoutError(d.noGateways);

  const test =
    input.abTestId && store.type === "CHECKOUT"
      ? await db.checkoutTest.findFirst({ where: { id: input.abTestId, storeId: store.id, productId: product.id, active: true } })
      : null;
  const ab = abVariantData(test, input.abVariant);
  const quote = await quoteCheckout({ store, product, market, bumps: product.bumpsAsMain, selectedBumpIds: input.bumpIds, couponCode: input.couponCode, ab });
  const charge = await chargeFor(gateway, quote.currency, quote.total);
  if (!charge) throw new CheckoutError(d.noGateways);

  const email = input.email.trim().toLowerCase();
  const customer = await db.customer.upsert({
    where: { storeId_email: { storeId: store.id, email } },
    create: { storeId: store.id, email, name: input.name || null, phone: input.phone || null, country: input.country || null },
    update: { name: input.name || undefined, phone: input.phone || undefined, country: input.country || undefined },
  });
  const seq = await db.store.update({ where: { id: store.id }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });

  const mainName = ab?.title || product.name;
  const items = [
    { productId: product.id, kind: "MAIN" as const, name: mainName, unitPrice: quote.main.price, total: quote.main.price },
    ...quote.bumps.map((b) => ({ productId: b.bump.offerProductId, kind: "BUMP" as const, name: b.bump.offerProduct.name, unitPrice: b.price.price, total: b.price.price })),
    ...product.bonuses.map((b: ProductBonus & { bonusProduct: Product }) => ({ productId: b.bonusProductId, kind: "BONUS" as const, name: b.bonusProduct.name, unitPrice: 0, total: 0 })),
  ];

  const order = await db.order.create({
    data: {
      number: seq.orderSeq,
      storeId: store.id,
      customerId: customer.id,
      checkoutId: input.checkoutId ?? null,
      email,
      name: input.name || null,
      phone: input.phone || null,
      country: input.country || null,
      marketId: market?.id ?? null,
      currency: quote.currency,
      subtotal: quote.subtotal,
      discountTotal: quote.discount,
      total: quote.total,
      couponCode: quote.coupon?.code ?? null,
      provider: gateway.provider,
      utm: (input.utm ?? {}) as object,
      visitorId: input.visitorId ?? null,
      fbp: input.fbp ?? null,
      fbc: input.fbc ?? null,
      clientIp: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      abTestId: test ? test.id : null,
      abVariant: test ? input.abVariant ?? null : null,
      accessKey: randomToken(18),
      testMode: gateway.provider === "TEST" || store.testMode,
      items: { create: items },
    },
  });
  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      provider: gateway.provider,
      kind: "INITIAL",
      amount: quote.total,
      currency: quote.currency,
      chargedAmount: charge.amount,
      chargedCurrency: charge.currency,
    },
  });
  await db.orderItem.updateMany({ where: { orderId: order.id }, data: { paymentId: payment.id } });
  if (input.checkoutId) {
    await db.checkout
      .update({ where: { id: input.checkoutId }, data: { orderId: order.id, email, name: input.name || undefined, total: quote.total } })
      .catch(() => undefined);
  }
  if (input.visitorId) {
    await recordEvent({
      storeId: store.id,
      type: "PAYMENT_INITIATED",
      visitorId: input.visitorId,
      productId: product.id,
      checkoutId: input.checkoutId,
      orderId: order.id,
      value: quote.total,
      currency: quote.currency,
      utm: input.utm,
      abVariant: order.abVariant,
    });
  }

  let result: CreatePaymentResult;
  if (quote.total <= 0) {
    result = { type: "approved", providerPaymentId: "free" };
  } else {
    const urls = orderUrls(store, order, payment.id);
    try {
      result = await createProviderPayment({
        store,
        gateway,
        creds: gatewayCreds(gateway),
        settings: gatewaySettings(gateway),
        order,
        payment,
        amount: charge.amount,
        chargeCurrency: charge.currency,
        description: items.filter((i) => i.total > 0).map((i) => i.name).join(" + "),
        buyer: { email, name: input.name, phone: input.phone },
        returnUrl: urls.returnUrl,
        cancelUrl: urls.cancelUrl,
        notificationUrl: webhookUrl(gateway.provider, gateway.id),
        kind: "INITIAL",
      });
    } catch (e) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "REJECTED", failureReason: String((e as Error).message).slice(0, 300) } });
      await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      throw e instanceof GatewayError ? new CheckoutError(e.message) : e;
    }
  }
  if (result.type === "redirect" || result.type === "stripe") {
    await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: result.providerRef ?? null, customerRef: result.type === "stripe" ? result.customerRef ?? null : null },
    });
  }
  if (result.type === "approved") await approvePayment(payment.id, { providerPaymentId: result.providerPaymentId ?? null });
  if (result.type === "manual") await sendTransferInstructions(order.id);
  return { order, payment, result };
}

// ───────────── Aprobación / rechazo / reembolso ─────────────

type ApproveInfo = { providerPaymentId?: string | null; paymentMethodRef?: string | null; customerRef?: string | null; raw?: unknown };

/** Marca un pago como aprobado (idempotente) y dispara entrega, comisión, métricas, CAPI y avisos. */
export async function approvePayment(paymentId: string, info: ApproveInfo = {}) {
  const res = await db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["PENDING", "REJECTED", "CANCELLED"] } },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        ...(info.providerPaymentId ? { providerPaymentId: info.providerPaymentId } : {}),
        ...(info.paymentMethodRef ? { paymentMethodRef: info.paymentMethodRef } : {}),
        ...(info.customerRef ? { customerRef: info.customerRef } : {}),
        ...(info.raw ? { raw: info.raw as object } : {}),
        failureReason: null,
      },
    });
    if (updated.count === 0) return null;
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    await tx.orderItem.updateMany({ where: { paymentId }, data: { status: "PAID" } });
    const firstPaid = !payment.order.paidAt;
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "PAID", paidAt: payment.order.paidAt ?? new Date(), paidTotal: { increment: payment.amount } },
    });
    return { payment, firstPaid };
  });
  if (!res) return false;
  await afterApproval(res.payment.id, res.firstPaid);
  return true;
}

async function afterApproval(paymentId: string, firstPaid: boolean) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { order: { include: { store: { include: { owner: { include: { plan: true } } } }, items: true } } },
  });
  const order = payment.order;
  const store = order.store;
  const paidItems = order.items.filter((i) => i.paymentId === payment.id);

  if (payment.kind === "INITIAL" && firstPaid) {
    const productIds = paidItems.map((i) => i.productId);
    const funnel = await pickFunnel(store.id, productIds);
    await db.order.update({
      where: { id: order.id },
      data: { funnelId: funnel?.id ?? null, currentNodeId: funnel?.entryNodeId ?? null, funnelDone: !funnel },
    });
    if (order.couponCode) {
      await db.coupon.updateMany({ where: { storeId: store.id, code: order.couponCode }, data: { usedCount: { increment: 1 } } });
    }
    if (order.checkoutId) {
      const co = await db.checkout.findUnique({ where: { id: order.checkoutId } });
      if (co) {
        await db.checkout.update({
          where: { id: co.id },
          data: co.recoveryStep > 0 ? { status: "RECOVERED", recoveredAt: new Date(), orderId: order.id } : { status: "COMPLETED", orderId: order.id },
        });
      }
    }
  }

  if (payment.kind === "OFFER") {
    const nodeItem = paidItems.find((i) => i.nodeId);
    if (nodeItem?.nodeId) {
      await db.offerImpression.updateMany({
        where: { orderId: order.id, nodeId: nodeItem.nodeId },
        data: { result: "ACCEPTED", revenue: payment.amount, decidedAt: new Date() },
      });
      const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      if (fresh.currentNodeId === nodeItem.nodeId) {
        const node = await db.funnelNode.findUnique({ where: { id: nodeItem.nodeId } });
        await advance(order.id, node?.acceptNextId ?? null);
      }
    }
  }

  // Comisión de la plataforma (no aplica a PayPal, transferencia ni pruebas)
  if (commissionApplies(payment.provider) && !order.testMode && num(payment.amount) > 0) {
    const rateBps = store.owner.plan.commissionBps;
    const charged = num(payment.chargedAmount ?? payment.amount);
    const chargedCurrency = payment.chargedCurrency ?? payment.currency;
    const commission = roundMoney((charged * rateBps) / 10000, chargedCurrency);
    await db.commissionEntry
      .create({
        data: {
          userId: store.ownerId,
          storeId: store.id,
          orderId: order.id,
          paymentId: payment.id,
          provider: payment.provider,
          amount: commission,
          currency: chargedCurrency,
          amountUsd: await toUsd(commission, chargedCurrency),
          rateBps,
        },
      })
      .catch(() => undefined);
  }

  // Entrega
  const delivered = await grantForItems(order.id, paidItems.map((i) => i.id));
  await sendDeliveryEmail(order, delivered);

  // Métricas y API de Conversiones
  const utm = asUtm(order.utm);
  await recordEvent({
    storeId: store.id,
    type: "PURCHASE",
    visitorId: order.visitorId || `order-${order.id}`,
    productId: paidItems[0]?.productId,
    orderId: order.id,
    value: num(payment.amount),
    currency: payment.currency,
    utm,
    country: order.country,
    abVariant: order.abVariant,
  });
  await sendCapi(store, {
    eventName: "Purchase",
    eventId: `purchase-${payment.id}`,
    eventSourceUrl: storeUrl(store, "/"),
    value: num(payment.amount),
    currency: payment.currency,
    contentIds: paidItems.map((i) => i.productId),
    contentName: paidItems.map((i) => i.name).join(" + "),
    email: order.email,
    phone: order.phone,
    name: order.name,
    country: order.country,
    ip: order.clientIp,
    userAgent: order.userAgent,
    fbp: order.fbp,
    fbc: order.fbc,
    externalId: order.customerId,
  });

  await notifySale(payment.id);
}

async function notifySale(paymentId: string) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { order: { include: { store: { include: { owner: true, members: true } }, items: { where: { paymentId } } } } },
  });
  const { order } = payment;
  const store = order.store;
  const amount = formatMoney(payment.amount, payment.currency, "es");
  const what = order.items.filter((i) => i.kind !== "BONUS").map((i) => i.name).join(" + ");
  const title = payment.kind === "OFFER" ? `Upsell aceptado: ${amount}` : `Nueva venta: ${amount}`;
  const recipients = [store.ownerId, ...store.members.filter((m) => m.role !== "SUPPORT").map((m) => m.userId)];
  await pushToUsers([...new Set(recipients)], { title, body: `${store.name} · ${what}`, url: `/app`, tag: `sale-${order.id}` });
  const notify = getNotifySettings(store);
  if (notify.emailOnSale && store.owner.notifyEmailOnSale && !order.testMode) {
    await sendEmail({
      to: store.owner.email,
      subject: `${title} en ${store.name}`,
      html: renderEmail({
        brandName: env.brand,
        title,
        paragraphs: [`${what}`, `Pedido #${order.number} · ${order.email}`, `Medio de pago: ${payment.provider}`],
        cta: { text: "Ver venta", url: `${env.appUrl}/panel/${store.id}/ventas/${order.id}` },
        footer: `Podés desactivar estos avisos en Configuración → Notificaciones.`,
      }),
      kind: "seller-sale",
      storeId: store.id,
    });
  }
}

export async function rejectPayment(paymentId: string, reason: string | null, raw?: unknown) {
  const updated = await db.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "REJECTED", failureReason: reason?.slice(0, 300) ?? null, ...(raw ? { raw: raw as object } : {}) },
  });
  if (updated.count === 0) return false;
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  await db.orderItem.updateMany({ where: { paymentId, status: "PENDING" }, data: { status: "FAILED" } });
  if (payment.kind === "INITIAL" && !payment.order.paidAt) {
    await db.order.update({ where: { id: payment.orderId }, data: { status: "FAILED" } });
  }
  if (payment.kind === "OFFER") {
    const item = await db.orderItem.findFirst({ where: { paymentId, nodeId: { not: null } } });
    if (item?.nodeId) {
      await db.offerImpression.updateMany({ where: { orderId: payment.orderId, nodeId: item.nodeId }, data: { result: "FAILED", decidedAt: new Date() } });
      if (payment.order.currentNodeId === item.nodeId) {
        const node = await db.funnelNode.findUnique({ where: { id: item.nodeId } });
        await advance(payment.orderId, node?.declineNextId ?? null);
      }
    }
  }
  return true;
}

/** Aplica el estado informado por la pasarela (webhook o regreso del comprador). */
export async function applyProviderStatus(paymentId: string, st: { status: string; providerPaymentId?: string | null; paymentMethodRef?: string | null; customerRef?: string | null; failureReason?: string | null; raw?: unknown }) {
  if (st.status === "APPROVED") return approvePayment(paymentId, st);
  if (st.status === "REJECTED" || st.status === "CANCELLED") return rejectPayment(paymentId, st.failureReason ?? st.status, st.raw);
  if (st.status === "REFUNDED") return markPaymentRefunded(paymentId);
  return false;
}

async function markPaymentRefunded(paymentId: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === "REFUNDED") return false;
  await db.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  const items = await db.orderItem.findMany({ where: { paymentId } });
  await db.orderItem.updateMany({ where: { paymentId }, data: { status: "REFUNDED" } });
  await revokeAccess(payment.orderId, items.map((i) => i.productId));
  const entry = await db.commissionEntry.findUnique({ where: { paymentId } });
  if (entry?.status === "PENDING") await db.commissionEntry.update({ where: { id: entry.id }, data: { status: "REVERSED" } });
  else if (entry?.status === "INVOICED") {
    await db.commissionEntry
      .create({
        data: {
          userId: entry.userId,
          storeId: entry.storeId,
          orderId: entry.orderId,
          paymentId: `${paymentId}:refund`,
          provider: entry.provider,
          amount: -num(entry.amount),
          currency: entry.currency,
          amountUsd: -num(entry.amountUsd),
          rateBps: entry.rateBps,
        },
      })
      .catch(() => undefined);
  }
  const remaining = await db.payment.count({ where: { orderId: payment.orderId, status: "APPROVED" } });
  await db.order.update({
    where: { id: payment.orderId },
    data: { status: remaining > 0 ? "PARTIALLY_REFUNDED" : "REFUNDED", paidTotal: { decrement: payment.amount } },
  });
  return true;
}

/** Reembolso desde el panel: por API en Mercado Pago, Stripe, PayPal y Whop; manual en transferencia. */
export async function refundOrder(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { store: { include: { gateways: true } }, payments: true } });
  const errors: string[] = [];
  for (const p of order.payments.filter((x) => x.status === "APPROVED")) {
    const g = order.store.gateways.find((x) => x.provider === p.provider);
    try {
      if (g && p.providerPaymentId && p.providerPaymentId !== "free" && !p.providerPaymentId.startsWith("test_")) {
        const creds = gatewayCreds(g);
        const key = `refund-${p.id}`;
        if (p.provider === "MERCADOPAGO") await mercadopago.refund(creds, p.providerPaymentId, key);
        else if (p.provider === "STRIPE") await stripeGw.refund(creds, p.providerPaymentId, key);
        else if (p.provider === "PAYPAL") await paypal.refund(creds, gatewaySettings(g), p.providerPaymentId, key);
        else if (p.provider === "WHOP") await whop.refund(creds, p.providerPaymentId);
      }
      await markPaymentRefunded(p.id);
    } catch (e) {
      errors.push(`${p.provider}: ${(e as Error).message}`);
    }
  }
  if (errors.length === 0) {
    const d = dict(order.store.language);
    await sendEmail({
      to: order.email,
      subject: fill(d.emailRefundSubject, { store: order.store.name }),
      html: renderEmail({
        brandName: order.store.name,
        color: order.store.primaryColor,
        logoUrl: order.store.logoUrl,
        title: fill(d.emailRefundSubject, { store: order.store.name }),
        paragraphs: [fill(d.emailRefundIntro, { number: order.number })],
        footer: fill(d.emailFooter, { store: order.store.name }),
      }),
      kind: "refund",
      storeId: order.store.id,
      fromName: order.store.name,
      replyTo: order.store.supportEmail,
    });
  }
  return errors;
}

// ───────────── Transferencia ─────────────

export async function sendTransferInstructions(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { store: { include: { gateways: true } } } });
  const g = order.store.gateways.find((x) => x.provider === "TRANSFER");
  const d = dict(order.store.language);
  const instructions = String(gatewaySettings(g!).instructions || "");
  const url = storeUrl(order.store, `/pago/${order.id}?k=${order.accessKey}`);
  await sendEmail({
    to: order.email,
    subject: fill(d.emailTransferSubject, { store: order.store.name }),
    html: renderEmail({
      brandName: order.store.name,
      color: order.store.primaryColor,
      logoUrl: order.store.logoUrl,
      title: fill(d.emailTransferSubject, { store: order.store.name }),
      paragraphs: [d.emailTransferIntro, `${d.transferAmount}: ${formatMoney(order.total, order.currency, order.store.language)}`, ...instructions.split("\n").filter(Boolean)],
      cta: { text: d.transferProof, url },
      footer: `${fill(d.orderNumber, { number: order.number })} · ${fill(d.emailFooter, { store: order.store.name })}`,
    }),
    kind: "transfer-instructions",
    storeId: order.store.id,
    fromName: order.store.name,
    replyTo: order.store.supportEmail,
  });
}

/** El vendedor confirma la transferencia: aprueba los pagos pendientes del pedido. */
export async function approveTransfer(orderId: string) {
  const pending = await db.payment.findMany({ where: { orderId, provider: "TRANSFER", status: "PENDING" } });
  for (const p of pending) await approvePayment(p.id, { providerPaymentId: `transfer-${p.id}` });
  return pending.length;
}

export async function getBuyerOrder(orderId: string, key: string | null | undefined) {
  if (!key) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { store: true, items: true, payments: { orderBy: { createdAt: "asc" } } } });
  if (!order || order.accessKey !== key) return null;
  return order;
}
