import Link from "next/link";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, num } from "@/lib/money";
import { EmptyState, PageHeader, fmtDate } from "@/components/ui";

type Props = { params: Promise<{ storeId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function CustomersPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { store } = await requireStorePage(storeId, "orders");
  const q = sp.q?.trim();
  const customers = await db.customer.findMany({
    where: { storeId, ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}) },
    include: { orders: { where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, testMode: false }, select: { paidTotal: true, currency: true, createdAt: true, id: true, number: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = await db.customer.count({ where: { storeId } });
  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${total} comprador(es) y contactos que dejaron su email en el checkout`}
        actions={
          <a href={`/api/export/${storeId}/clientes`} className="btn btn-secondary">
            Exportar CSV
          </a>
        }
      />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por email o nombre" className="input max-w-sm" />
        <button className="btn btn-primary">Buscar</button>
      </form>
      {customers.length === 0 ? (
        <EmptyState title="Sin clientes todavía" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>País</th>
                <th className="text-right">Compras</th>
                <th className="text-right">Total</th>
                <th>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const last = c.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
                const byCurrency = new Map<string, number>();
                for (const o of c.orders) byCurrency.set(o.currency, (byCurrency.get(o.currency) ?? 0) + num(o.paidTotal));
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">{c.email}</div>
                      {c.name && <div className="text-xs text-muted">{c.name}</div>}
                    </td>
                    <td>{c.country || "—"}</td>
                    <td className="text-right tabular-nums">{c.orders.length}</td>
                    <td className="text-right tabular-nums">{[...byCurrency].map(([cur, v]) => formatMoney(v, cur)).join(" + ") || "—"}</td>
                    <td>
                      {last ? (
                        <Link href={`/panel/${storeId}/ventas/${last.id}`} className="underline">
                          #{last.number} · {fmtDate(last.createdAt, store.timezone, false)}
                        </Link>
                      ) : (
                        <span className="text-muted">Sin compras</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
