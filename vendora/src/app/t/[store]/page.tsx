import Link from "next/link";
import { db } from "@/lib/db";
import { storeContext, resolveMarket } from "@/lib/store-page";
import { productPrice, percentOff } from "@/lib/pricing";
import { formatMoney } from "@/lib/money";
import { StoreFooter, StoreHeader, Tracker, Unavailable } from "@/components/store/chrome";
import { CheckoutView } from "@/components/store/checkout-view";

type Props = { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StoreHome({ params, searchParams }: Props) {
  const { store, base, d, country } = await storeContext((await params).store);
  if (store.status !== "ACTIVE") return <Unavailable store={store} />;

  // Tienda tipo Checkout: la raíz abre directamente el checkout del producto principal.
  if (store.type === "CHECKOUT" && store.mainProductId) {
    return <CheckoutView store={store} productId={store.mainProductId} base={base} country={country} search={await searchParams} />;
  }

  const market = await resolveMarket(store);
  const products = await db.product.findMany({
    where: { storeId: store.id, status: "PUBLISHED", visibility: "PUBLIC" },
    include: { marketPrices: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <StoreHeader store={store} base={base} />
      <Tracker storeId={store.id} type="PAGE_VIEW" pixelId={store.metaPixelId} ga4Id={store.ga4Id} tiktokId={store.tiktokPixelId} />
      <section className="relative overflow-hidden">
        {store.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-extrabold sm:text-5xl" style={{ color: store.accentColor }}>
            {store.headline || store.name}
          </h1>
          {store.description && <p className="mt-4 max-w-xl text-lg text-black/65">{store.description}</p>}
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4">
        <h2 className="mb-5 text-xl font-bold">{d.products}</h2>
        {products.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-black/55">{d.noProducts}</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const price = productPrice(p, market, store.baseCurrency);
              const off = percentOff(price.price, price.compareAt);
              return (
                <article key={p.id} className="flex flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
                  <Link href={`${base}/p/${p.slug}`} className="block aspect-[4/5] bg-black/[0.03]">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center p-6 text-center font-display text-xl font-bold" style={{ background: store.accentColor, color: "white" }}>
                        {p.name}
                      </div>
                    )}
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.shortDescription && <p className="mt-1 line-clamp-3 text-sm text-black/60">{p.shortDescription}</p>}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <div>
                        {price.compareAt && price.compareAt > price.price && <s className="mr-1.5 text-sm text-black/40">{formatMoney(price.compareAt, price.currency, store.language)}</s>}
                        <b>{price.price > 0 ? formatMoney(price.price, price.currency, store.language) : d.free}</b>
                        {off > 0 && <span className="ml-1.5 text-xs font-bold" style={{ color: store.primaryColor }}>-{off}%</span>}
                      </div>
                      <a href={`${base}/checkout/${p.slug}`} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: store.primaryColor }}>
                        {d.buyNow}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
