import { db } from "@/lib/db";
import { storeBaseUrl } from "@/lib/stores";
import { toggleStoreStatusAction } from "../actions";
import { ActionButton } from "@/components/client";
import { Badge, PageHeader, fmtDate } from "@/components/ui";

export default async function AdminStores({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const stores = await db.store.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] } : {},
    include: { owner: true, _count: { select: { orders: { where: { status: "PAID", testMode: false } }, products: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Tiendas" />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar" className="input max-w-sm" />
        <button className="btn btn-primary">Buscar</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Dueño</th>
              <th>Productos</th>
              <th>Ventas</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={storeBaseUrl(s)} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {s.name}
                  </a>
                  <div className="text-xs text-muted">
                    {s.slug} · {fmtDate(s.createdAt, undefined, false)}
                  </div>
                </td>
                <td className="text-xs">{s.owner.email}</td>
                <td>{s._count.products}</td>
                <td>{s._count.orders}</td>
                <td>
                  <Badge tone={s.status === "ACTIVE" ? "ok" : "bad"}>{s.status === "ACTIVE" ? "Activa" : `Suspendida${s.suspendedReason ? ` (${s.suspendedReason})` : ""}`}</Badge>
                </td>
                <td>
                  <ActionButton action={toggleStoreStatusAction.bind(null, s.id)} confirm="¿Cambiar el estado de la tienda?">
                    {s.status === "ACTIVE" ? "Suspender" : "Reactivar"}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
