import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getUserStores, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartStats, startOfDayTz, summary, utmTable } from "@/lib/metrics";
import { formatMoney, CURRENCIES } from "@/lib/money";
import { AutoRefresh } from "@/components/client";
import { PushToggle } from "@/components/push-toggle";
import { Badge, PAYMENT_STATUS, PROVIDER_LABEL, pct } from "@/components/ui";

export const metadata = { title: "App" };

/** App instalable (PWA), solo lectura: ventas de todas tus tiendas, feed en vivo y avisos por cada venta. */
export default async function MobileApp({ searchParams }: { searchParams: Promise<{ moneda?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const stores = (await getUserStores(user.id)).filter((s) => can(s.role, "metrics")).map((s) => s.store);
  const ids = stores.map((s) => s.id);
  const sp = await searchParams;
  const firstMarket = ids.length ? await db.market.findFirst({ where: { storeId: ids[0], isDefault: true } }) : null;
  const currency = sp.moneda && CURRENCIES.includes(sp.moneda) ? sp.moneda : firstMarket?.currency ?? stores[0]?.baseCurrency ?? "USD";
  const tz = stores[0]?.timezone ?? "America/Argentina/Buenos_Aires";
  const now = new Date();
  const today = { from: startOfDayTz(now, tz), to: new Date(now.getTime() + 1000) };
  const monthStartKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(now);
  const month = { from: startOfDayTz(new Date(`${monthStartKey}-01T12:00:00Z`), tz), to: today.to };
  const week = { from: new Date(today.from.getTime() - 6 * 86400_000), to: today.to };
  const last30 = { from: new Date(today.from.getTime() - 29 * 86400_000), to: today.to };
  const fmt = (n: number) => formatMoney(n, currency, "es");

  const [dayS, monthS, s30, utm, carts, feed, perStore] = await Promise.all([
    summary(ids, today, currency),
    summary(ids, month, currency),
    summary(ids, last30, currency),
    utmTable(ids, last30, currency, "campaign"),
    cartStats(ids, last30),
    db.payment.findMany({
      where: { order: { storeId: { in: ids } }, status: { in: ["APPROVED", "PENDING", "REJECTED", "REFUNDED"] } },
      include: { order: { include: { store: true, items: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    Promise.all(stores.map(async (s) => ({ store: s, week: await summary([s.id], week, currency), month: await summary([s.id], month, currency) }))),
  ]);
  const abandoned = await db.checkout.findMany({ where: { storeId: { in: ids }, status: "ABANDONED" }, orderBy: { emailCapturedAt: "desc" }, take: 5 });

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-5 pb-16">
      <AutoRefresh seconds={15} />
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">Hola, {user.name.split(" ")[0]}</div>
          <h1 className="text-xl font-bold">Tus ventas</h1>
        </div>
        <Link href="/panel" className="text-sm font-medium underline">
          Panel
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-ink p-4 text-white">
          <div className="text-xs text-white/60">Hoy</div>
          <div className="mt-1 font-display text-2xl font-bold">{fmt(dayS.revenue)}</div>
          <div className="text-xs text-white/70">{dayS.sales} ventas</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="text-xs text-muted">Este mes</div>
          <div className="mt-1 font-display text-2xl font-bold">{fmt(monthS.revenue)}</div>
          <div className="text-xs text-muted">{monthS.sales} ventas</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="text-xs text-muted">Ticket promedio (30 días)</div>
          <div className="mt-1 text-lg font-bold">{fmt(s30.avgTicket)}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="text-xs text-muted">Conversión 30 días</div>
          <div className="mt-1 text-lg font-bold">{pct(s30.conversion, 2)}</div>
          <div className="text-xs text-muted">
            {s30.visits} visitas · {s30.paymentsInitiated} checkouts · {s30.sales} compras
          </div>
        </div>
      </div>
      <div className="mt-4">
        <PushToggle />
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Ventas en vivo</h2>
      <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
        {feed.length === 0 && <li className="p-4 text-sm text-muted">Todavía no hay ventas.</li>}
        {feed.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{p.order.items.filter((i) => i.paymentId === p.id && i.kind !== "BONUS").map((i) => i.name).join(" + ") || `Pedido #${p.order.number}`}</div>
              <div className="truncate text-xs text-muted">
                {p.order.store.name} · {PROVIDER_LABEL[p.provider]} · {new Intl.DateTimeFormat("es-AR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(p.createdAt)}
                {p.order.testMode ? " · prueba" : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">{formatMoney(p.amount, p.currency)}</div>
              <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Por tienda</h2>
      <ul className="space-y-2">
        {perStore.map(({ store, week: w, month: m }) => (
          <li key={store.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            <div className="font-semibold">{store.name}</div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted">
              <span>
                Semana: <b className="text-ink">{fmt(w.revenue)}</b> ({w.sales})
              </span>
              <span>
                Mes: <b className="text-ink">{fmt(m.revenue)}</b> ({m.sales})
              </span>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Campañas UTM (30 días)</h2>
      <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
        {utm.slice(0, 6).map((u) => (
          <li key={u.key} className="flex justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="truncate">{u.key}</span>
            <span className="shrink-0 text-xs text-muted">
              {u.visits} visitas · {u.sales} ventas · {fmt(u.revenue)}
            </span>
          </li>
        ))}
        {utm.length === 0 && <li className="p-4 text-sm text-muted">Sin visitas todavía.</li>}
      </ul>

      <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Carritos abandonados (30 días): {carts.abandoned} · recuperados {carts.recovered}</h2>
      <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
        {abandoned.map((c) => (
          <li key={c.id} className="flex justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="truncate">{c.email}</span>
            <span className="shrink-0 tabular-nums">{formatMoney(c.total, c.currency)}</span>
          </li>
        ))}
        {abandoned.length === 0 && <li className="p-4 text-sm text-muted">Sin carritos con potencial de recuperación.</li>}
      </ul>
      <form className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
        Moneda
        <select name="moneda" defaultValue={currency} className="input w-auto py-1 text-xs">
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="underline">Aplicar</button>
      </form>
    </div>
  );
}
