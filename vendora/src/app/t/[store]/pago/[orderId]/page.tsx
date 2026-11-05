import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { applyProviderStatus, getBuyerOrder, rejectPayment } from "@/lib/orders";
import { gatewayCreds, gatewaySettings } from "@/lib/gateways";
import * as mercadopago from "@/lib/gateways/mercadopago";
import * as stripeGw from "@/lib/gateways/stripe";
import * as paypal from "@/lib/gateways/paypal";
import { getOfferState } from "@/lib/funnels";
import { formatMoney } from "@/lib/money";
import { fill } from "@/lib/i18n";
import { StoreFooter, StoreHeader } from "@/components/store/chrome";
import { TransferProof } from "@/components/store/buyer-client";
import { AutoRefresh } from "@/components/client";

type Props = { params: Promise<{ store: string; orderId: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Regreso de la pasarela: confirma el pago y lleva al comprador a la oferta post-compra o a la página de gracias. */
export default async function PaymentStatusPage({ params, searchParams }: Props) {
  const { store: storeParam, orderId } = await params;
  const sp = await searchParams;
  const { store, base, d } = await storeContext(storeParam);
  let order = await getBuyerOrder(orderId, sp.k);
  if (!order || order.storeId !== store.id) notFound();
  const k = order.accessKey;

  const payment = order.payments.find((p) => p.id === sp.p) ?? order.payments[order.payments.length - 1];
  if (payment && payment.status === "PENDING") {
    const gateway = await db.paymentGateway.findUnique({ where: { storeId_provider: { storeId: store.id, provider: payment.provider } } });
    try {
      if (gateway && payment.provider === "MERCADOPAGO" && (sp.payment_id || sp.collection_id)) {
        const st = await mercadopago.fetchPayment(gatewayCreds(gateway), String(sp.payment_id || sp.collection_id));
        if (st.paymentId === payment.id) await applyProviderStatus(payment.id, st);
      } else if (gateway && payment.provider === "STRIPE" && payment.providerRef) {
        await applyProviderStatus(payment.id, await stripeGw.fetchIntent(gatewayCreds(gateway), payment.providerRef));
      } else if (gateway && payment.provider === "PAYPAL" && payment.providerRef && sp.token === payment.providerRef && !sp.cancel) {
        await applyProviderStatus(payment.id, await paypal.capture(gatewayCreds(gateway), gatewaySettings(gateway), payment.providerRef));
      } else if (sp.cancel && payment.provider !== "TRANSFER") {
        await rejectPayment(payment.id, "cancelado por el comprador");
      }
    } catch {
      /* si la pasarela no responde, se espera el webhook */
    }
    order = (await getBuyerOrder(orderId, k))!;
  }
  const current = order.payments.find((p) => p.id === payment?.id) ?? payment;

  if (current?.status === "APPROVED" || (current?.kind === "OFFER" && current.status !== "PENDING")) {
    const state = await getOfferState(order.id, k);
    if (!("error" in state) && !state.done) redirect(`${base}/oferta/${order.id}?k=${k}`);
    redirect(`${base}/gracias/${order.id}?k=${k}`);
  }

  const mainItem = order.items.find((i) => i.kind === "MAIN");
  const product = mainItem ? await db.product.findUnique({ where: { id: mainItem.productId } }) : null;
  const retryHref = product ? `${base}/checkout/${product.slug}?email=${encodeURIComponent(order.email)}` : `${base}/checkout`;

  let body: React.ReactNode;
  if (current && (current.status === "REJECTED" || current.status === "CANCELLED")) {
    body = (
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl">✕</div>
        <h1 className="text-2xl font-bold">{d.paymentRejected}</h1>
        <p className="mt-2 text-black/60">{d.paymentRejectedHint}</p>
        <Link href={retryHref} className="mt-6 inline-block rounded-xl bg-[var(--sp)] px-6 py-3 font-bold text-white">
          {d.tryAgain}
        </Link>
      </div>
    );
  } else if (order.provider === "TRANSFER") {
    const g = await db.paymentGateway.findUnique({ where: { storeId_provider: { storeId: store.id, provider: "TRANSFER" } } });
    const instructions = String((g && gatewaySettings(g).instructions) || "");
    body = (
      <div>
        <h1 className="text-2xl font-bold">{d.transferTitle}</h1>
        <p className="mt-1 text-sm text-black/55">{fill(d.orderNumber, { number: order.number })}</p>
        <div className="mt-5 rounded-2xl bg-black/[0.03] p-4">
          <div className="text-sm text-black/55">{d.transferAmount}</div>
          <div className="text-3xl font-extrabold">{formatMoney(order.total, order.currency, store.language)}</div>
        </div>
        {instructions && <pre className="mt-4 rounded-2xl border border-black/10 bg-white p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{instructions}</pre>}
        <div className="mt-6">
          <TransferProof storeId={store.id} orderId={order.id} accessKey={k} d={d} uploaded={Boolean(order.transferProofUrl)} />
        </div>
        <p className="mt-4 text-sm text-black/55">{d.paymentPendingHint}</p>
      </div>
    );
  } else {
    const age = current ? Date.now() - current.updatedAt.getTime() : 0;
    body = (
      <div className="text-center">
        <AutoRefresh seconds={3} until={age > 10 * 60_000} />
        <div className="vd-pulse mx-auto mb-4 h-14 w-14 rounded-full bg-[var(--sp)] opacity-80" />
        <h1 className="text-2xl font-bold">{age > 120_000 ? d.paymentPending : d.confirmingPayment}</h1>
        <p className="mt-2 text-black/60">{d.paymentPendingHint}</p>
      </div>
    );
  }

  return (
    <>
      <StoreHeader store={store} base={base} minimal />
      <main className="mx-auto max-w-lg px-4 py-14">
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">{body}</div>
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
