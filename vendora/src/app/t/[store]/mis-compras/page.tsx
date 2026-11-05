import Link from "next/link";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { getBuyer } from "@/lib/buyer";
import { StoreFooter, StoreHeader } from "@/components/store/chrome";
import { MembersLogin } from "@/components/store/buyer-client";

type Props = { params: Promise<{ store: string }> };

/** Área de miembros: compras del comprador (acceso por enlace mágico). */
export default async function MyPurchasesPage({ params }: Props) {
  const { store, base, d } = await storeContext((await params).store);
  const buyer = await getBuyer(store.id);
  const grants = buyer
    ? await db.accessGrant.findMany({
        where: { customerId: buyer.id, revokedAt: null },
        include: { product: true, order: { select: { number: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <>
      <StoreHeader store={store} base={base} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        {!buyer ? (
          <div className="mx-auto max-w-md rounded-3xl bg-white p-7 shadow-sm">
            <h1 className="text-2xl font-bold">{d.loginTitle}</h1>
            <p className="mt-1 mb-5 text-sm text-black/60">{d.loginHint}</p>
            <MembersLogin storeId={store.id} d={d} />
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{d.myPurchases}</h1>
                <p className="text-sm text-black/55">{buyer.email}</p>
              </div>
              <a href={`${base}/mis-compras/salir`} className="text-sm text-black/55 underline">
                {d.logout}
              </a>
            </div>
            {grants.length === 0 ? (
              <p className="rounded-2xl bg-white p-6 text-center text-black/55">{d.noPurchases}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[...new Map(grants.map((g) => [g.productId, g])).values()].map((g) => (
                  <Link key={g.id} href={`${base}/mis-compras/${g.productId}`} className="flex gap-4 rounded-3xl bg-white p-4 shadow-sm transition hover:shadow-md">
                    {g.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.product.imageUrl} alt="" className="h-24 w-[72px] rounded-lg object-cover" />
                    ) : (
                      <div className="h-24 w-[72px] rounded-lg" style={{ background: store.accentColor }} />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold">{g.product.name}</div>
                      <div className="mt-1 text-xs text-black/50">#{g.order.number}</div>
                      <div className="mt-3 text-sm font-semibold" style={{ color: store.primaryColor }}>
                        {d.open} →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
