import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { gatewayCreds, gatewaySettings } from "@/lib/gateways";
import * as mercadopago from "@/lib/gateways/mercadopago";
import * as stripeGw from "@/lib/gateways/stripe";
import * as paypal from "@/lib/gateways/paypal";
import * as whop from "@/lib/gateways/whop";
import { applyProviderStatus } from "@/lib/orders";
import type { StatusResult } from "@/lib/gateways/types";

async function once(provider: string, eventId: string, storeId: string, payload: unknown, fn: () => Promise<void>) {
  const existing = await db.webhookEvent.findUnique({ where: { provider_eventId: { provider, eventId } } });
  if (existing?.processedAt) return;
  const ev =
    existing ??
    (await db.webhookEvent
      .create({ data: { provider, eventId, storeId, payload: (payload ?? {}) as object } })
      .catch(() => null));
  if (!ev) return;
  try {
    await fn();
    await db.webhookEvent.update({ where: { id: ev.id }, data: { processedAt: new Date(), error: null } });
  } catch (e) {
    await db.webhookEvent.update({ where: { id: ev.id }, data: { error: String((e as Error).message).slice(0, 500) } });
    throw e;
  }
}

async function apply(storeId: string, st: StatusResult, fallback?: { providerRef?: string | null }) {
  let paymentId = st.paymentId ?? null;
  if (!paymentId && fallback?.providerRef) {
    const p = await db.payment.findFirst({ where: { providerRef: fallback.providerRef, order: { storeId } } });
    paymentId = p?.id ?? null;
  }
  if (!paymentId && st.providerPaymentId) {
    const p = await db.payment.findFirst({ where: { providerPaymentId: st.providerPaymentId, order: { storeId } } });
    paymentId = p?.id ?? null;
  }
  if (!paymentId) return;
  const payment = await db.payment.findFirst({ where: { id: paymentId, order: { storeId } } });
  if (!payment) return;
  await applyProviderStatus(payment.id, st);
}

/** Notificaciones de las pasarelas de cada tienda. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string; gatewayId: string }> }) {
  const { provider, gatewayId } = await params;
  const gateway = await db.paymentGateway.findUnique({ where: { id: gatewayId } });
  if (!gateway || gateway.provider.toLowerCase() !== provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  const creds = gatewayCreds(gateway);
  const raw = await req.text();
  const url = new URL(req.url);
  try {
    switch (gateway.provider) {
      case "MERCADOPAGO": {
        let body: { type?: string; topic?: string; data?: { id?: string | number }; id?: string | number; action?: string } = {};
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          body = {};
        }
        const type = url.searchParams.get("type") || url.searchParams.get("topic") || body.type || body.topic || "";
        const dataId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || body.data?.id || body.id || "");
        if (!dataId || !type.startsWith("payment")) return NextResponse.json({ ok: true, ignored: true });
        if (creds.webhookSecret && !mercadopago.verifySignature(creds.webhookSecret, req.headers, dataId)) {
          return NextResponse.json({ error: "firma inválida" }, { status: 401 });
        }
        const st = await mercadopago.fetchPayment(creds, dataId);
        await once("mercadopago", `${dataId}:${st.status}`, gateway.storeId, body, () => apply(gateway.storeId, st));
        return NextResponse.json({ ok: true });
      }
      case "STRIPE": {
        const sig = req.headers.get("stripe-signature") || "";
        let event: Stripe.Event;
        try {
          event = stripeGw.constructEvent(creds, raw, sig);
        } catch {
          return NextResponse.json({ error: "firma inválida" }, { status: 400 });
        }
        await once("stripe", event.id, gateway.storeId, { type: event.type }, async () => {
          if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
            const pi = event.data.object as Stripe.PaymentIntent;
            await apply(gateway.storeId, stripeGw.mapIntent(pi), { providerRef: pi.id });
          } else if (event.type === "charge.refunded") {
            const ch = event.data.object as Stripe.Charge;
            const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
            if (pi && ch.refunded) await apply(gateway.storeId, { status: "REFUNDED", providerPaymentId: pi }, { providerRef: pi });
          }
        });
        return NextResponse.json({ ok: true });
      }
      case "PAYPAL": {
        const event = JSON.parse(raw || "{}") as { id?: string; event_type?: string; resource?: Record<string, unknown> };
        if (!(await paypal.verifyWebhook(creds, gatewaySettings(gateway), req.headers, event))) {
          return NextResponse.json({ error: "firma inválida" }, { status: 401 });
        }
        await once("paypal", event.id || raw.slice(0, 60), gateway.storeId, event, async () => {
          const r = event.resource || {};
          if (event.event_type === "CHECKOUT.ORDER.APPROVED" && typeof r.id === "string") {
            const st = await paypal.capture(creds, gatewaySettings(gateway), r.id);
            await apply(gateway.storeId, st, { providerRef: r.id });
          } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
            await apply(gateway.storeId, { status: "APPROVED", paymentId: (r.custom_id as string) || null, providerPaymentId: (r.id as string) || null });
          } else if (event.event_type === "PAYMENT.CAPTURE.DENIED" || event.event_type === "PAYMENT.CAPTURE.DECLINED") {
            await apply(gateway.storeId, { status: "REJECTED", paymentId: (r.custom_id as string) || null, providerPaymentId: (r.id as string) || null, failureReason: event.event_type });
          } else if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
            await apply(gateway.storeId, { status: "REFUNDED", paymentId: (r.custom_id as string) || null });
          }
        });
        return NextResponse.json({ ok: true });
      }
      case "WHOP": {
        let event: whop.WhopEvent;
        try {
          event = whop.verifyAndParse(creds, raw, req.headers);
        } catch {
          return NextResponse.json({ error: "firma inválida" }, { status: 401 });
        }
        const st = whop.eventToStatus(event);
        if (!st) return NextResponse.json({ ok: true, ignored: true });
        await once("whop", req.headers.get("webhook-id") || `${event.data?.id}:${event.type}`, gateway.storeId, event, () =>
          apply(gateway.storeId, st, { providerRef: event.data?.checkout_configuration_id ?? null }),
        );
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (e) {
    console.error("webhook", provider, e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
