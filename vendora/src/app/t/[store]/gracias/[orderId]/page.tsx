import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { getBuyerOrder } from "@/lib/orders";
import { getThankYouSettings } from "@/lib/store-settings";
import { formatMoney, num } from "@/lib/money";
import { fill } from "@/lib/i18n";
import { StoreFooter, StoreHeader, Tracker } from "@/components/store/chrome";
import { PurchaseEvent } from "@/components/store/buyer-client";

type Props = { params: Promise<{ store: string; orderId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function ThankYouPage({ params, searchParams }: Props) {
  const { store: storeParam, orderId } = await params;
  const sp = await searchParams;
  const { store, base, d } = await storeContext(storeParam);
  const order = await getBuyerOrder(orderId, sp.k);
  if (!order || order.storeId !== store.id) notFound();
  if (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") redirect(`${base}/pago/${order.id}?k=${order.accessKey}`);
  if (order.currentNodeId && !order.funnelDone) {
    await db.order.update({ where: { id: order.id }, data: { funnelDone: true, currentNodeId: null } });
  }

  const funnel = order.funnelId ? await db.funnel.findUnique({ where: { id: order.funnelId } }) : null;
  const ty = getThankYouSettings(store, funnel?.thankYouOverride);
  const grants = await db.accessGrant.findMany({
    where: { orderId: order.id, revokedAt: null },
    include: { product: { include: { modules: { select: { id: true } } } }, downloads: { include: { file: true } } },
    orderBy: { createdAt: "asc" },
  });
  const links = await db.productFile.findMany({ where: { productId: { in: grants.map((g) => g.productId) }, kind: "LINK" } });
  const initial = order.payments.find((p) => p.kind === "INITIAL");
  const pendingItems = order.items.filter((i) => i.status === "PENDING" && i.kind !== "BONUS");

  return (
    <>
      <StoreHeader store={store} base={base} />
      <Tracker storeId={store.id} type="PAGE_VIEW" pixelId={store.metaPixelId} ga4Id={store.ga4Id} tiktokId={store.tiktokPixelId} skipEvent />
      {initial && initial.status === "APPROVED" && (
        <PurchaseEvent
          eventId={`purchase-${initial.id}`}
          value={num(initial.amount)}
          currency={initial.currency}
          contentIds={order.items.filter((i) => i.paymentId === initial.id).map((i) => i.productId)}
          redirectUrl={ty.redirectUrl || null}
        />
      )}
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-10">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl text-white" style={{ background: store.primaryColor }}>
            ✓
          </div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{fill(ty.title || d.thankTitle, { email: order.email, name: order.name ?? "" })}</h1>
          <p className="mt-2 text-black/65">{fill(ty.message || d.thankMessage, { email: order.email, name: order.name ?? "" })}</p>
          <p className="mt-1 text-sm text-black/45">
            {fill(d.orderNumber, { number: order.number })} · {formatMoney(order.paidTotal, order.currency, store.language)}
          </p>
        </div>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-bold">{d.yourProducts}</h2>
          <ul className="space-y-4">
            {grants.map((g) => (
              <li key={g.id} className="rounded-2xl border border-black/5 p-4">
                <div className="flex items-center gap-3">
                  {g.product.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.product.imageUrl} alt="" className="h-14 w-11 rounded-md object-cover" />
                  )}
                  <div className="font-semibold">{g.product.name}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.downloads.map((dl) => (
                    <a key={dl.id} href={`${base}/d/${dl.token}`} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: store.primaryColor }}>
                      ⬇ {d.download} · {dl.file.name}
                    </a>
                  ))}
                  {links
                    .filter((l) => l.productId === g.productId)
                    .map((l) => (
                      <a key={l.id} href={l.url!} target="_blank" rel="noreferrer" className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold">
                        ↗ {l.name}
                      </a>
                    ))}
                  {g.product.modules.length > 0 && (
                    <Link href={`${base}/mis-compras/${g.productId}`} className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold">
                      ▶ {d.content}
                    </Link>
                  )}
                </div>
              </li>
            ))}
            {pendingItems.map((i) => (
              <li key={i.id} className="rounded-2xl border border-dashed border-black/15 p-4 text-sm">
                <div className="font-semibold">{i.name}</div>
                <div className="text-black/50">{d.pendingDelivery}</div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`${base}/mis-compras`} className="rounded-xl border border-black/15 px-5 py-2.5 text-sm font-semibold">
              {d.goToMyPurchases}
            </Link>
            <Link href={ty.buttonUrl || base || "/"} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: store.accentColor }}>
              {ty.buttonText || d.backToStore}
            </Link>
          </div>
        </section>
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
