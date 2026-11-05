import type { GatewayProvider, Order, Payment, PaymentGateway, Store } from "@prisma/client";

export type Creds = Record<string, string>;
export type Settings = Record<string, unknown>;

export class GatewayError extends Error {}

export type CreatePaymentCtx = {
  store: Store;
  gateway: PaymentGateway;
  creds: Creds;
  settings: Settings;
  order: Order;
  payment: Payment;
  amount: number; // monto a cobrar en chargeCurrency
  chargeCurrency: string;
  description: string;
  buyer: { email: string; name?: string | null; phone?: string | null };
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  kind: "INITIAL" | "OFFER";
  /** Datos guardados del primer pago (Stripe) para cobrar ofertas sin volver a pedir la tarjeta. */
  saved?: { customerRef?: string | null; paymentMethodRef?: string | null };
};

export type CreatePaymentResult =
  | { type: "redirect"; url: string; providerRef?: string }
  | { type: "stripe"; clientSecret: string; publishableKey: string; providerRef: string; customerRef?: string }
  | { type: "action_required"; clientSecret: string; publishableKey: string; providerRef: string }
  | { type: "manual" }
  | { type: "approved"; providerPaymentId?: string; paymentMethodRef?: string | null; customerRef?: string | null }
  | { type: "rejected"; reason: string };

export type ProviderStatus = "APPROVED" | "PENDING" | "REJECTED" | "REFUNDED" | "CANCELLED";

export type StatusResult = {
  status: ProviderStatus;
  paymentId?: string | null; // nuestro Payment.id (external_reference / metadata)
  providerPaymentId?: string | null;
  paymentMethodRef?: string | null;
  customerRef?: string | null;
  failureReason?: string | null;
  raw?: unknown;
};

export type FieldDef = { key: string; label: string; secret?: boolean; required?: boolean; help?: string; placeholder?: string };
export type SettingDef = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "select";
  options?: { value: string; label: string }[];
  help?: string;
  placeholder?: string;
};

export type GatewayInfo = {
  provider: GatewayProvider;
  label: string;
  description: string;
  credentialFields: FieldDef[];
  settingFields: SettingDef[];
  /** Comisión de la plataforma aplica (0 % en PayPal y transferencia, como Impultienda). */
  commission: boolean;
  oneClick: "native" | "redirect" | "manual";
  webhook: boolean;
};

export type GatewayRow = PaymentGateway;
