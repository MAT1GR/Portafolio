import type { EventType, Store } from "@prisma/client";
import { db } from "./db";
import { decrypt, sha256 } from "./crypto";

export type Utm = { source?: string; medium?: string; campaign?: string; content?: string; term?: string };

export function utmFromParams(p: URLSearchParams | Record<string, string | undefined>): Utm {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k]) || undefined;
  const clip = (v?: string) => (v ? v.slice(0, 200) : undefined);
  return {
    source: clip(get("utm_source")),
    medium: clip(get("utm_medium")),
    campaign: clip(get("utm_campaign")),
    content: clip(get("utm_content")),
    term: clip(get("utm_term")),
  };
}

export function asUtm(v: unknown): Utm {
  return v && typeof v === "object" ? (v as Utm) : {};
}

export function deviceFromUa(ua: string | null | undefined) {
  if (!ua) return null;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function recordEvent(input: {
  storeId: string;
  type: EventType;
  visitorId: string;
  productId?: string | null;
  checkoutId?: string | null;
  orderId?: string | null;
  value?: number | null;
  currency?: string | null;
  path?: string | null;
  referrer?: string | null;
  utm?: Utm;
  country?: string | null;
  device?: string | null;
  abVariant?: string | null;
}) {
  const u = input.utm || {};
  await db.analyticsEvent.create({
    data: {
      storeId: input.storeId,
      type: input.type,
      visitorId: input.visitorId.slice(0, 64),
      productId: input.productId ?? null,
      checkoutId: input.checkoutId ?? null,
      orderId: input.orderId ?? null,
      value: input.value ?? null,
      currency: input.currency ?? null,
      path: input.path?.slice(0, 500) ?? null,
      referrer: input.referrer?.slice(0, 500) ?? null,
      utmSource: u.source ?? null,
      utmMedium: u.medium ?? null,
      utmCampaign: u.campaign ?? null,
      utmContent: u.content ?? null,
      utmTerm: u.term ?? null,
      country: input.country ?? null,
      device: input.device ?? null,
      abVariant: input.abVariant ?? null,
    },
  });
}

// ───────────── Meta: API de Conversiones ─────────────

export type CapiEvent = {
  eventName: "Purchase" | "InitiateCheckout" | "AddPaymentInfo" | "ViewContent" | "Lead";
  eventId: string;
  eventSourceUrl?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  country?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  externalId?: string | null;
};

const norm = (v: string) => v.trim().toLowerCase();

/** Envía un evento a la API de Conversiones (server-side) con el mismo event_id que el píxel para deduplicar. */
export async function sendCapi(store: Pick<Store, "metaPixelId" | "metaCapiTokenEnc" | "metaTestEventCode">, ev: CapiEvent) {
  if (!store.metaPixelId || !store.metaCapiTokenEnc) return { skipped: true as const };
  let token: string;
  try {
    token = decrypt(store.metaCapiTokenEnc);
  } catch {
    return { skipped: true as const };
  }
  const [fn, ...rest] = (ev.name || "").trim().split(/\s+/);
  const ln = rest.join(" ");
  const user_data: Record<string, unknown> = {
    client_ip_address: ev.ip || undefined,
    client_user_agent: ev.userAgent || undefined,
    fbp: ev.fbp || undefined,
    fbc: ev.fbc || undefined,
  };
  if (ev.email) user_data.em = [sha256(norm(ev.email))];
  if (ev.phone) user_data.ph = [sha256(ev.phone.replace(/\D/g, ""))];
  if (fn) user_data.fn = [sha256(norm(fn))];
  if (ln) user_data.ln = [sha256(norm(ln))];
  if (ev.country) user_data.country = [sha256(norm(ev.country))];
  if (ev.externalId) user_data.external_id = [sha256(ev.externalId)];

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: ev.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: "website",
        event_source_url: ev.eventSourceUrl,
        user_data,
        custom_data: {
          value: ev.value,
          currency: ev.currency,
          content_ids: ev.contentIds,
          content_name: ev.contentName,
          content_type: "product",
        },
      },
    ],
  };
  if (store.metaTestEventCode) body.test_event_code = store.metaTestEventCode;
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(store.metaPixelId)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
