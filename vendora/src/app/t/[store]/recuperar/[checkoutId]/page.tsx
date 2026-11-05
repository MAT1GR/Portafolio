import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";

/** Link de los emails de recuperación: retoma el checkout con email, bumps y cupón precargados. */
export default async function RecoverPage({ params, searchParams }: { params: Promise<{ store: string; checkoutId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: storeParam, checkoutId } = await params;
  const sp = await searchParams;
  const { store, base } = await storeContext(storeParam);
  const checkout = await db.checkout.findFirst({ where: { id: checkoutId, storeId: store.id } });
  if (!checkout) notFound();
  const product = await db.product.findUnique({ where: { id: checkout.productId } });
  if (!product) notFound();
  const q = new URLSearchParams();
  if (checkout.email) q.set("email", checkout.email);
  if (checkout.name) q.set("nombre", checkout.name);
  if (checkout.bumpIds.length) q.set("bumps", checkout.bumpIds.join(","));
  const coupon = sp.cupon || checkout.couponCode;
  if (coupon) q.set("cupon", coupon);
  if (checkout.status !== "COMPLETED") q.set("checkout", checkout.id);
  if (checkout.marketId) q.set("market", checkout.marketId);
  q.set("utm_source", "email");
  q.set("utm_medium", "recuperacion");
  q.set("utm_campaign", "carrito-abandonado");
  redirect(`${base}/checkout/${product.slug}?${q}`);
}
