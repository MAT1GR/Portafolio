import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { recordEvent, deviceFromUa } from "@/lib/tracking";
import { countryFromHeaders } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/auth";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };

const Body = z.object({
  storeId: z.string().min(1).max(40),
  type: z.enum(["PAGE_VIEW", "PRODUCT_VIEW", "CHECKOUT_VIEW"]),
  visitorId: z.string().min(6).max(64),
  productId: z.string().max(40).optional().nullable(),
  path: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  abVariant: z.string().max(4).optional().nullable(),
  utm: z.object({ source: z.string().optional(), medium: z.string().optional(), campaign: z.string().optional(), content: z.string().optional(), term: z.string().optional() }).partial().optional(),
});

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** Registra visitas (inicio, producto, checkout) con UTM. Lo llama el script de la tienda. */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || "0";
  if (!rateLimit(`track:${ip}`, 120, 60_000)) return NextResponse.json({ ok: false }, { status: 429, headers: CORS });
  const text = await req.text();
  const parsed = Body.safeParse((() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  const b = parsed.data;
  const store = await db.store.findUnique({ where: { id: b.storeId }, select: { id: true } });
  if (!store) return NextResponse.json({ ok: false }, { status: 404, headers: CORS });
  await recordEvent({
    storeId: b.storeId,
    type: b.type,
    visitorId: b.visitorId,
    productId: b.productId,
    path: b.path,
    referrer: b.referrer,
    utm: b.utm,
    country: countryFromHeaders(req.headers),
    device: deviceFromUa(req.headers.get("user-agent")),
    abVariant: b.abVariant,
  });
  return NextResponse.json({ ok: true }, { headers: CORS });
}
