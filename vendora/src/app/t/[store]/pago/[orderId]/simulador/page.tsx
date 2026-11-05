import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { approvePayment, getBuyerOrder, rejectPayment } from "@/lib/orders";
import { formatMoney } from "@/lib/money";
import { env } from "@/lib/env";

type Props = { params: Promise<{ store: string; orderId: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Pasarela simulada ("Modo prueba"): permite aprobar o rechazar el pago sin cobrar. */
export default async function SimulatorPage({ params, searchParams }: Props) {
  const { store: storeParam, orderId } = await params;
  const sp = await searchParams;
  const { store, base } = await storeContext(storeParam);
  const order = await getBuyerOrder(orderId, sp.k);
  if (!order || order.storeId !== store.id) notFound();
  const payment = await db.payment.findFirst({ where: { id: sp.p, orderId: order.id, provider: "TEST" } });
  if (!payment || !store.testMode || !env.allowTestPayments) notFound();
  const back = `${base}/pago/${order.id}?k=${order.accessKey}&p=${payment.id}`;

  async function decide(formData: FormData) {
    "use server";
    const ok = formData.get("decision") === "approve";
    const p = await db.payment.findUnique({ where: { id: payment!.id } });
    if (p?.status === "PENDING") {
      if (ok) await approvePayment(p.id, { providerPaymentId: `test_${p.id}` });
      else await rejectPayment(p.id, "rechazado en el simulador");
    }
    redirect(back);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border-2 border-dashed border-amber-400 bg-white p-7 text-center shadow-sm">
        <div className="mb-2 text-xs font-bold tracking-widest text-amber-600 uppercase">Pasarela de prueba</div>
        <h1 className="text-xl font-bold">{store.name}</h1>
        <p className="mt-1 text-sm text-black/55">Pedido #{order.number} · {order.email}</p>
        <div className="my-6 text-4xl font-extrabold">{formatMoney(payment.amount, payment.currency, store.language)}</div>
        <p className="mb-6 text-sm text-black/60">No se cobra nada. Elegí el resultado para probar el flujo completo (entrega, upsells, emails y métricas).</p>
        <form action={decide} className="grid gap-3">
          <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">
            Aprobar pago
          </button>
          <button name="decision" value="reject" className="rounded-xl border border-black/15 px-5 py-3 font-semibold">
            Rechazar pago
          </button>
        </form>
      </div>
    </main>
  );
}
