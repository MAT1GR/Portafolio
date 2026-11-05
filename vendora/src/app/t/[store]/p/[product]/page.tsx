import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext, resolveMarket } from "@/lib/store-page";
import { productPrice, percentOff } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { sanitizeBlocks, type Block } from "@/lib/blocks";
import { getStoreByParam } from "@/lib/stores";
import { SalesPage } from "@/components/store/sales-page";
import { Paragraphs, StoreFooter, StoreHeader, Tracker, Unavailable } from "@/components/store/chrome";

type Props = { params: Promise<{ store: string; product: string }> };

async function load(storeParam: string, slug: string) {
  const store = await getStoreByParam(storeParam);
  if (!store) return null;
  return db.product.findFirst({
    where: { storeId: store.id, slug, status: "PUBLISHED", visibility: { in: ["PUBLIC", "HIDDEN"] } },
    include: { marketPrices: true, bonuses: { include: { bonusProduct: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, product } = await params;
  const p = await load(store, product);
  return p ? { title: { absolute: p.name }, description: p.shortDescription || undefined, openGraph: { images: p.imageUrl ? [p.imageUrl] : undefined } } : {};
}

export default async function ProductPage({ params }: Props) {
  const { store: storeParam, product: slug } = await params;
  const { store, base, d } = await storeContext(storeParam);
  if (store.status !== "ACTIVE") return <Unavailable store={store} />;
  const product = await load(storeParam, slug);
  if (!product) notFound();
  const market = await resolveMarket(store);
  const price = productPrice(product, market, store.baseCurrency);
  const fmt = (n: number) => formatMoney(n, price.currency, store.language);
  const blocks = sanitizeBlocks(product.salesPage) as Block[];
  const checkoutHref = `${base}/checkout/${product.slug}`;
  const bonuses = product.bonuses.map((b) => {
    const v = productPrice({ price: b.bonusProduct.price, compareAtPrice: b.bonusProduct.compareAtPrice }, market, store.baseCurrency);
    const value = v.compareAt || v.price;
    return { name: b.bonusProduct.name, imageUrl: b.bonusProduct.imageUrl, value: value ? fmt(value) : null };
  });

  return (
    <>
      <StoreHeader store={store} base={base} />
      <Tracker
        storeId={store.id}
        type="PRODUCT_VIEW"
        productId={product.id}
        pixelId={store.metaPixelId}
        ga4Id={store.ga4Id}
        tiktokId={store.tiktokPixelId}
        value={price.price}
        currency={price.currency}
        contentName={product.name}
      />
      {blocks.length > 0 ? (
        <SalesPage
          blocks={blocks}
          d={d}
          productName={product.name}
          imageUrl={product.imageUrl}
          price={price.price > 0 ? fmt(price.price) : d.free}
          compareAt={price.compareAt && price.compareAt > price.price ? fmt(price.compareAt) : null}
          percentOff={percentOff(price.price, price.compareAt)}
          checkoutHref={checkoutHref}
          guaranteeDays={store.guaranteeDays}
          bonuses={bonuses}
          color={store.primaryColor}
          dark={store.accentColor}
        />
      ) : (
        <SalesPage
          blocks={[
            { id: "h", type: "hero", title: product.name, subtitle: product.shortDescription || "" },
            ...(product.description ? [{ id: "t", type: "text" as const, body: product.description }] : []),
            ...(bonuses.length ? [{ id: "b", type: "bonuses" as const }] : []),
            { id: "o", type: "offer", title: "" },
          ]}
          d={d}
          productName={product.name}
          imageUrl={product.imageUrl}
          price={price.price > 0 ? fmt(price.price) : d.free}
          compareAt={price.compareAt && price.compareAt > price.price ? fmt(price.compareAt) : null}
          percentOff={percentOff(price.price, price.compareAt)}
          checkoutHref={checkoutHref}
          guaranteeDays={store.guaranteeDays}
          bonuses={bonuses}
          color={store.primaryColor}
          dark={store.accentColor}
        />
      )}
      {product.deliveryNotice && (
        <div className="mx-auto max-w-3xl px-4">
          <Paragraphs text={`📩 ${product.deliveryNotice}`} className="rounded-2xl bg-white p-4 text-center text-sm text-black/65" />
        </div>
      )}
      <StoreFooter store={store} base={base} />
    </>
  );
}
