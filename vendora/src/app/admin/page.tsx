import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { perUsd } from "@/lib/fx";
import { PageHeader, Stat, fmtDate } from "@/components/ui";

export default async function AdminHome() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, stores, activeStores, payments, pendingComm, invoicedComm, open, overdue, recent, failedJobs, paidUsers] = await Promise.all([
    db.user.count(),
    db.store.count(),
    db.store.count({ where: { status: "ACTIVE", orders: { some: { status: "PAID", paidAt: { gte: since } } } } }),
    db.payment.findMany({ where: { status: "APPROVED", approvedAt: { gte: since }, order: { testMode: false } }, select: { amount: true, currency: true } }),
    db.commissionEntry.aggregate({ where: { status: "PENDING" }, _sum: { amountUsd: true } }),
    db.commissionEntry.aggregate({ where: { status: "INVOICED", createdAt: { gte: since } }, _sum: { amountUsd: true } }),
    db.platformInvoice.aggregate({ where: { status: "OPEN" }, _sum: { totalUsd: true }, _count: true }),
    db.platformInvoice.aggregate({ where: { status: "OVERDUE" }, _sum: { totalUsd: true }, _count: true }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { plan: true } }),
    db.aiJob.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    db.user.findMany({ where: { status: "ACTIVE", plan: { priceUsd: { gt: 0 } } }, include: { plan: true } }),
  ]);
  const rates = new Map<string, number>();
  let gmv = 0;
  for (const p of payments) {
    if (!rates.has(p.currency)) rates.set(p.currency, await perUsd(p.currency));
    gmv += num(p.amount) / rates.get(p.currency)!;
  }
  const mrr = paidUsers.filter((u) => !u.trialEndsAt || u.trialEndsAt < new Date()).reduce((s, u) => s + num(u.plan.priceUsd), 0);
  const trials = paidUsers.filter((u) => u.trialEndsAt && u.trialEndsAt > new Date()).length;
  const usd = (n: number) => `USD ${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  return (
    <>
      <PageHeader title="Resumen de la plataforma" description="Últimos 30 días" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Usuarios" value={users} sub={`${trials} en prueba`} />
        <Stat label="Tiendas" value={stores} sub={`${activeStores} con ventas en 30 días`} />
        <Stat label="GMV 30 días" value={usd(gmv)} />
        <Stat label="MRR (abonos)" value={usd(mrr)} />
        <Stat label="Comisiones facturadas 30 días" value={usd(num(invoicedComm._sum.amountUsd))} />
        <Stat label="Comisiones a facturar" value={usd(num(pendingComm._sum.amountUsd))} />
        <Stat label="Facturas abiertas" value={open._count} sub={usd(num(open._sum.totalUsd))} />
        <Stat label="Facturas vencidas" value={overdue._count} sub={usd(num(overdue._sum.totalUsd))} tone={overdue._count ? "down" : null} />
      </div>
      <div className="mt-6 card p-5">
        <h2 className="mb-3 font-semibold">Últimos registros</h2>
        <ul className="divide-y divide-line text-sm">
          {recent.map((u) => (
            <li key={u.id} className="flex justify-between gap-3 py-2">
              <span>
                {u.name} · <span className="text-muted">{u.email}</span>
              </span>
              <span className="text-muted">
                {u.plan.name} · {fmtDate(u.createdAt)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Trabajos de IA fallidos en 30 días: {failedJobs}</p>
      </div>
    </>
  );
}
