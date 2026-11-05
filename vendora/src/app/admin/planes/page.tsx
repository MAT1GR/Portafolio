import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { savePlanAction } from "../actions";
import { ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Field, PageHeader } from "@/components/ui";

export default async function AdminPlans() {
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { users: true } } } });
  return (
    <>
      <PageHeader title="Planes" description="Precios, límites y comisión. Los cambios aplican de inmediato a todas las cuentas del plan." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="mb-3 text-sm text-muted">
              Clave <code>{p.key}</code> · {p._count.users} cuenta(s)
            </div>
            <ActionForm action={savePlanAction.bind(null, p.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Nombre">
                <input name="name" defaultValue={p.name} className="input" />
              </Field>
              <Field label="Precio USD/mes">
                <input name="priceUsd" inputMode="decimal" defaultValue={num(p.priceUsd)} className="input" />
              </Field>
              <Field label="Comisión %">
                <input name="commissionPct" inputMode="decimal" defaultValue={p.commissionBps / 100} className="input" />
              </Field>
              <Field label="Tiendas">
                <input name="maxStores" type="number" defaultValue={p.maxStores} className="input" />
              </Field>
              <Field label="Ebooks IA/mes (vacío = ∞)">
                <input name="aiEbooksPerMonth" type="number" defaultValue={p.aiEbooksPerMonth ?? ""} className="input" />
              </Field>
              <Field label="Días de prueba">
                <input name="trialDays" type="number" defaultValue={p.trialDays} className="input" />
              </Field>
              <Field label="Bonos por tienda">
                <input name="maxBonusesPerStore" type="number" defaultValue={p.maxBonusesPerStore} className="input" />
              </Field>
              <Field label="Upsells por tienda">
                <input name="maxUpsellsPerStore" type="number" defaultValue={p.maxUpsellsPerStore} className="input" />
              </Field>
              <Field label="Orden">
                <input name="sortOrder" type="number" defaultValue={p.sortOrder} className="input" />
              </Field>
              <Field label="Descripción" className="sm:col-span-3">
                <input name="description" defaultValue={p.description} className="input" />
              </Field>
              <div className="flex flex-wrap gap-4 sm:col-span-3">
                <Toggle name="cartRecovery" defaultChecked={p.cartRecovery} label="Recuperación de carritos" />
                <Toggle name="teamRoles" defaultChecked={p.teamRoles} label="Equipo con roles" />
                <Toggle name="active" defaultChecked={p.active} label="Disponible" />
              </div>
              <div className="sm:col-span-3">
                <SubmitButton>Guardar</SubmitButton>
              </div>
            </ActionForm>
          </div>
        ))}
      </div>
    </>
  );
}
