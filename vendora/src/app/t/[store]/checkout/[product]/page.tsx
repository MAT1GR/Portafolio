import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { CheckoutView } from "@/components/store/checkout-view";

type Props = { params: Promise<{ store: string; product: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductCheckout({ params, searchParams }: Props) {
  const { store: storeParam, product: slug } = await params;
  const { store, base, country } = await storeContext(storeParam);
  const product = await db.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } } });
  if (!product) notFound();
  return <CheckoutView store={store} productId={product.id} base={base} country={country} search={await searchParams} />;
}
