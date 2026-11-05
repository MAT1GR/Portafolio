import type { Store } from "@prisma/client";

export type CheckoutSettings = {
  askName: boolean;
  requireName: boolean;
  askPhone: boolean;
  requirePhone: boolean;
  showCoupon: boolean;
  socialProof: { enabled: boolean; min: number; max: number };
  countdown: { enabled: boolean; minutes: number };
  showSecureBadges: boolean;
  showGuarantee: boolean;
  buttonText: string;
  footerNote: string;
};

export type DeliverySettings = {
  linkExpiryHours: number | null; // null = nunca vencen
  maxDownloads: number | null; // null = sin tope
  extraMessage: string;
};

export type ThankYouSettings = {
  title: string;
  message: string;
  buttonText: string;
  buttonUrl: string;
  redirectUrl: string;
};

export type RecoveryStep = { delayMinutes: number; subject: string; body: string; couponCode: string };

export type RecoverySettings = {
  enabled: boolean;
  steps: RecoveryStep[];
};

export type NotifySettings = {
  emailOnSale: boolean;
  emailOnTransfer: boolean;
};

export const DEFAULT_CHECKOUT: CheckoutSettings = {
  askName: true,
  requireName: false,
  askPhone: false,
  requirePhone: false,
  showCoupon: true,
  socialProof: { enabled: false, min: 3, max: 12 },
  countdown: { enabled: false, minutes: 15 },
  showSecureBadges: true,
  showGuarantee: true,
  buttonText: "",
  footerNote: "",
};

export const DEFAULT_DELIVERY: DeliverySettings = {
  linkExpiryHours: 72,
  maxDownloads: 5,
  extraMessage: "",
};

export const DEFAULT_THANKYOU: ThankYouSettings = {
  title: "",
  message: "",
  buttonText: "",
  buttonUrl: "",
  redirectUrl: "",
};

export const DEFAULT_RECOVERY: RecoverySettings = {
  enabled: false,
  steps: [
    { delayMinutes: 60, subject: "", body: "", couponCode: "" },
    { delayMinutes: 60 * 24, subject: "", body: "", couponCode: "" },
    { delayMinutes: 60 * 72, subject: "", body: "", couponCode: "" },
  ],
};

export const DEFAULT_NOTIFY: NotifySettings = { emailOnSale: true, emailOnTransfer: true };

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function getCheckoutSettings(store: Pick<Store, "checkoutSettings">): CheckoutSettings {
  const s = obj(store.checkoutSettings);
  return {
    ...DEFAULT_CHECKOUT,
    ...s,
    socialProof: { ...DEFAULT_CHECKOUT.socialProof, ...obj(s.socialProof) },
    countdown: { ...DEFAULT_CHECKOUT.countdown, ...obj(s.countdown) },
  } as CheckoutSettings;
}

export function getDeliverySettings(store: Pick<Store, "deliverySettings">): DeliverySettings {
  return { ...DEFAULT_DELIVERY, ...obj(store.deliverySettings) } as DeliverySettings;
}

export function getThankYouSettings(store: Pick<Store, "thankYouSettings">, override?: unknown): ThankYouSettings {
  const base = { ...DEFAULT_THANKYOU, ...obj(store.thankYouSettings) } as ThankYouSettings;
  const o = obj(override);
  for (const k of Object.keys(DEFAULT_THANKYOU) as (keyof ThankYouSettings)[]) {
    if (typeof o[k] === "string" && (o[k] as string).trim()) base[k] = o[k] as string;
  }
  return base;
}

export function getRecoverySettings(store: Pick<Store, "recoverySettings">): RecoverySettings {
  const s = obj(store.recoverySettings);
  const steps = Array.isArray(s.steps) ? (s.steps as RecoveryStep[]) : DEFAULT_RECOVERY.steps;
  return {
    enabled: Boolean(s.enabled),
    steps: steps.slice(0, 3).map((st) => ({ ...DEFAULT_RECOVERY.steps[0], ...obj(st) }) as RecoveryStep),
  };
}

export function getNotifySettings(store: Pick<Store, "notifySettings">): NotifySettings {
  return { ...DEFAULT_NOTIFY, ...obj(store.notifySettings) } as NotifySettings;
}
