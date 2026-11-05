import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStorePage, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartStats, dailySeries, parseRange, PRESETS, pctChange, summary, topProducts, utmTable, UTM_DIMENSIONS, type UtmDim } from "@/lib/metrics";
import { formatMoney, CURRENCIES } from "@/lib/money";
import { Badge, Card, ORDER_STATUS, PROVIDER_LABEL, PageHeader, Stat, fmtDate, pct } from "@/components/ui";
import { FunnelBars, RevenueBars } from "@/components/panel/charts";

type Props = { params: Promise<{ storeId: string }>; searchParams: Promise<Record<string, string | undefined>> };

function delta(cur: number, prev: number, isRate = false) {
  const c = pctChange(cur, prev);
  if (!prev && !cur) return { text: "sin cambios", tone: null as null };
  const sign = c > 0 ? "▲" : c < 0 ? "▼" : "•";
  const value = isRate ? `${((cur - prev) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} pp` : `${(Math.abs(c) * 100).toLocaleString("es-AR", { maximumFractionDigits: 0 })} %`;
  return { text: `${sign} ${value} vs período anterior`, tone: c > 0 ? ("up" as const) : c < 0 ? ("down" as const) : null };
}

export default async function DashboardPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { store, role } = await requireStorePage(storeId, "view");
  if (!can(role, "metrics")) redirect(`/panel/${storeId}/ventas`);

  const def = await db.market.findFirst({ where: { storeId, isDefault: true } });
  const currency = sp.moneda && CURRENCIES.includes(sp.moneda) ? sp.moneda : def?.currency ?? store.baseCurrency;
  const range = parseRange(sp.rango, sp.desde, sp.hasta, store.timezone);
  const dim = (sp.utm && sp.utm in UTM_DIMENSIONS ? sp.utm : "campaign") as UtmDim;
  const ids = [storeId];
  const [cur, prev, series, utm, top, carts, recent] = await Promise.all([
    summary(ids, range, currency),
    summary(ids, range.prev, currency),
    dailySeries(ids, range, currency, store.timezone),
    utmTable(ids, range, currency, dim),
    topProducts(ids, range, currency),
    cartStats(ids, range),
    db.order.findMany({ where: { storeId, status: { not: "PENDING" } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const fmt = (n: number) => formatMoney(n, currency, "es");
  const qs = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ ...(sp as Record<string, string>), ...patch });
    return `/panel/${storeId}?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Inicio"
        description={`${PRESETS[range.key]} · ${fmtDate(range.from, store.timezone, false)} – ${fmtDate(new Date(range.to.getTime() - 1), store.timezone, false)} · montos en ${currency}`}
      />
      {store.testMode && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          Modo prueba activo: las compras simuladas no suman en las métricas. Las ves en <Link href={`/panel/${storeId}/ventas?prueba=1`} className="font-semibold underline">Ventas</Link>.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {Object.entries(PRESETS)
          .filter(([k]) => k !== "custom")
          .map(([k, label]) => (
            <Link key={k} href={qs({ rango: k })} className={`rounded-full px-3 py-1.5 text-sm font-medium ${range.key === k ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/30"}`}>
              {label}
            </Link>
          ))}
        <form className="flex flex-wrap items-center gap-2" action={`/panel/${storeId}`}>
          <input type="hidden" name="rango" value="custom" />
          <input type="date" name="desde" defaultValue={sp.desde} className="input w-auto py-1.5" aria-label="Desde" />
          <input type="date" name="hasta" defaultValue={sp.hasta} className="input w-auto py-1.5" aria-label="Hasta" />
          <select name="moneda" defaultValue={currency} className="input w-auto py-1.5" aria-label="Moneda">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm">Aplicar</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos" value={fmt(cur.revenue)} sub={delta(cur.revenue, prev.revenue).text} tone={delta(cur.revenue, prev.revenue).tone} />
        <Stat label="Ventas" value={cur.sales} sub={delta(cur.sales, prev.sales).text} tone={delta(cur.sales, prev.sales).tone} />
        <Stat label="Ticket promedio" value={fmt(cur.avgTicket)} sub={delta(cur.avgTicket, prev.avgTicket).text} tone={delta(cur.avgTicket, prev.avgTicket).tone} />
        <Stat label="Conversión" value={pct(cur.conversion, 2)} sub={`${cur.visits} visitas · ${delta(cur.conversion, prev.conversion, true).text}`} tone={delta(cur.conversion, prev.conversion, true).tone} />
        <Stat label="Visitas únicas" value={cur.visits} sub={delta(cur.visits, prev.visits).text} tone={delta(cur.visits, prev.visits).tone} />
        <Stat label="Pagos iniciados → compra" value={pct(cur.checkoutConversion)} sub={`${cur.paymentsInitiated} pagos iniciados`} />
        <Stat label="Ingresos por order bumps" value={fmt(cur.bumpRevenue)} sub={cur.revenue ? `${pct(cur.bumpRevenue / cur.revenue)} del total` : "—"} />
        <Stat label="Ingresos por upsells" value={fmt(cur.offerRevenue)} sub={cur.revenue ? `${pct(cur.offerRevenue / cur.revenue)} del total` : "—"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Ingresos por día" className="lg:col-span-2">
          <RevenueBars data={series} format={fmt} />
        </Card>
        <Card title="Embudo de conversión">
          <FunnelBars
            steps={[
              { label: "Visitas", value: cur.visits },
              { label: "Vieron el checkout", value: cur.checkoutViews },
              { label: "Iniciaron el pago", value: cur.paymentsInitiated },
              { label: "Compraron", value: cur.sales },
            ]}
          />
          <div className="mt-5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Carritos abandonados</span>
              <b>{carts.abandoned + carts.open}</b>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted">Recuperados</span>
              <b>
                {carts.recovered} ({pct(carts.recoveryRate)})
              </b>
            </div>
            <Link href={`/panel/${storeId}/carritos`} className="mt-3 inline-block text-sm font-medium underline">
              Ver carritos
            </Link>
          </div>
        </Card>
      </div>

      <Card
        className="mt-6"
        title="Campañas (UTM)"
        description="Visitas, checkouts, ventas e ingresos según el UTM con el que llegó cada visitante."
        actions={
          <div className="flex flex-wrap gap-1">
            {Object.entries(UTM_DIMENSIONS).map(([k, label]) => (
              <Link key={k} href={qs({ utm: k })} className={`rounded-full px-2.5 py-1 text-xs font-medium ${dim === k ? "bg-ink text-white" : "bg-black/5"}`}>
                {label}
              </Link>
            ))}
          </div>
        }
      >
        {utm.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay visitas en este período.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{UTM_DIMENSIONS[dim]}</th>
                  <th className="text-right">Visitas</th>
                  <th className="text-right">Checkouts</th>
                  <th className="text-right">Ventas</th>
                  <th className="text-right">Conversión</th>
                  <th className="text-right">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {utm.map((r) => (
                  <tr key={r.key}>
                    <td className="max-w-xs truncate font-medium">{r.key}</td>
                    <td className="text-right tabular-nums">{r.visits}</td>
                    <td className="text-right tabular-nums">{r.checkouts}</td>
                    <td className="text-right tabular-nums">{r.sales}</td>
                    <td className="text-right tabular-nums">{pct(r.conversion, 2)}</td>
                    <td className="text-right tabular-nums">{fmt(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Productos más vendidos">
          {top.length === 0 ? (
            <p className="text-sm text-muted">Sin ventas en el período.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {top.map((p) => (
                <li key={p.productId} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums">
                    {p.units} · <b>{fmt(p.revenue)}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Últimas ventas" actions={<Link href={`/panel/${storeId}/ventas`} className="text-sm font-medium underline">Ver todas</Link>}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay ventas. Probá el flujo completo con la pasarela de prueba.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/panel/${storeId}/ventas/${o.id}`} className="min-w-0">
                    <div className="truncate font-medium">
                      #{o.number} · {o.email}
                    </div>
                    <div className="text-xs text-muted">
                      {fmtDate(o.createdAt, store.timezone)} · {PROVIDER_LABEL[o.provider]}
                      {o.testMode ? " · prueba" : ""}
                    </div>
                  </Link>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(o.paidTotal.toString() !== "0" ? o.paidTotal : o.total, o.currency)}</div>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
