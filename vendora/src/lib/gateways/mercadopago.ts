import crypto from "node:crypto";
import { GatewayError, type CreatePaymentCtx, type CreatePaymentResult, type Creds, type StatusResult } from "./types";

const API = "https://api.mercadopago.com";

async function mp<T = Record<string, unknown>>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new GatewayError(`Mercado Pago: ${String(data.message || data.error || res.status)}`);
  return data as T;
}

export async function createPayment(ctx: CreatePaymentCtx): Promise<CreatePaymentResult> {
  const token = ctx.creds.accessToken;
  if (!token) throw new GatewayError("Mercado Pago no está configurado (falta el Access Token).");
  const s = ctx.settings;
  const body = {
    items: [
      {
        id: ctx.payment.id,
        title: ctx.description.slice(0, 250),
        quantity: 1,
        unit_price: ctx.amount,
        currency_id: ctx.chargeCurrency,
        category_id: "digital_goods",
      },
    ],
    payer: { email: ctx.buyer.email, name: ctx.buyer.name || undefined },
    external_reference: ctx.payment.id,
    back_urls: { success: ctx.returnUrl, pending: ctx.returnUrl, failure: ctx.cancelUrl },
    auto_return: "approved",
    notification_url: ctx.notificationUrl,
    statement_descriptor: typeof s.statementDescriptor === "string" && s.statementDescriptor ? s.statementDescriptor.slice(0, 22) : undefined,
    payment_methods: Number(s.maxInstallments) > 0 ? { installments: Number(s.maxInstallments) } : undefined,
    binary_mode: Boolean(s.binaryMode),
    metadata: { order_id: ctx.order.id, payment_id: ctx.payment.id, store_id: ctx.store.id },
  };
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>(token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "X-Idempotency-Key": `pref-${ctx.payment.id}` },
  });
  const sandbox = token.startsWith("TEST-");
  return { type: "redirect", url: sandbox && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point, providerRef: pref.id };
}

export function mapStatus(status: string): StatusResult["status"] {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    case "cancelled":
      return "CANCELLED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    default:
      return "PENDING"; // pending, in_process, authorized, in_mediation
  }
}

export async function fetchPayment(creds: Creds, mpPaymentId: string): Promise<StatusResult> {
  const p = await mp<{ id: number; status: string; status_detail?: string; external_reference?: string }>(
    creds.accessToken,
    `/v1/payments/${encodeURIComponent(mpPaymentId)}`,
  );
  return {
    status: mapStatus(p.status),
    paymentId: p.external_reference || null,
    providerPaymentId: String(p.id),
    failureReason: p.status === "rejected" ? p.status_detail || "rejected" : null,
    raw: { id: p.id, status: p.status, status_detail: p.status_detail },
  };
}

/** Verifica la firma x-signature de las notificaciones (si la tienda cargó la clave secreta del webhook). */
export function verifySignature(secret: string, headers: Headers, dataId: string) {
  const sig = headers.get("x-signature");
  const requestId = headers.get("x-request-id") || "";
  if (!sig) return false;
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  // Según la documentación de Mercado Pago, los valores ausentes se omiten del manifiesto.
  const manifest = `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export async function refund(creds: Creds, mpPaymentId: string, idempotencyKey: string) {
  await mp(creds.accessToken, `/v1/payments/${encodeURIComponent(mpPaymentId)}/refunds`, {
    method: "POST",
    body: "{}",
    headers: { "X-Idempotency-Key": idempotencyKey },
  });
}

/** Preferencia para pagar una factura de la plataforma con la cuenta de Mercado Pago de la plataforma. */
export async function createPlatformPreference(input: {
  token: string;
  title: string;
  amount: number;
  currency: string;
  reference: string;
  email: string;
  successUrl: string;
  notificationUrl: string;
}) {
  const pref = await mp<{ init_point: string; sandbox_init_point: string; id: string }>(input.token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [{ title: input.title, quantity: 1, unit_price: input.amount, currency_id: input.currency }],
      payer: { email: input.email },
      external_reference: input.reference,
      back_urls: { success: input.successUrl, pending: input.successUrl, failure: input.successUrl },
      auto_return: "approved",
      notification_url: input.notificationUrl,
    }),
  });
  return input.token.startsWith("TEST-") && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point;
}
