function clean(v: string | undefined) {
  return v && v.trim() ? v.trim() : "";
}

export const env = {
  get appUrl() {
    return (clean(process.env.APP_URL) || "http://localhost:3000").replace(/\/$/, "");
  },
  get storeRootDomain() {
    return clean(process.env.STORE_ROOT_DOMAIN).toLowerCase();
  },
  get brand() {
    return clean(process.env.NEXT_PUBLIC_BRAND_NAME) || "Vendora";
  },
  get adminEmail() {
    return clean(process.env.ADMIN_EMAIL).toLowerCase();
  },
  get cronSecret() {
    return clean(process.env.CRON_SECRET);
  },
  get allowTestPayments() {
    return clean(process.env.ALLOW_TEST_PAYMENTS) !== "false";
  },
  get secure() {
    return this.appUrl.startsWith("https://");
  },
  get billingDueDays() {
    return Number(process.env.BILLING_DUE_DAYS || 7);
  },
  get billingGraceDays() {
    return Number(process.env.BILLING_GRACE_DAYS || 7);
  },
};

/** Host (con puerto) del panel, ej. "vendora.app" o "localhost:3000". */
export function appHost() {
  try {
    return new URL(env.appUrl).host.toLowerCase();
  } catch {
    return "localhost:3000";
  }
}
