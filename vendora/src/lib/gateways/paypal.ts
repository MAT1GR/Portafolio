import { currencyDecimals } from "../money";
import { GatewayError, type CreatePaymentCtx, type CreatePaymentResult, type Creds, type Settings, type StatusResult } from "./types";

export const PAYPAL_CURRENCIES = [
  "AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS", "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", "GBP", "SGD", "SEK", "CHF", "THB", "USD",
];

function base(settings: Settings) {
  return settings.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function token(creds: Creds, settings: Settings) {
  if (!creds.clientId || !creds.clientSecret) throw new GatewayError("PayPal no está configurado (faltan Client ID y Secret).");
  const res = await fetch(`${base(settings)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new GatewayError(`PayPal: ${data.error_description || res.status}`);
  return data.access_token;
}

async function pp<T = Record<string, unknown>>(creds: Creds, settings: Settings, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base(settings)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token(creds, settings)}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const details = Array.isArray(data.details) ? (data.details as { issue?: string }[]).map((d) => d.issue).join(", ") : "";
    throw new GatewayError(`PayPal: ${String(data.message || res.status)} ${details}`.trim());
  }
  return data as T;
}

export async function createPayment(ctx: CreatePaymentCtx): Promise<CreatePaymentResult> {
  const value = ctx.amount.toFixed(currencyDecimals(ctx.chargeCurrency));
  const order = await pp<{ id: string; links: { rel: string; href: string }[] }>(ctx.creds, ctx.settings, "/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `order-${ctx.payment.id}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: ctx.payment.id,
          custom_id: ctx.payment.id,
          description: ctx.description.slice(0, 127),
          amount: { currency_code: ctx.chargeCurrency, value },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: ctx.store.name.slice(0, 127),
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: ctx.returnUrl,
            cancel_url: ctx.cancelUrl,
          },
        },
      },
    }),
  });
  const link = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) throw new GatewayError("PayPal no devolvió el link de aprobación.");
  return { type: "redirect", url: link.href, providerRef: order.id };
}

type CaptureResponse = {
  id: string;
  status: string;
  purchase_units?: { custom_id?: string; reference_id?: string; payments?: { captures?: { id: string; status: string; custom_id?: string }[] } }[];
};

function fromOrder(o: CaptureResponse): StatusResult {
  const unit = o.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const st = capture?.status || o.status;
  const status: StatusResult["status"] =
    st === "COMPLETED" ? "APPROVED" : st === "DECLINED" || st === "FAILED" ? "REJECTED" : st === "VOIDED" ? "CANCELLED" : st === "REFUNDED" ? "REFUNDED" : "PENDING";
  return {
    status,
    paymentId: capture?.custom_id || unit?.custom_id || unit?.reference_id || null,
    providerPaymentId: capture?.id || null,
    raw: { orderId: o.id, status: o.status, capture: capture?.status },
  };
}

/** Captura una orden aprobada por el comprador (al volver de PayPal o al recibir CHECKOUT.ORDER.APPROVED). */
export async function capture(creds: Creds, settings: Settings, orderId: string): Promise<StatusResult> {
  try {
    const o = await pp<CaptureResponse>(creds, settings, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `capture-${orderId}` },
      body: "{}",
    });
    return fromOrder(o);
  } catch (e) {
    // Si ya estaba capturada, se consulta el estado.
    const o = await pp<CaptureResponse>(creds, settings, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    if (o.status === "COMPLETED" || o.purchase_units?.[0]?.payments?.captures?.length) return fromOrder(o);
    throw e;
  }
}

export async function verifyWebhook(creds: Creds, settings: Settings, headers: Headers, event: unknown) {
  if (!creds.webhookId) return false;
  const res = await pp<{ verification_status: string }>(creds, settings, "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: creds.webhookId,
      webhook_event: event,
    }),
  });
  return res.verification_status === "SUCCESS";
}

export async function refund(creds: Creds, settings: Settings, captureId: string, idempotencyKey: string) {
  await pp(creds, settings, `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    headers: { "PayPal-Request-Id": idempotencyKey },
    body: "{}",
  });
}
