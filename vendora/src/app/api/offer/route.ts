import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptOffer, confirmStripeOffer, declineOffer, getOfferState } from "@/lib/funnels";
import { storeUrl } from "@/lib/stores";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/auth";

const Body = z.object({
  orderId: z.string().min(1),
  key: z.string().min(1),
  nodeId: z.string().optional(),
  action: z.enum(["accept", "decline", "confirm", "expire"]),
  paymentId: z.string().optional(),
});

async function nextUrl(orderId: string, key: string) {
  const state = await getOfferState(orderId, key);
  if ("error" in state) return null;
  const store = state.order.store;
  return state.done ? storeUrl(store, `/gracias/${orderId}?k=${key}`) : storeUrl(store, `/oferta/${orderId}?k=${key}`);
}

/** Acciones del comprador sobre la oferta post-compra (aceptar 1-click, rechazar, confirmar 3DS, vencer). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || "0";
  if (!rateLimit(`offer:${ip}`, 40, 60_000)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const b = parsed.data;
  if (b.action === "accept") {
    if (!b.nodeId) return NextResponse.json({ error: "Falta la oferta" }, { status: 400 });
    const r = await acceptOffer(b.orderId, b.key, b.nodeId);
    if (r.status === "redirect") return NextResponse.json({ status: r.status, url: r.url });
    if (r.status === "action_required") return NextResponse.json({ status: r.status, clientSecret: r.clientSecret, publishableKey: r.publishableKey, paymentId: r.paymentId });
    return NextResponse.json({ status: r.status, url: await nextUrl(b.orderId, b.key) });
  }
  if (b.action === "decline") {
    if (b.nodeId) await declineOffer(b.orderId, b.key, b.nodeId);
    return NextResponse.json({ status: "declined", url: await nextUrl(b.orderId, b.key) });
  }
  if (b.action === "confirm") {
    if (!b.paymentId) return NextResponse.json({ error: "Falta el pago" }, { status: 400 });
    const ok = await confirmStripeOffer(b.orderId, b.key, b.paymentId);
    return NextResponse.json({ status: ok ? "approved" : "pending", url: await nextUrl(b.orderId, b.key) });
  }
  // expire: el timer llegó a cero; getOfferState resuelve el vencimiento y avanza
  return NextResponse.json({ status: "expired", url: await nextUrl(b.orderId, b.key) });
}
