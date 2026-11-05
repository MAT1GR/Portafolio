import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { CheckoutView } from "@/components/store/checkout-view";

type Props = { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /checkout → checkout del producto principal (o ?producto=slug). Es el destino de los botones de la landing. */
export default async function MainCheckout({ params, searchParams }: Props) {
  const { store, base, country } = await storeContext((await params).store);
  const search = await searchParams;
  const slug = typeof search.producto === "string" ? search.producto : null;
  let productId = store.mainProductId;
  if (slug) productId = (await db.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } }))?.id ?? null;
  if (!productId) {
    productId = (await db.product.findFirst({ where: { storeId: store.id, status: "PUBLISHED", visibility: "PUBLIC" }, orderBy: { sortOrder: "asc" } }))?.id ?? null;
  }
  if (!productId) notFound();
  return <CheckoutView store={store} productId={productId} base={base} country={country} search={search} />;
}
