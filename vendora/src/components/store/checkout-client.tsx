"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Dict } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { Countdown, SessionCountdown, SocialProof } from "./countdown";

type GatewayOption = { provider: string; label: string; chargeCurrency: string; chargeAmount: number; converted: boolean };
type Bump = {
  id: string;
  name: string;
  headline: string;
  description: string | null;
  buttonText: string;
  imageUrl: string | null;
  price: number;
  compareAt: number | null;
  timerEnabled: boolean;
  timerMinutes: number;
};

export type CheckoutProps = {
  storeId: string;
  productId: string;
  lang: string;
  d: Dict;
  currency: string;
  marketId: string | null;
  markets: { id: string; name: string; currency: string }[];
  product: { name: string; subtitle: string | null; imageUrl: string | null; deliveryNotice: string | null };
  main: { price: number; compareAt: number | null };
  bonuses: { name: string; imageUrl: string | null; value: number | null }[];
  bumps: Bump[];
  quote: { subtotal: number; discount: number; total: number; coupon: { code: string; discount: number } | null };
  gateways: GatewayOption[];
  settings: {
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
  guaranteeDays: number;
  ab: { testId: string; variant: "A" | "B" } | null;
  prefill: { email?: string; name?: string; coupon?: string; bumpIds?: string[]; checkoutId?: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1] ?? null;
}

function ls(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    vdVisitor?: string;
    vdUtm?: Record<string, string>;
    vdTrack?: (name: string, params?: Record<string, unknown>, eventId?: string) => void;
  }
}

const PROVIDER_ICON: Record<string, string> = { MERCADOPAGO: "💳", STRIPE: "💳", PAYPAL: "🅿️", WHOP: "🌎", TRANSFER: "🏦", TEST: "🧪" };

export function CheckoutClient(p: CheckoutProps) {
  const { d } = p;
  const money = useCallback((n: number, c = p.currency) => formatMoney(n, c, p.lang), [p.currency, p.lang]);
  const [email, setEmail] = useState(p.prefill.email ?? "");
  const [name, setName] = useState(p.prefill.name ?? "");
  const [phone, setPhone] = useState("");
  const [bumpIds, setBumpIds] = useState<string[]>(p.prefill.bumpIds ?? []);
  const [couponInput, setCouponInput] = useState(p.prefill.coupon ?? "");
  const [coupon, setCoupon] = useState<string | null>(p.prefill.coupon ?? null);
  const [couponError, setCouponError] = useState(false);
  const [quote, setQuote] = useState({ ...p.quote, currency: p.currency });
  const [gateways, setGateways] = useState(p.gateways);
  const [provider, setProvider] = useState(p.gateways[0]?.provider ?? "");
  const [marketId, setMarketId] = useState(p.marketId);
  const [checkoutId, setCheckoutId] = useState<string | null>(p.prefill.checkoutId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [stripe, setStripe] = useState<{ clientSecret: string; publishableKey: string; returnUrl: string } | null>(null);
  const started = useRef(false);

  const session = useCallback(
    async (patch: { email?: string; bumpIds?: string[]; coupon?: string | null; marketId?: string | null } = {}) => {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: p.storeId,
          productId: p.productId,
          checkoutId,
          visitorId: window.vdVisitor || ls("vd_vid"),
          email: patch.email ?? (EMAIL.test(email) ? email : null),
          name: name || null,
          phone: phone || null,
          marketId: patch.marketId !== undefined ? patch.marketId : marketId,
          bumpIds: patch.bumpIds ?? bumpIds,
          couponCode: patch.coupon !== undefined ? patch.coupon : coupon,
          abTestId: p.ab?.testId ?? null,
          abVariant: p.ab?.variant ?? null,
          utm: window.vdUtm || {},
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc") || ls("vd_fbc"),
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      setCheckoutId(data.checkoutId);
      setQuote({ subtotal: data.subtotal, discount: data.discount, total: data.total, coupon: data.coupon, currency: data.currency });
      setGateways(data.gateways);
      if (!data.gateways.some((g: GatewayOption) => g.provider === provider)) setProvider(data.gateways[0]?.provider ?? "");
      return data;
    },
    [p.storeId, p.productId, p.ab, checkoutId, email, name, phone, marketId, bumpIds, coupon, provider],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (p.ab) document.cookie = `vd_ab_${p.ab.testId}=${p.ab.variant};path=/;max-age=2592000;samesite=lax`;
    session().then((data) => {
      if (data?.checkoutId) window.vdTrack?.("InitiateCheckout", { content_ids: [p.productId], value: data.total, currency: data.currency, num_items: 1 }, `ic-${data.checkoutId}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBump = async (id: string) => {
    const next = bumpIds.includes(id) ? bumpIds.filter((x) => x !== id) : [...bumpIds, id];
    setBumpIds(next);
    await session({ bumpIds: next });
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const data = await session({ coupon: code });
    if (data?.coupon) {
      setCoupon(code);
      setCouponError(false);
    } else {
      setCoupon(null);
      setCouponError(true);
    }
  };

  const changeMarket = async (id: string) => {
    setMarketId(id);
    document.cookie = `vd_market=${id};path=/;max-age=2592000;samesite=lax`;
    const data = await session({ marketId: id });
    if (data) setQuote((q) => ({ ...q, currency: data.currency }));
  };

  const emailOk = EMAIL.test(email.trim());
  const nameOk = !p.settings.requireName || name.trim().length > 1;
  const phoneOk = !p.settings.requirePhone || phone.replace(/\D/g, "").length >= 6;
  const gateway = gateways.find((g) => g.provider === provider);

  const pay = async () => {
    setTouched(true);
    setError(null);
    if (!emailOk || !nameOk || !phoneOk || !gateway) return;
    setBusy(true);
    window.vdTrack?.("AddPaymentInfo", { content_ids: [p.productId], value: quote.total, currency: quote.currency }, checkoutId ? `api-${checkoutId}` : undefined);
    try {
      const res = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: p.storeId,
          productId: p.productId,
          checkoutId,
          email: email.trim(),
          name: name.trim() || null,
          phone: phone.trim() || null,
          marketId,
          provider,
          bumpIds,
          couponCode: coupon,
          visitorId: window.vdVisitor || ls("vd_vid"),
          utm: window.vdUtm || {},
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc") || ls("vd_fbc"),
          abTestId: p.ab?.testId ?? null,
          abVariant: p.ab?.variant ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.type === "stripe") {
        setStripe({ clientSecret: data.clientSecret, publishableKey: data.publishableKey, returnUrl: data.returnUrl });
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const percent = p.main.compareAt && p.main.compareAt > p.main.price ? Math.round((1 - p.main.price / p.main.compareAt) * 100) : 0;
  const buttonText = p.settings.buttonText || d.payNow;
  const currentMarket = p.markets.find((m) => m.id === marketId);

  const summary = (
    <aside className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 text-sm font-semibold tracking-wide text-black/50 uppercase">{d.yourOrder}</div>
      <div className="flex gap-4">
        {p.product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.product.imageUrl} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover shadow" />
        )}
        <div className="min-w-0">
          <div className="leading-snug font-semibold">{p.product.name}</div>
          {p.product.subtitle && <div className="mt-0.5 text-sm text-black/55">{p.product.subtitle}</div>}
          <div className="mt-2 flex items-baseline gap-2">
            {p.main.compareAt && p.main.compareAt > p.main.price && <s className="text-sm text-black/40">{money(p.main.compareAt, quote.currency)}</s>}
            <b>{money(p.main.price, quote.currency)}</b>
            {percent > 0 && <span className="rounded-full bg-[var(--sp)] px-2 py-0.5 text-xs font-bold text-white">-{percent}%</span>}
          </div>
        </div>
      </div>
      {p.bonuses.length > 0 && (
        <div className="mt-4 rounded-2xl bg-black/[0.03] p-3">
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-black/50 uppercase">{d.bonusesIncluded}</div>
          <ul className="space-y-1 text-sm">
            {p.bonuses.map((b, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>🎁 {b.name}</span>
                <span className="shrink-0">
                  {b.value ? <s className="mr-1 text-black/40">{money(b.value, quote.currency)}</s> : null}
                  <b className="text-[var(--sp)]">{d.free}</b>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 space-y-1.5 border-t border-black/5 pt-4 text-sm">
        {p.bumps
          .filter((b) => bumpIds.includes(b.id))
          .map((b) => (
            <div key={b.id} className="flex justify-between gap-2">
              <span className="text-black/70">+ {b.name}</span>
              <span>{money(b.price, quote.currency)}</span>
            </div>
          ))}
        {quote.discount > 0 && (
          <div className="flex justify-between text-[var(--sp)]">
            <span>
              {d.discount} {quote.coupon ? `(${quote.coupon.code})` : ""}
            </span>
            <span>-{money(quote.discount, quote.currency)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-1 text-lg font-bold">
          <span>{d.total}</span>
          <span>{money(quote.total, quote.currency)}</span>
        </div>
        {gateway?.converted && <div className="text-right text-xs text-black/55">{d.chargedAs.replace("{amount}", money(gateway.chargeAmount, gateway.chargeCurrency))}</div>}
      </div>
      {p.settings.showCoupon && (
        <div className="mt-4">
          {quote.coupon ? (
            <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
              <span>{d.couponApplied.replace("{code}", quote.coupon.code)}</span>
              <button
                type="button"
                className="text-xs font-semibold underline"
                onClick={async () => {
                  setCoupon(null);
                  setCouponInput("");
                  await session({ coupon: null });
                }}
              >
                {d.remove}
              </button>
            </div>
          ) : (
            <details className="text-sm" open={Boolean(p.prefill.coupon)}>
              <summary className="cursor-pointer text-black/60">{d.haveCoupon}</summary>
              <div className="mt-2 flex gap-2">
                <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2 uppercase" aria-label={d.haveCoupon} />
                <button type="button" onClick={applyCoupon} className="rounded-xl border border-black/15 px-3 py-2 font-semibold">
                  {d.apply}
                </button>
              </div>
              {couponError && <p className="mt-1 text-xs text-red-600">{d.couponInvalid}</p>}
            </details>
          )}
        </div>
      )}
      {(p.settings.showGuarantee || p.settings.showSecureBadges) && (
        <div className="mt-5 grid gap-2 text-xs text-black/60">
          {p.settings.showSecureBadges && <div>🔒 {d.securePayment}</div>}
          <div>⚡ {d.instantAccess}</div>
          {p.settings.showGuarantee && <div>🛡️ {d.guarantee.replace("{days}", String(p.guaranteeDays))}</div>}
          {p.product.deliveryNotice && <div>📩 {p.product.deliveryNotice}</div>}
        </div>
      )}
    </aside>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      {(p.settings.socialProof.enabled || p.settings.countdown.enabled) && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-2xl bg-[var(--sa)] px-4 py-2.5 text-center text-sm text-white">
          {p.settings.countdown.enabled && <SessionCountdown id={p.productId} minutes={p.settings.countdown.minutes} template={`${d.offerEndsIn} {timer}`} />}
          {p.settings.socialProof.enabled && <SocialProof min={p.settings.socialProof.min} max={p.settings.socialProof.max} template={`👀 ${d.peopleViewing}`} />}
        </div>
      )}
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{d.checkoutTitle}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="order-2 space-y-5 lg:order-1">
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">{d.email}</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => emailOk && session({ email: email.trim() })}
                className="w-full rounded-xl border border-black/15 px-3.5 py-3 outline-none focus:border-black"
                placeholder="tu@email.com"
              />
              <span className="mt-1 block text-xs text-black/50">{d.emailHint}</span>
              {touched && !emailOk && <span className="mt-1 block text-xs text-red-600">{d.invalidEmail}</span>}
            </label>
            {p.settings.askName && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold">
                  {d.fullName} {!p.settings.requireName && <span className="font-normal text-black/40">({d.optional})</span>}
                </span>
                <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-black/15 px-3.5 py-3 outline-none focus:border-black" />
                {touched && !nameOk && <span className="mt-1 block text-xs text-red-600">{d.required}</span>}
              </label>
            )}
            {p.settings.askPhone && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold">
                  {d.phone} {!p.settings.requirePhone && <span className="font-normal text-black/40">({d.optional})</span>}
                </span>
                <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-black/15 px-3.5 py-3 outline-none focus:border-black" />
                {touched && !phoneOk && <span className="mt-1 block text-xs text-red-600">{d.required}</span>}
              </label>
            )}
            {p.markets.length > 1 && (
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold">{d.currency}</span>
                <select value={marketId ?? ""} onChange={(e) => changeMarket(e.target.value)} className="w-full rounded-xl border border-black/15 px-3 py-3">
                  {p.markets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.currency})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          {p.bumps.map((b) => {
            const on = bumpIds.includes(b.id);
            return (
              <section key={b.id} className={`rounded-3xl border-2 border-dashed bg-white p-4 transition sm:p-5 ${on ? "border-[var(--sp)]" : "border-black/15"}`}>
                <div className="mb-2 text-sm font-bold text-[var(--sp)]">{b.headline}</div>
                <div className="flex gap-4">
                  {b.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{b.name}</div>
                    {b.description && <p className="mt-1 text-sm text-black/65">{b.description}</p>}
                    <div className="mt-2 flex items-baseline gap-2">
                      {b.compareAt && <s className="text-sm text-black/40">{money(b.compareAt, quote.currency)}</s>}
                      <b>{money(b.price, quote.currency)}</b>
                    </div>
                    {b.timerEnabled && <BumpTimer id={b.id} minutes={b.timerMinutes} />}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBump(b.id)}
                  className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${on ? "bg-[var(--sp)] text-white" : "bg-black/[0.05] hover:bg-black/[0.08]"}`}
                  aria-pressed={on}
                >
                  {on ? "✓ " : ""}
                  {b.buttonText}
                </button>
              </section>
            );
          })}

          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-3 text-sm font-semibold">{d.paymentMethod}</div>
            {gateways.length === 0 ? (
              <p className="text-sm text-red-600">{d.noGateways}</p>
            ) : (
              <div className="grid gap-2">
                {gateways.map((g) => (
                  <label
                    key={g.provider}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${provider === g.provider ? "border-black bg-black/[0.02]" : "border-black/15"}`}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="provider" checked={provider === g.provider} onChange={() => setProvider(g.provider)} />
                      <span className="font-medium">
                        {PROVIDER_ICON[g.provider]} {g.label}
                      </span>
                    </span>
                    {g.converted && <span className="text-xs text-black/50">{money(g.chargeAmount, g.chargeCurrency)}</span>}
                  </label>
                ))}
              </div>
            )}
            {stripe ? (
              <StripeBox data={stripe} d={d} email={email} />
            ) : (
              <button
                type="button"
                onClick={pay}
                disabled={busy || gateways.length === 0}
                className="mt-5 w-full rounded-2xl bg-[var(--sp)] px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? d.processing : `${buttonText} · ${money(quote.total, quote.currency)}`}
              </button>
            )}
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
            {p.settings.footerNote && <p className="mt-3 text-center text-xs text-black/50">{p.settings.footerNote}</p>}
            {currentMarket && p.markets.length > 1 && <p className="mt-2 text-center text-xs text-black/40">{currentMarket.name}</p>}
          </section>
        </div>
        <div className="order-1 lg:order-2">{summary}</div>
      </div>
    </div>
  );
}

function BumpTimer({ id, minutes }: { id: string; minutes: number }) {
  const [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    setEnd(Date.now() + minutes * 60_000);
  }, [id, minutes]);
  if (!end) return null;
  return <Countdown endsAt={end} className="mt-1 block text-xs font-semibold text-[var(--sp)]" template="⏱ {timer}" />;
}

const stripeCache = new Map<string, Promise<Stripe | null>>();

function StripeBox({ data, d, email }: { data: { clientSecret: string; publishableKey: string; returnUrl: string }; d: Dict; email: string }) {
  const promise = useMemo(() => {
    if (!stripeCache.has(data.publishableKey)) stripeCache.set(data.publishableKey, loadStripe(data.publishableKey));
    return stripeCache.get(data.publishableKey)!;
  }, [data.publishableKey]);
  return (
    <div className="mt-5">
      <Elements stripe={promise} options={{ clientSecret: data.clientSecret, appearance: { theme: "stripe", variables: { borderRadius: "12px" } } }}>
        <StripeForm returnUrl={data.returnUrl} d={d} email={email} />
      </Elements>
    </div>
  );
}

function StripeForm({ returnUrl, d, email }: { returnUrl: string; d: Dict; email: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <PaymentElement options={{ defaultValues: { billingDetails: { email } } }} />
      <button
        type="button"
        disabled={!stripe || busy}
        onClick={async () => {
          if (!stripe || !elements) return;
          setBusy(true);
          setError(null);
          const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl, receipt_email: email } });
          if (err) {
            setError(err.message || d.paymentRejected);
            setBusy(false);
          }
        }}
        className="mt-4 w-full rounded-2xl bg-[var(--sp)] px-6 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-60"
      >
        {busy ? d.processing : d.payNow}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
