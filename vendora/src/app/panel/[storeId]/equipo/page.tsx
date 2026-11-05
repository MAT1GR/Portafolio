import Link from "next/link";
import { requireStorePage, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreOwnerPlan } from "@/lib/plans";
import { changeRoleAction, inviteMemberAction, removeMemberAction, revokeInviteAction } from "../../actions/settings";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { Badge, Card, Field, Notice, PageHeader, fmtDate } from "@/components/ui";

const PERM_LABEL: Record<string, string> = { metrics: "métricas", orders: "ventas y clientes", products: "productos", content: "contenido", marketing: "checkout, embudos y marketing", payments: "pagos", settings: "configuración", team: "equipo" };

export default async function TeamPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "team");
  const plan = await getStoreOwnerPlan(storeId);
  const [members, invites] = await Promise.all([
    db.storeMember.findMany({ where: { storeId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.storeInvitation.findMany({ where: { storeId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const roles = (["ADMIN", "EDITOR", "SUPPORT", "ANALYST"] as const).map((r) => (
    <option key={r} value={r}>
      {ROLE_LABELS[r]}
    </option>
  ));
  return (
    <>
      <PageHeader title="Equipo" description="Invitá personas a operar esta tienda con permisos según su rol." />
      {!plan.teamRoles && (
        <div className="mb-6">
          <Notice tone="warn" title="Disponible en el plan Escala">
            Tu plan {plan.name} no incluye equipo. <Link href="/panel/plan" className="underline">Mejorá tu plan</Link> para invitar personas.
          </Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Personas con acceso" className="lg:col-span-2">
          <ul className="divide-y divide-line">
            <li className="flex items-center justify-between py-3 text-sm">
              <span>
                <b>{store.owner.name}</b> <span className="text-muted">{store.owner.email}</span>
              </span>
              <Badge tone="brand">Dueño</Badge>
            </li>
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <b>{m.user.name}</b> <span className="text-muted">{m.user.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <ActionForm action={changeRoleAction.bind(null, storeId, m.id)} className="flex items-center gap-2" hideMessage>
                    <select name="role" defaultValue={m.role} className="input py-1.5">
                      {roles}
                    </select>
                    <SubmitButton className="btn btn-ghost btn-sm" pending="…">
                      Cambiar
                    </SubmitButton>
                  </ActionForm>
                  <ActionButton action={removeMemberAction.bind(null, storeId, m.id)} className="btn btn-ghost btn-sm text-bad" confirm="¿Quitar a esta persona?">
                    Quitar
                  </ActionButton>
                </span>
              </li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {i.email} <Badge tone="warn">Invitación pendiente · {ROLE_LABELS[i.role]}</Badge>
                  <span className="ml-2 text-xs text-muted">vence {fmtDate(i.expiresAt, store.timezone, false)}</span>
                </span>
                <ActionButton action={revokeInviteAction.bind(null, storeId, i.id)} className="btn btn-ghost btn-sm">
                  Cancelar
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title="Invitar">
            <ActionForm action={inviteMemberAction.bind(null, storeId)} className="grid gap-3" reset>
              <Field label="Email">
                <input name="email" type="email" required className="input" />
              </Field>
              <Field label="Rol">
                <select name="role" className="input">
                  {roles}
                </select>
              </Field>
              <SubmitButton>Enviar invitación</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Qué puede hacer cada rol">
            <ul className="space-y-2 text-xs">
              {(["ADMIN", "EDITOR", "SUPPORT", "ANALYST"] as const).map((r) => (
                <li key={r}>
                  <b>{ROLE_LABELS[r]}:</b> {ROLE_PERMISSIONS[r].filter((p) => p in PERM_LABEL).map((p) => PERM_LABEL[p]).join(", ")}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
