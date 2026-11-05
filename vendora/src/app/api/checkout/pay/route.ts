import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CheckoutError, createOrder } from "@/lib/orders";
import { countryFromHeaders } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/auth";
import { storeUrl } from "@/lib/stores";
import { dict } from "@/lib/i18n";
import { GatewayError } from "@/lib/gateways";

const Body = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
  checkoutId: z.string().optional().nullable(),
  email: z.string().email().max(200),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  marketId: z.string().optional().nullable(),
  provider: z.enum(["MERCADOPAGO", "STRIPE", "PAYPAL", "WHOP", "TRANSFER", "TEST"]),
  bumpIds: z.array(z.string()).max(20).default([]),
  couponCode: z.string().max(60).optional().nullable(),
  visitorId: z.string().max(64).optional().nullable(),
  utm: z.record(z.string(), z.string().max(200)).optional(),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(300).optional().nullable(),
  abTestId: z.string().optional().nullable(),
  abVariant: z.enum(["A", "B"]).optional().nullable(),
});

/** Crea el pedido y devuelve qué hacer: redirigir a la pasarela, abrir Stripe o ir a la página de pago. */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || "0";
  if (!rateLimit(`pay:${ip}`, 15, 60_000)) return NextResponse.json({ error: "Demasiados intentos. Esperá un minuto." }, { status: 429 });
  const raw = (await req.json().catch(() => null)) as { storeId?: unknown } | null;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const store = typeof raw?.storeId === "string" ? await db.store.findUnique({ where: { id: raw.storeId } }) : null;
    return NextResponse.json({ error: dict(store?.language ?? "es").invalidEmail }, { status: 400 });
  }
  const b = parsed.data;
  try {
    const { order, payment, result } = await createOrder({
      ...b,
      ip,
      userAgent: req.headers.get("user-agent"),
      country: countryFromHeaders(req.headers),
    });
    const store = await db.store.findUniqueOrThrow({ where: { id: order.storeId } });
    const statusUrl = storeUrl(store, `/pago/${order.id}?k=${order.accessKey}&p=${payment.id}`);
    switch (result.type) {
      case "redirect":
        return NextResponse.json({ type: "redirect", url: result.url, orderId: order.id });
      case "stripe":
        return NextResponse.json({ type: "stripe", clientSecret: result.clientSecret, publishableKey: result.publishableKey, returnUrl: statusUrl, orderId: order.id });
      case "rejected":
        return NextResponse.json({ error: result.reason }, { status: 402 });
      default:
        return NextResponse.json({ type: "redirect", url: statusUrl, orderId: order.id });
    }
  } catch (e) {
    if (e instanceof CheckoutError || e instanceof GatewayError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "No pudimos iniciar el pago. Probá de nuevo." }, { status: 500 });
  }
}
