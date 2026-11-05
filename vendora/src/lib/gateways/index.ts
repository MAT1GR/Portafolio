import type { GatewayProvider, PaymentGateway } from "@prisma/client";
import { decryptJson } from "../crypto";
import { convert } from "../fx";
import { roundMoney } from "../money";
import * as mercadopago from "./mercadopago";
import * as stripe from "./stripe";
import * as paypal from "./paypal";
import * as whop from "./whop";
import { PAYPAL_CURRENCIES } from "./paypal";
import { WHOP_CURRENCIES } from "./whop";
import type { CreatePaymentCtx, CreatePaymentResult, Creds, GatewayInfo, Settings } from "./types";
import { GatewayError } from "./types";

export { GatewayError };

export const GATEWAYS: Record<GatewayProvider, GatewayInfo> = {
  MERCADOPAGO: {
    provider: "MERCADOPAGO",
    label: "Mercado Pago",
    description: "Checkout Pro: tarjetas, dinero en cuenta y medios locales. Cobra en la moneda de tu cuenta (ARS, BRL, MXN, CLP, COP, PEN o UYU).",
    credentialFields: [
      { key: "accessToken", label: "Access Token", secret: true, required: true, placeholder: "APP_USR-… o TEST-…", help: "Mercado Pago → Tus integraciones → Credenciales de producción." },
      { key: "publicKey", label: "Public Key", placeholder: "APP_USR-…" },
      { key: "webhookSecret", label: "Clave secreta del webhook", secret: true, help: "Opcional: valida la firma de las notificaciones." },
    ],
    settingFields: [
      {
        key: "currency",
        label: "Moneda de la cuenta",
        type: "select",
        options: ["ARS", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"].map((c) => ({ value: c, label: c })),
      },
      { key: "maxInstallments", label: "Cuotas máximas", type: "number", placeholder: "12" },
      { key: "statementDescriptor", label: "Texto en el resumen de la tarjeta", type: "text", placeholder: "MITIENDA" },
      { key: "binaryMode", label: "Aprobar o rechazar al instante (sin pagos pendientes)", type: "boolean" },
    ],
    commission: true,
    oneClick: "redirect",
    webhook: true,
  },
  STRIPE: {
    provider: "STRIPE",
    label: "Stripe",
    description: "Tarjetas y billeteras en el checkout, en la moneda de cada market. Permite upsells 1-click sin volver a pedir la tarjeta.",
    credentialFields: [
      { key: "publishableKey", label: "Publishable key", required: true, placeholder: "pk_live_…" },
      { key: "secretKey", label: "Secret key", secret: true, required: true, placeholder: "sk_live_…" },
      { key: "webhookSecret", label: "Signing secret del webhook", secret: true, required: true, placeholder: "whsec_…" },
    ],
    settingFields: [],
    commission: true,
    oneClick: "native",
    webhook: true,
  },
  PAYPAL: {
    provider: "PAYPAL",
    label: "PayPal",
    description: "Pago con cuenta PayPal o tarjeta. Sin comisión de la plataforma.",
    credentialFields: [
      { key: "clientId", label: "Client ID", required: true },
      { key: "clientSecret", label: "Secret", secret: true, required: true },
      { key: "webhookId", label: "Webhook ID", help: "Opcional: confirma pagos aunque el comprador cierre la pestaña." },
    ],
    settingFields: [
      { key: "mode", label: "Entorno", type: "select", options: [{ value: "live", label: "Producción" }, { value: "sandbox", label: "Sandbox (pruebas)" }] },
      { key: "fallbackCurrency", label: "Moneda si el market no es compatible", type: "select", options: PAYPAL_CURRENCIES.map((c) => ({ value: c, label: c })) },
    ],
    commission: false,
    oneClick: "redirect",
    webhook: true,
  },
  WHOP: {
    provider: "WHOP",
    label: "Whop",
    description: "Cobrá en USD a compradores de cualquier país sin LLC; retirás a tu banco o en cripto.",
    credentialFields: [
      { key: "apiKey", label: "API key", secret: true, required: true },
      { key: "companyId", label: "Company ID", required: true, placeholder: "biz_…" },
      { key: "webhookSecret", label: "Webhook secret", secret: true, required: true },
    ],
    settingFields: [{ key: "currency", label: "Moneda de cobro", type: "select", options: WHOP_CURRENCIES.map((c) => ({ value: c, label: c })) }],
    commission: true,
    oneClick: "redirect",
    webhook: true,
  },
  TRANSFER: {
    provider: "TRANSFER",
    label: "Transferencia bancaria",
    description: "El comprador transfiere y sube el comprobante; vos aprobás el pago y se entrega el producto. Sin comisión de la plataforma.",
    credentialFields: [],
    settingFields: [
      { key: "instructions", label: "Datos bancarios", type: "textarea", placeholder: "Banco…\nTitular…\nCBU/CVU…\nAlias…" },
      { key: "currencies", label: "Monedas aceptadas (separadas por coma, vacío = todas)", type: "text", placeholder: "ARS" },
    ],
    commission: false,
    oneClick: "manual",
    webhook: false,
  },
  TEST: {
    provider: "TEST",
    label: "Modo prueba",
    description: "Pasarela simulada para probar todo el flujo (pago, upsells y entrega) sin cobrar. Solo funciona con la tienda en modo prueba.",
    credentialFields: [],
    settingFields: [],
    commission: false,
    oneClick: "native",
    webhook: false,
  },
};

export function gatewayCreds(g: PaymentGateway): Creds {
  return decryptJson<Creds>(g.credentialsEnc, {});
}

export function gatewaySettings(g: PaymentGateway): Settings {
  return (g.settings && typeof g.settings === "object" ? g.settings : {}) as Settings;
}

/** Moneda y monto que cobra la pasarela para un total en la moneda del market. null = no se ofrece. */
export async function chargeFor(g: PaymentGateway, currency: string, amount: number): Promise<{ currency: string; amount: number } | null> {
  const s = gatewaySettings(g);
  const cur = currency.toUpperCase();
  switch (g.provider) {
    case "MERCADOPAGO":
      return cur === String(s.currency || "ARS") ? { currency: cur, amount } : null;
    case "STRIPE":
    case "TEST":
      return { currency: cur, amount };
    case "PAYPAL": {
      if (PAYPAL_CURRENCIES.includes(cur)) return { currency: cur, amount };
      const fb = String(s.fallbackCurrency || "USD");
      return { currency: fb, amount: roundMoney(await convert(amount, cur, fb), fb) };
    }
    case "WHOP": {
      const wc = String(s.currency || "USD");
      if (wc === cur) return { currency: cur, amount };
      return { currency: wc, amount: roundMoney(await convert(amount, cur, wc), wc) };
    }
    case "TRANSFER": {
      const list = String(s.currencies || "")
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      if (list.length && !list.includes(cur)) return null;
      return { currency: cur, amount };
    }
  }
}

export async function createProviderPayment(ctx: CreatePaymentCtx): Promise<CreatePaymentResult> {
  switch (ctx.gateway.provider) {
    case "MERCADOPAGO":
      return mercadopago.createPayment(ctx);
    case "STRIPE":
      return stripe.createPayment(ctx);
    case "PAYPAL":
      return paypal.createPayment(ctx);
    case "WHOP":
      return whop.createPayment(ctx);
    case "TRANSFER":
      return { type: "manual" };
    case "TEST":
      return ctx.kind === "OFFER" ? { type: "approved", providerPaymentId: `test_${ctx.payment.id}` } : { type: "redirect", url: ctx.returnUrl.replace(/\/pago\/([^/?]+)\?/, "/pago/$1/simulador?") };
  }
}

export function commissionApplies(provider: GatewayProvider) {
  return GATEWAYS[provider].commission;
}
