import { Webhook } from "standardwebhooks";
import { GatewayError, type CreatePaymentCtx, type CreatePaymentResult, type Creds, type StatusResult } from "./types";

/**
 * Whop (cobro en USD a compradores de cualquier país, sin LLC).
 * API v1: se crea una "checkout configuration" con un plan de pago único y metadata con nuestro Payment.id;
 * el comprador paga en whop.com y Whop avisa por webhook (formato Standard Webhooks).
 */
const API = "https://api.whop.com/api/v1";

export const WHOP_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

async function whop<T = Record<string, unknown>>(creds: Creds, path: string, init: RequestInit = {}): Promise<T> {
  if (!creds.apiKey) throw new GatewayError("Whop no está configurado (falta la API key).");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${creds.apiKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined;
    throw new GatewayError(`Whop: ${err?.message || String(data.message || res.status)}`);
  }
  return data as T;
}

export async function createPayment(ctx: CreatePaymentCtx): Promise<CreatePaymentResult> {
  if (!ctx.creds.companyId) throw new GatewayError("Whop no está configurado (falta el Company ID).");
  const config = await whop<{ id: string; purchase_url: string }>(ctx.creds, "/checkout_configurations", {
    method: "POST",
    body: JSON.stringify({
      plan: {
        company_id: ctx.creds.companyId,
        currency: ctx.chargeCurrency.toLowerCase(),
        initial_price: ctx.amount,
        plan_type: "one_time",
        product: { external_identifier: `vendora-${ctx.store.id}`, title: ctx.store.name.slice(0, 80) },
      },
      metadata: { payment_id: ctx.payment.id, order_id: ctx.order.id, store_id: ctx.store.id },
      redirect_url: ctx.returnUrl,
    }),
  });
  if (!config.purchase_url) throw new GatewayError("Whop no devolvió la URL de pago.");
  return { type: "redirect", url: config.purchase_url, providerRef: config.id };
}

export type WhopEvent = {
  type?: string;
  action?: string;
  data?: {
    id?: string;
    status?: string;
    substatus?: string;
    metadata?: Record<string, string> | null;
    checkout_configuration_id?: string | null;
  };
};

export function verifyAndParse(creds: Creds, rawBody: string, headers: Headers): WhopEvent {
  if (!creds.webhookSecret) throw new GatewayError("Falta el secreto del webhook de Whop.");
  const secret = creds.webhookSecret.startsWith("whsec_") ? creds.webhookSecret : Buffer.from(creds.webhookSecret).toString("base64");
  const wh = new Webhook(secret);
  return wh.verify(rawBody, {
    "webhook-id": headers.get("webhook-id") || "",
    "webhook-timestamp": headers.get("webhook-timestamp") || "",
    "webhook-signature": headers.get("webhook-signature") || "",
  }) as WhopEvent;
}

export function eventToStatus(ev: WhopEvent): StatusResult | null {
  const type = ev.type || ev.action || "";
  const data = ev.data || {};
  let status: StatusResult["status"] | null = null;
  if (type === "payment.succeeded") status = "APPROVED";
  else if (type === "payment.failed") status = "REJECTED";
  else if (type === "payment.pending") status = "PENDING";
  else if (type.startsWith("refund.") || type === "payment.refunded") status = "REFUNDED";
  if (!status) return null;
  return {
    status,
    paymentId: data.metadata?.payment_id ?? null,
    providerPaymentId: data.id ?? null,
    failureReason: status === "REJECTED" ? data.substatus || "failed" : null,
    raw: { type, id: data.id, status: data.status, checkout: data.checkout_configuration_id },
  };
}

export async function refund(creds: Creds, whopPaymentId: string) {
  await whop(creds, `/payments/${encodeURIComponent(whopPaymentId)}/refund`, { method: "POST", body: "{}" });
}
