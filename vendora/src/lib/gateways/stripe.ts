import Stripe from "stripe";
import { currencyDecimals } from "../money";
import { GatewayError, type CreatePaymentCtx, type CreatePaymentResult, type Creds, type StatusResult } from "./types";

export function stripeClient(secretKey: string) {
  if (!secretKey) throw new GatewayError("Stripe no está configurado (falta la Secret key).");
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 30_000 });
}

/** Monto en la unidad mínima que espera Stripe. HUF y TWD se cobran en unidades enteras. */
export function toMinor(amount: number, currency: string) {
  const c = currency.toUpperCase();
  if (c === "HUF" || c === "TWD") return Math.round(amount) * 100;
  return Math.round(amount * 10 ** currencyDecimals(c));
}

export async function createPayment(ctx: CreatePaymentCtx): Promise<CreatePaymentResult> {
  const stripe = stripeClient(ctx.creds.secretKey);
  const metadata = { paymentId: ctx.payment.id, orderId: ctx.order.id, storeId: ctx.store.id };

  // Oferta post-compra con medio de pago guardado: cobro 1-click (el comprador está presente en la página).
  if (ctx.kind === "OFFER" && ctx.saved?.customerRef && ctx.saved?.paymentMethodRef) {
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: toMinor(ctx.amount, ctx.chargeCurrency),
          currency: ctx.chargeCurrency.toLowerCase(),
          customer: ctx.saved.customerRef,
          payment_method: ctx.saved.paymentMethodRef,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: "never" },
          description: ctx.description.slice(0, 500),
          metadata,
        },
        { idempotencyKey: `offer-${ctx.payment.id}` },
      );
      if (pi.status === "succeeded" || pi.status === "processing") {
        return { type: "approved", providerPaymentId: pi.id, paymentMethodRef: ctx.saved.paymentMethodRef, customerRef: ctx.saved.customerRef };
      }
      if (pi.status === "requires_action" && pi.client_secret) {
        return { type: "action_required", clientSecret: pi.client_secret, publishableKey: ctx.creds.publishableKey, providerRef: pi.id };
      }
      return { type: "rejected", reason: pi.last_payment_error?.message || pi.status };
    } catch (e) {
      if (e instanceof Stripe.errors.StripeCardError) return { type: "rejected", reason: e.message };
      throw e;
    }
  }

  const customer = await stripe.customers.create(
    { email: ctx.buyer.email, name: ctx.buyer.name || undefined, metadata: { storeId: ctx.store.id } },
    { idempotencyKey: `cus-${ctx.payment.id}` },
  );
  const pi = await stripe.paymentIntents.create(
    {
      amount: toMinor(ctx.amount, ctx.chargeCurrency),
      currency: ctx.chargeCurrency.toLowerCase(),
      customer: customer.id,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      receipt_email: ctx.buyer.email,
      description: ctx.description.slice(0, 500),
      metadata,
    },
    { idempotencyKey: `pi-${ctx.payment.id}` },
  );
  if (!pi.client_secret) throw new GatewayError("Stripe no devolvió el client secret.");
  return { type: "stripe", clientSecret: pi.client_secret, publishableKey: ctx.creds.publishableKey, providerRef: pi.id, customerRef: customer.id };
}

export function mapIntent(pi: Stripe.PaymentIntent): StatusResult {
  const status: StatusResult["status"] =
    pi.status === "succeeded" ? "APPROVED" : pi.status === "canceled" ? "CANCELLED" : pi.status === "requires_payment_method" && pi.last_payment_error ? "REJECTED" : "PENDING";
  return {
    status,
    paymentId: (pi.metadata?.paymentId as string) || null,
    providerPaymentId: pi.id,
    paymentMethodRef: typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null,
    customerRef: typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null,
    failureReason: pi.last_payment_error?.message ?? null,
    raw: { id: pi.id, status: pi.status },
  };
}

export async function fetchIntent(creds: Creds, intentId: string) {
  const pi = await stripeClient(creds.secretKey).paymentIntents.retrieve(intentId);
  return mapIntent(pi);
}

export function constructEvent(creds: Creds, rawBody: string, signature: string) {
  if (!creds.webhookSecret) throw new GatewayError("Falta el secreto del webhook de Stripe.");
  return stripeClient(creds.secretKey).webhooks.constructEvent(rawBody, signature, creds.webhookSecret);
}

export async function refund(creds: Creds, intentId: string, idempotencyKey: string) {
  await stripeClient(creds.secretKey).refunds.create({ payment_intent: intentId }, { idempotencyKey });
}
