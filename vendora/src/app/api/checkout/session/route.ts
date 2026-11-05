import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { abVariantData, loadCheckoutProduct, quoteCheckout } from "@/lib/orders";
import { pickMarket, countryFromHeaders } from "@/lib/geo";
import { availableGateways } from "@/lib/checkout";
import { recordEvent, sendCapi } from "@/lib/tracking";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/auth";
import { storeUrl } from "@/lib/stores";

const Body = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
  checkoutId: z.string().optional().nullable(),
  visitorId: z.string().max(64).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  name: z.string().max(200).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  marketId: z.string().optional().nullable(),
  bumpIds: z.array(z.string()).max(20).default([]),
  couponCode: z.string().max(60).optional().nullable(),
  abTestId: z.string().optional().nullable(),
  abVariant: z.enum(["A", "B"]).optional().nullable(),
  utm: z.record(z.string(), z.string().max(200)).optional(),
  fbp: z.string().max(200).optional().nullable(),
  fbc: z.string().max(300).optional().nullable(),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Crea o actualiza el carrito (checkout) y devuelve el total recalculado en el servidor. */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || "0";
  if (!rateLimit(`co:${ip}`, 90, 60_000)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const b = parsed.data;
  const store = await db.store.findUnique({ where: { id: b.storeId }, include: { markets: true, gateways: true } });
  if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  const product = await loadCheckoutProduct(store.id, b.productId);
  if (!product) return NextResponse.json({ error: "Producto no disponible" }, { status: 404 });
  const country = countryFromHeaders(req.headers);
  const market = (b.marketId ? store.markets.find((m) => m.id === b.marketId && m.active) : null) ?? pickMarket(store.markets, country);
  const test = b.abTestId ? await db.checkoutTest.findFirst({ where: { id: b.abTestId, storeId: store.id, productId: product.id, active: true } }) : null;
  const ab = abVariantData(test, b.abVariant);
  const quote = await quoteCheckout({ store, product, market, bumps: product.bumpsAsMain, selectedBumpIds: b.bumpIds, couponCode: b.couponCode, ab });
  const gateways = await availableGateways(store, quote.currency, quote.total);

  const email = b.email && EMAIL.test(b.email.trim()) ? b.email.trim().toLowerCase() : null;
  let checkout = b.checkoutId ? await db.checkout.findFirst({ where: { id: b.checkoutId, storeId: store.id } }) : null;
  const firstEmail = Boolean(email && (!checkout || !checkout.emailCapturedAt));
  const data = {
    productId: product.id,
    marketId: market?.id ?? null,
    currency: quote.currency,
    bumpIds: quote.bumps.map((x) => x.bump.id),
    couponCode: quote.coupon?.code ?? null,
    total: quote.total,
    ...(email ? { email } : {}),
    ...(b.name ? { name: b.name.slice(0, 200) } : {}),
    ...(b.phone ? { phone: b.phone.slice(0, 60) } : {}),
    ...(firstEmail ? { emailCapturedAt: new Date() } : {}),
  };
  if (checkout && checkout.status !== "COMPLETED") {
    checkout = await db.checkout.update({ where: { id: checkout.id }, data: { ...data, ...(checkout.status === "ABANDONED" && email ? {} : {}) } });
  } else {
    checkout = await db.checkout.create({
      data: {
        storeId: store.id,
        ...data,
        country,
        visitorId: b.visitorId ?? null,
        utm: (b.utm ?? {}) as object,
        abTestId: test?.id ?? null,
        abVariant: test ? b.abVariant ?? null : null,
      },
    });
  }
  if (firstEmail && b.visitorId) {
    await recordEvent({ storeId: store.id, type: "CHECKOUT_STARTED", visitorId: b.visitorId, productId: product.id, checkoutId: checkout.id, value: quote.total, currency: quote.currency, utm: b.utm, abVariant: checkout.abVariant });
    await sendCapi(store, {
      eventName: "InitiateCheckout",
      eventId: `ic-${checkout.id}`,
      eventSourceUrl: storeUrl(store, "/checkout"),
      value: quote.total,
      currency: quote.currency,
      contentIds: [product.id],
      email,
      name: b.name,
      phone: b.phone,
      country,
      ip,
      userAgent: req.headers.get("user-agent"),
      fbp: b.fbp,
      fbc: b.fbc,
    });
  }
  return NextResponse.json({
    checkoutId: checkout.id,
    currency: quote.currency,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    main: quote.main,
    bumps: quote.bumps.map((x) => ({ id: x.bump.id, price: x.price })),
    coupon: quote.coupon,
    couponInvalid: Boolean(b.couponCode && !quote.coupon),
    marketId: market?.id ?? null,
    gateways,
  });
}
