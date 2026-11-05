import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { requireUser, getUserStores } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeBaseUrl } from "@/lib/stores";
import { summary } from "@/lib/metrics";
import { formatMoney } from "@/lib/money";
import { inTrial } from "@/lib/billing";
import { Badge, EmptyState, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Mis tiendas" };

export default async function StoresPage() {
  const user = await requireUser();
  const stores = await getUserStores(user.id);
  const since = new Date(Date.now() - 30 * 86400_000);
  const rows = await Promise.all(
    stores.map(async ({ store, role }) => {
      const def = await db.market.findFirst({ where: { storeId: store.id, isDefault: true } });
      const currency = def?.currency ?? store.baseCurrency;
      const s = await summary([store.id], { from: since, to: new Date() }, currency);
      return { store, role, s, currency };
    }),
  );
  const jobs = await db.aiJob.findMany({ where: { userId: user.id, kind: "STORE", status: { in: ["QUEUED", "RUNNING"] } } });
  const ownCount = stores.filter((s) => s.role === "OWNER" && s.store.suspendedReason !== "closed").length;
  const openInvoice = await db.platformInvoice.findFirst({ where: { userId: user.id, status: { in: ["OPEN", "OVERDUE"] } } });

  return (
    <>
      <PageHeader
        title="Mis tiendas"
        description={`Plan ${user.plan.name}: ${ownCount}/${user.plan.maxStores} tiendas${inTrial(user) ? ` · prueba gratis hasta el ${fmtDate(user.trialEndsAt, undefined, false)}` : ""}`}
        actions={
          <>
            <Link href="/panel/nueva?modo=ia" className="btn btn-brand">
              <Sparkles size={16} /> Crear con IA
            </Link>
            <Link href="/panel/nueva" className="btn btn-secondary">
              <Plus size={16} /> Nueva tienda
            </Link>
          </>
        }
      />
      {openInvoice && (
        <Link href="/panel/plan" className="mb-6 block rounded-2xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          Tenés una factura {openInvoice.status === "OVERDUE" ? "vencida" : "pendiente"} por USD {openInvoice.totalUsd.toString()}. Pagala para evitar que se pause el checkout →
        </Link>
      )}
      {jobs.map((j) => (
        <Link key={j.id} href={`/panel/nueva/ia/${j.id}`} className="mb-4 block rounded-2xl bg-mint-soft px-4 py-3 text-sm font-medium text-mint">
          La IA está creando una tienda… ({j.progress}%) Ver progreso →
        </Link>
      ))}
      {rows.length === 0 ? (
        <EmptyState
          title="Todavía no tenés tiendas"
          description="Creá tu primera tienda en minutos. Si todavía no tenés producto, la IA arma la tienda, el producto y la página de venta por vos."
          action={
            <Link href="/panel/nueva?modo=ia" className="btn btn-brand">
              <Sparkles size={16} /> Crear mi tienda con IA
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map(({ store, role, s, currency }) => (
            <Link key={store.id} href={`/panel/${store.id}`} className="card block p-5 transition hover:border-ink/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{store.name}</div>
                  <div className="truncate text-xs text-muted">{storeBaseUrl(store).replace(/^https?:\/\//, "")}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {store.status !== "ACTIVE" && <Badge tone="bad">Suspendida</Badge>}
                  {store.testMode && <Badge tone="warn">Modo prueba</Badge>}
                  {role !== "OWNER" && <Badge>{role.toLowerCase()}</Badge>}
                  <Badge tone="neutral">{store.type === "CHECKOUT" ? "Checkout" : "Tienda"}</Badge>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Ingresos 30 días</div>
                  <div className="font-semibold tabular-nums">{formatMoney(s.revenue, currency)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Ventas</div>
                  <div className="font-semibold tabular-nums">{s.sales}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Visitas</div>
                  <div className="font-semibold tabular-nums">{s.visits}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
