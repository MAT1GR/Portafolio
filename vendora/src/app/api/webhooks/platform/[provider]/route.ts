import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/gateways/stripe";
import * as mercadopago from "@/lib/gateways/mercadopago";
import { markInvoicePaid } from "@/lib/billing";

/** Pagos de facturas de la plataforma (abono + comisiones). */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const raw = await req.text();
  if (provider === "stripe") {
    const key = process.env.PLATFORM_STRIPE_SECRET_KEY;
    const secret = process.env.PLATFORM_STRIPE_WEBHOOK_SECRET;
    if (!key || !secret) return NextResponse.json({ error: "no configurado" }, { status: 404 });
    let event: Stripe.Event;
    try {
      event = stripeClient(key).webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
    } catch {
      return NextResponse.json({ error: "firma inválida" }, { status: 400 });
    }
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status === "paid" && s.metadata?.invoiceId) await markInvoicePaid(s.metadata.invoiceId, "stripe", s.id);
    }
    return NextResponse.json({ ok: true });
  }
  if (provider === "mercadopago") {
    const token = process.env.PLATFORM_MP_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "no configurado" }, { status: 404 });
    const url = new URL(req.url);
    let body: { type?: string; data?: { id?: string | number } } = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      body = {};
    }
    const type = url.searchParams.get("type") || url.searchParams.get("topic") || body.type || "";
    const dataId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || body.data?.id || "");
    if (!dataId || !type.startsWith("payment")) return NextResponse.json({ ok: true });
    const secret = process.env.PLATFORM_MP_WEBHOOK_SECRET;
    if (secret && !mercadopago.verifySignature(secret, req.headers, dataId)) return NextResponse.json({ error: "firma inválida" }, { status: 401 });
    const st = await mercadopago.fetchPayment({ accessToken: token }, dataId);
    if (st.status === "APPROVED" && st.paymentId?.startsWith("invoice:")) await markInvoicePaid(st.paymentId.slice(8), "mercadopago", st.providerPaymentId ?? null);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
