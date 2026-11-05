import { db } from "@/lib/db";
import { setUserPlanAction, toggleAdminAction, toggleUserStatusAction } from "../actions";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { Badge, PageHeader, fmtDate } from "@/components/ui";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [users, plans] = await Promise.all([
    db.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
      include: { plan: true, _count: { select: { ownedStores: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Usuarios" />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar" className="input max-w-sm" />
        <button className="btn btn-primary">Buscar</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Plan</th>
              <th>Tiendas</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted">
                    {u.email} · alta {fmtDate(u.createdAt, undefined, false)}
                  </div>
                </td>
                <td>
                  <ActionForm action={setUserPlanAction.bind(null, u.id)} className="flex items-center gap-1" hideMessage>
                    <select name="planKey" defaultValue={u.plan.key} className="input py-1">
                      {plans.map((p) => (
                        <option key={p.id} value={p.key}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="btn btn-ghost btn-sm" pending="…">
                      OK
                    </SubmitButton>
                  </ActionForm>
                  {u.trialEndsAt && u.trialEndsAt > new Date() && <div className="text-xs text-muted">prueba hasta {fmtDate(u.trialEndsAt, undefined, false)}</div>}
                </td>
                <td>{u._count.ownedStores}</td>
                <td className="space-x-1">
                  <Badge tone={u.status === "ACTIVE" ? "ok" : "bad"}>{u.status === "ACTIVE" ? "Activo" : "Suspendido"}</Badge>
                  {u.platformRole === "SUPERADMIN" && <Badge tone="brand">Admin</Badge>}
                </td>
                <td className="space-x-1">
                  <ActionButton action={toggleUserStatusAction.bind(null, u.id)} confirm="¿Cambiar el estado de la cuenta?">
                    {u.status === "ACTIVE" ? "Suspender" : "Reactivar"}
                  </ActionButton>
                  <ActionButton action={toggleAdminAction.bind(null, u.id)} className="btn btn-ghost btn-sm" confirm="¿Cambiar el rol de administrador?">
                    {u.platformRole === "SUPERADMIN" ? "Quitar admin" : "Hacer admin"}
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
