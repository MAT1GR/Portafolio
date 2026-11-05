import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { asUtm } from "@/lib/tracking";
import { Badge, EmptyState, ORDER_STATUS, PROVIDER_LABEL, PageHeader, fmtDate } from "@/components/ui";

type Props = { params: Promise<{ storeId: string }>; searchParams: Promise<Record<string, string | undefined>> };
const PAGE = 30;

export default async function OrdersPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { store } = await requireStorePage(storeId, "orders");
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where: Prisma.OrderWhereInput = { storeId };
  if (sp.estado && sp.estado in ORDER_STATUS) where.status = sp.estado as never;
  if (sp.pasarela && sp.pasarela in PROVIDER_LABEL) where.provider = sp.pasarela as never;
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, ...(Number(q) ? [{ number: Number(q) }] : [])];
  }
  if (sp.desde) where.createdAt = { ...(where.createdAt as object), gte: new Date(`${sp.desde}T00:00:00`) };
  if (sp.hasta) where.createdAt = { ...(where.createdAt as object), lte: new Date(`${sp.hasta}T23:59:59`) };
  if (sp.prueba !== "1") where.testMode = false;
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { items: { where: { kind: { not: "BONUS" } } } } }),
    db.order.count({ where }),
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "pagina") as [string, string][]);
  return (
    <>
      <PageHeader
        title="Ventas"
        description={`${total} pedido(s)`}
        actions={
          <a href={`/api/export/${storeId}/ventas?${query}`} className="btn btn-secondary">
            Exportar CSV
          </a>
        }
      />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="Email, nombre o N° de pedido" className="input sm:col-span-2" />
        <select name="estado" defaultValue={sp.estado ?? ""} className="input">
          <option value="">Todos los estados</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select name="pasarela" defaultValue={sp.pasarela ?? ""} className="input">
          <option value="">Todas las pasarelas</option>
          {Object.entries(PROVIDER_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input type="date" name="desde" defaultValue={sp.desde} className="input" aria-label="Desde" />
        <input type="date" name="hasta" defaultValue={sp.hasta} className="input" aria-label="Hasta" />
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" name="prueba" value="1" defaultChecked={sp.prueba === "1"} /> Incluir pedidos de prueba
        </label>
        <button className="btn btn-primary sm:col-span-2">Filtrar</button>
      </form>
      {orders.length === 0 ? (
        <EmptyState title="No hay ventas con estos filtros" description="Cuando alguien compre, vas a ver el pedido acá con su estado de pago, la campaña de origen y los accesos entregados." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Comprador</th>
                <th>Productos</th>
                <th>Origen</th>
                <th>Pasarela</th>
                <th>Estado</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const utm = asUtm(o.utm);
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/panel/${storeId}/ventas/${o.id}`} className="font-semibold hover:underline">
                        #{o.number}
                      </Link>
                      <div className="text-xs text-muted">{fmtDate(o.createdAt, store.timezone)}</div>
                    </td>
                    <td>
                      <div className="max-w-[200px] truncate">{o.email}</div>
                      {o.name && <div className="text-xs text-muted">{o.name}</div>}
                    </td>
                    <td className="max-w-[240px] text-xs">{o.items.map((i) => (i.kind === "MAIN" ? i.name : `+ ${i.name}`)).join(" · ")}</td>
                    <td className="text-xs text-muted">{utm.campaign || utm.source || "—"}</td>
                    <td className="text-xs">{PROVIDER_LABEL[o.provider]}{o.testMode && <Badge tone="warn">prueba</Badge>}</td>
                    <td>
                      <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                    </td>
                    <td className="text-right font-semibold tabular-nums">{formatMoney(o.status === "PENDING" || o.status === "FAILED" ? o.total : o.paidTotal, o.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE && (
        <div className="mt-4 flex justify-between text-sm">
          {page > 1 ? <Link href={`?${query}&pagina=${page - 1}`} className="btn btn-secondary btn-sm">← Anteriores</Link> : <span />}
          {page * PAGE < total && <Link href={`?${query}&pagina=${page + 1}`} className="btn btn-secondary btn-sm">Siguientes →</Link>}
        </div>
      )}
    </>
  );
}
