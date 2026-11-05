"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Dict } from "@/lib/i18n";
import { uploadFile } from "@/components/client";
import { Countdown } from "./countdown";

/* ───────────── Oferta post-compra ───────────── */

export type OfferClientProps = {
  orderId: string;
  accessKey: string;
  nodeId: string;
  d: Dict;
  acceptText: string;
  declineText: string;
  timerTemplate: string | null;
  remainingMs: number;
  autoAction?: "aceptar" | "rechazar" | null;
  returnUrl: string;
};

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data as { status: string; url?: string; clientSecret?: string; publishableKey?: string; paymentId?: string };
}

export function OfferClient(p: OfferClientProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeNeeded, setStripeNeeded] = useState<{ clientSecret: string; publishableKey: string; paymentId: string } | null>(null);
  const endsAt = useMemo(() => Date.now() + p.remainingMs, [p.remainingMs]);
  const ran = useRef(false);
  const base = { orderId: p.orderId, key: p.accessKey, nodeId: p.nodeId };

  const go = (url?: string) => {
    if (url) window.location.href = url;
    else window.location.reload();
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post({ ...base, action: "accept" });
      if (r.status === "action_required" && r.clientSecret && r.publishableKey && r.paymentId) {
        const stripe = await loadStripe(r.publishableKey);
        const res = stripe ? await stripe.handleNextAction({ clientSecret: r.clientSecret }) : null;
        if (!res || res.error) {
          setStripeNeeded({ clientSecret: r.clientSecret, publishableKey: r.publishableKey, paymentId: r.paymentId });
          setBusy(false);
          return;
        }
        const c = await post({ ...base, action: "confirm", paymentId: r.paymentId });
        go(c.url);
        return;
      }
      go(r.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const r = await post({ ...base, action: "decline" });
      go(r.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (ran.current || !p.autoAction) return;
    ran.current = true;
    if (p.autoAction === "aceptar") accept();
    else decline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (p.autoAction && !stripeNeeded) {
    return <p className="vd-pulse py-10 text-center text-lg font-semibold">{p.d.addingToOrder}</p>;
  }

  return (
    <div className="text-center">
      {p.timerTemplate && p.remainingMs > 0 && (
        <div className="mb-5 inline-block rounded-full bg-[var(--sa)] px-4 py-2 text-sm text-white">
          <Countdown endsAt={endsAt} template={p.timerTemplate} onEnd={() => post({ ...base, action: "expire" }).then((r) => go(r.url)).catch(() => go())} />
        </div>
      )}
      {stripeNeeded ? (
        <OfferStripe data={stripeNeeded} returnUrl={p.returnUrl.replace(/([?&])p=[^&]*/, `$1p=${stripeNeeded.paymentId}`)} d={p.d} />
      ) : (
        <>
          <button onClick={accept} disabled={busy} className="w-full max-w-md rounded-2xl bg-[var(--sp)] px-6 py-4 text-lg font-extrabold text-white shadow-xl transition hover:brightness-110 disabled:opacity-60">
            {busy ? p.d.addingToOrder : p.acceptText}
          </button>
          <div className="mt-4">
            <button onClick={decline} disabled={busy} className="text-sm text-black/50 underline underline-offset-4 hover:text-black">
              {p.declineText}
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <p className="mt-6 text-xs text-black/40">{p.d.offerOnce}</p>
    </div>
  );
}

function OfferStripe({ data, returnUrl, d }: { data: { clientSecret: string; publishableKey: string }; returnUrl: string; d: Dict }) {
  const promise = useMemo(() => loadStripe(data.publishableKey), [data.publishableKey]);
  return (
    <div className="mx-auto max-w-md text-left">
      <p className="mb-3 text-sm text-black/60">{d.offerPayHint}</p>
      <Elements stripe={promise} options={{ clientSecret: data.clientSecret }}>
        <StripeConfirm returnUrl={returnUrl} d={d} />
      </Elements>
    </div>
  );
}

function StripeConfirm({ returnUrl, d }: { returnUrl: string; d: Dict }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PaymentElement />
      <button
        disabled={!stripe || busy}
        onClick={async () => {
          if (!stripe || !elements) return;
          setBusy(true);
          const { error: err } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
          if (err) {
            setError(err.message || d.paymentRejected);
            setBusy(false);
          }
        }}
        className="mt-4 w-full rounded-2xl bg-[var(--sp)] px-6 py-4 font-bold text-white disabled:opacity-60"
      >
        {busy ? d.processing : d.payNow}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}

/* ───────────── Transferencia: subir comprobante ───────────── */

export function TransferProof({ storeId, orderId, accessKey, d, uploaded }: { storeId: string; orderId: string; accessKey: string; d: Dict; uploaded: boolean }) {
  const [done, setDone] = useState(uploaded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done) return <p className="rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-800">{d.proofReceived}</p>;
  return (
    <div>
      <label className="inline-flex cursor-pointer items-center rounded-xl bg-[var(--sp)] px-5 py-3 font-bold text-white">
        {busy ? d.processing : d.transferProof}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              await uploadFile({ storeId, purpose: "transfer-proof", file, orderId, accessKey });
              setDone(true);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/* ───────────── Gracias: evento Purchase y redirección ───────────── */

export function PurchaseEvent({ eventId, value, currency, contentIds, redirectUrl }: { eventId: string; value: number; currency: string; contentIds: string[]; redirectUrl?: string | null }) {
  useEffect(() => {
    const key = `vd_p_${eventId}`;
    let fired = false;
    try {
      fired = Boolean(localStorage.getItem(key));
    } catch {
      fired = false;
    }
    if (!fired) {
      const fire = () => (window as unknown as { vdTrack?: (n: string, p: Record<string, unknown>, id: string) => void }).vdTrack?.("Purchase", { value, currency, content_ids: contentIds, content_type: "product" }, eventId);
      setTimeout(fire, 600);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* sin almacenamiento */
      }
    }
    if (redirectUrl) {
      const t = setTimeout(() => (window.location.href = redirectUrl), 5000);
      return () => clearTimeout(t);
    }
  }, [eventId, value, currency, contentIds, redirectUrl]);
  return null;
}

/* ───────────── Área de miembros: pedir enlace ───────────── */

export function MembersLogin({ storeId, d }: { storeId: string; d: Dict }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent) return <p className="rounded-2xl bg-green-50 p-4 text-center text-sm font-medium text-green-800">{d.linkSent}</p>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/members/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, email }) });
        setBusy(false);
        if (res.ok) setSent(true);
        else setError((await res.json().catch(() => ({}))).error || d.invalidEmail);
      }}
      className="space-y-3"
    >
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" className="w-full rounded-xl border border-black/15 px-3.5 py-3" />
      <button disabled={busy} className="w-full rounded-xl bg-[var(--sp)] px-5 py-3 font-bold text-white disabled:opacity-60">
        {busy ? d.processing : d.sendLink}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
