import { notFound, redirect } from "next/navigation";
import { storeContext } from "@/lib/store-page";
import { getOfferState } from "@/lib/funnels";
import { embedUrl } from "@/lib/blocks";
import { formatMoney } from "@/lib/money";
import { fill } from "@/lib/i18n";
import { storeUrl } from "@/lib/stores";
import { Paragraphs, StoreHeader } from "@/components/store/chrome";
import { OfferClient } from "@/components/store/buyer-client";

type Props = { params: Promise<{ store: string; orderId: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Oferta post-compra (upsell / downsell) con reserva y aceptación 1-click. */
export default async function OfferPage({ params, searchParams }: Props) {
  const { store: storeParam, orderId } = await params;
  const sp = await searchParams;
  const { store, base, d } = await storeContext(storeParam);
  const state = await getOfferState(orderId, sp.k);
  if ("error" in state || state.order.storeId !== store.id) notFound();
  const k = state.order.accessKey;
  if (state.done) redirect(`${base}/gracias/${orderId}?k=${k}`);

  const { node, product, price, currency, compareAt, remainingMs } = state;
  const accion = (sp.accion === "aceptar" || sp.accion === "rechazar") && sp.n === node.id ? sp.accion : null;
  if (node.contentMode === "CUSTOM_HTML" && node.customHtml && !accion) redirect(`${base}/vista/oferta/${orderId}?k=${k}`);

  const fmt = (n: number) => formatMoney(n, currency, store.language);
  const vars = { price: fmt(price), compare_price: compareAt ? fmt(compareAt) : "", product: product.name, email: state.order.email };
  const media = node.videoUrl ? embedUrl(node.videoUrl) : null;
  const returnUrl = storeUrl(store, `/pago/${orderId}?k=${k}&p=`);

  return (
    <>
      <StoreHeader store={store} base={base} minimal />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="text-2xl leading-tight font-extrabold sm:text-3xl">{fill(node.title || d.offerWait, vars)}</h1>
          {node.subtitle && <p className="mt-3 text-lg text-black/65">{fill(node.subtitle, vars)}</p>}
          {media ? (
            <div className="mx-auto mt-6 aspect-video max-w-xl overflow-hidden rounded-2xl bg-black">
              {media.kind === "video" ? <video src={media.src} controls className="h-full w-full" /> : <iframe src={media.src} className="h-full w-full" allowFullScreen />}
            </div>
          ) : (
            (node.imageUrl || product.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.imageUrl || product.imageUrl!} alt={product.name} className="mx-auto mt-6 max-h-80 rounded-2xl shadow-xl" />
            )
          )}
          <h2 className="mt-6 text-xl font-bold">{product.name}</h2>
          {node.body && <Paragraphs text={fill(node.body, vars)} className="mx-auto mt-3 max-w-lg text-left text-black/70" />}
          <div className="my-6 flex items-baseline justify-center gap-3">
            {compareAt && compareAt > price && <s className="text-lg text-black/40">{fmt(compareAt)}</s>}
            <span className="text-4xl font-extrabold" style={{ color: store.accentColor }}>
              {fmt(price)}
            </span>
          </div>
          <OfferClient
            orderId={orderId}
            accessKey={k}
            nodeId={node.id}
            d={d}
            acceptText={fill(node.acceptText || d.offerAccept, vars)}
            declineText={fill(node.declineText || d.offerDecline, vars)}
            timerTemplate={(node.timerText || d.offerTimer).includes("{timer}") ? node.timerText || d.offerTimer : `${node.timerText || d.offerTimer} {timer}`}
            remainingMs={remainingMs}
            autoAction={accion}
            returnUrl={returnUrl}
          />
        </div>
      </main>
    </>
  );
}
