import Link from "next/link";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { abWinner, funnelStats } from "@/lib/funnel-core";
import { formatMoney, num } from "@/lib/money";
import { createCheckoutTestAction, endCheckoutTestAction } from "../../../actions/marketing";
import { ActionButton, ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, Notice, PageHeader, fmtDate, pct } from "@/components/ui";

async function checkoutTestStats(t: { id: string; storeId: string; productId: string; startedAt: Date; endedAt: Date | null }) {
  const rows: { variant: string; views: number; orders: number; revenue: number }[] = [];
  for (const v of ["A", "B"]) {
    const views = await db.analyticsEvent.findMany({
      where: { storeId: t.storeId, productId: t.productId, type: "CHECKOUT_VIEW", abVariant: v, createdAt: { gte: t.startedAt, ...(t.endedAt ? { lte: t.endedAt } : {}) } },
      distinct: ["visitorId"],
      select: { visitorId: true },
    });
    const orders = await db.order.findMany({ where: { abTestId: t.id, abVariant: v, status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, testMode: false }, select: { paidTotal: true } });
    rows.push({ variant: v, views: views.length, orders: orders.length, revenue: orders.reduce((s, o) => s + num(o.paidTotal), 0) });
  }
  return rows;
}

export default async function AbTestsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "marketing");
  const tests = await db.checkoutTest.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  const products = await db.product.findMany({ where: { storeId, status: "PUBLISHED" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const testStats = await Promise.all(tests.map((t) => checkoutTestStats(t)));
  const funnels = await db.funnel.findMany({ where: { storeId, nodes: { some: { abTestActive: true } } }, include: { nodes: { where: { abTestActive: true }, include: { product: true } } } });
  const offerStats = await Promise.all(funnels.map((f) => funnelStats(f)));
  const fmt = (n: number) => formatMoney(n, store.baseCurrency);

  return (
    <>
      <PageHeader title="Tests A/B" description="Probá dos versiones con la misma audiencia y decidí con datos: facturado por visita, no solo conversión." />
      <h2 className="mb-3 text-lg font-semibold">Ofertas post-compra</h2>
      {funnels.length === 0 ? (
        <p className="mb-8 text-sm text-muted">
          No hay tests de ofertas activos. Se configuran dentro de cada oferta en <Link href={`/panel/${storeId}/embudos`} className="underline">Embudos</Link>.
        </p>
      ) : (
        <div className="mb-8 space-y-3">
          {funnels.map((f, i) =>
            f.nodes.map((n) => {
              const ab = abWinner(offerStats[i], n.id, n.abStartedAt);
              return (
                <Link key={n.id} href={`/panel/${storeId}/embudos/${f.id}#node-${n.id}`} className="card block p-4 hover:border-ink/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>
                      {f.name} · {n.label} ({n.product.name})
                    </b>
                    {ab.ready ? <Badge tone="ok">Ganadora sugerida: {ab.winner}</Badge> : <Badge tone="warn">Juntando datos · {Math.floor(ab.days)} días</Badge>}
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {[ab.a, ab.b].map((s, j) => (
                      <div key={j} className="rounded-xl bg-paper px-3 py-2">
                        Variante {j === 0 ? "A" : "B"}: {s ? `${s.views} vistas · ${s.accepted} cobros · ${pct(s.rate)} · ${fmt(s.perView)}/vista` : "sin datos"}
                      </div>
                    ))}
                  </div>
                </Link>
              );
            }),
          )}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Checkout</h2>
      {store.type !== "CHECKOUT" ? (
        <Notice tone="warn">
          Los tests A/B de checkout están disponibles en tiendas tipo <b>Checkout</b> (cambialo en Configuración). En tiendas tipo Tienda usá los tests de ofertas post-compra.
        </Notice>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Nuevo test de checkout" description="Cada visitante queda fijo en su variante (50/50). Lo que dejes vacío usa lo configurado en el producto.">
            <ActionForm action={createCheckoutTestAction.bind(null, storeId)} className="grid gap-3">
              <Field label="Nombre">
                <input name="name" required className="input" placeholder="Precio 9.99 vs 12.99" />
              </Field>
              <Field label="Producto">
                <select name="productId" defaultValue={store.mainProductId ?? ""} className="input">
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(["a", "b"] as const).map((p) => (
                  <div key={p} className="grid gap-2 rounded-xl bg-paper p-3">
                    <b className="text-sm">Variante {p.toUpperCase()}</b>
                    <input name={`${p}_title`} className="input" placeholder="Título" />
                    <input name={`${p}_subtitle`} className="input" placeholder="Subtítulo" />
                    <input name={`${p}_price`} inputMode="decimal" className="input" placeholder={`Precio (${store.baseCurrency})`} />
                    <input name={`${p}_compare`} inputMode="decimal" className="input" placeholder="Precio tachado" />
                    <input name={`${p}_button`} className="input" placeholder="Texto del botón" />
                    <Toggle name={`${p}_bumps`} defaultChecked label="Mostrar order bumps" />
                  </div>
                ))}
              </div>
              <SubmitButton>Iniciar test</SubmitButton>
            </ActionForm>
          </Card>
          <div className="space-y-3">
            {tests.map((t, i) => {
              const [a, b] = testStats[i];
              const days = (Date.now() - t.startedAt.getTime()) / 86400_000;
              const ready = days >= 7 && a.orders >= 30 && b.orders >= 30;
              const winner = a.views && b.views ? (a.revenue / a.views >= b.revenue / b.views ? "A" : "B") : null;
              return (
                <div key={t.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{t.name}</b>
                    {t.active ? <Badge tone="ok">Activo</Badge> : <Badge>Finalizado {t.winner ? `· ganó ${t.winner}` : ""}</Badge>}
                  </div>
                  <div className="text-xs text-muted">Desde {fmtDate(t.startedAt, store.timezone)}</div>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    {[a, b].map((s) => (
                      <div key={s.variant} className="rounded-xl bg-paper px-3 py-2">
                        <b>{s.variant}</b>: {s.views} vistas · {s.orders} ventas · {pct(s.views ? s.orders / s.views : 0, 2)} · {fmt(s.views ? s.revenue / s.views : 0)}/visita
                      </div>
                    ))}
                  </div>
                  {t.active && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {ready && winner && <Badge tone="ok">Ganadora sugerida: {winner}</Badge>}
                      <ActionButton action={endCheckoutTestAction.bind(null, storeId, t.id, winner)} confirm="¿Finalizar el test?">
                        Finalizar
                      </ActionButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
