import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { deleteCouponAction, saveCouponAction } from "../../../actions/marketing";
import { ActionButton, ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, PageHeader, fmtDate } from "@/components/ui";

export default async function CouponsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "marketing");
  const [coupons, products] = await Promise.all([
    db.coupon.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } }),
    db.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const local = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
  const couponForm = (c?: (typeof coupons)[number]) => (
    <ActionForm action={saveCouponAction.bind(null, storeId, c?.id ?? null)} className="grid grid-cols-1 gap-3 sm:grid-cols-3" reset={!c}>
      <Field label="Código">
        <input name="code" required defaultValue={c?.code} className="input uppercase" placeholder="BIENVENIDA10" />
      </Field>
      <Field label="Tipo">
        <select name="type" defaultValue={c?.type ?? "PERCENT"} className="input">
          <option value="PERCENT">Porcentaje</option>
          <option value="FIXED">Monto fijo ({store.baseCurrency})</option>
        </select>
      </Field>
      <Field label="Valor">
        <input name="value" required inputMode="decimal" defaultValue={c ? num(c.value) : ""} className="input" />
      </Field>
      <Field label="Desde (opcional)">
        <input name="startsAt" type="datetime-local" defaultValue={local(c?.startsAt ?? null)} className="input" />
      </Field>
      <Field label="Hasta (opcional)">
        <input name="endsAt" type="datetime-local" defaultValue={local(c?.endsAt ?? null)} className="input" />
      </Field>
      <Field label="Usos máximos (opcional)">
        <input name="maxUses" type="number" min={1} defaultValue={c?.maxUses ?? ""} className="input" />
      </Field>
      <Field label="Productos (vacío = todos)" className="sm:col-span-2">
        <select name="productIds" multiple defaultValue={c?.productIds ?? []} className="input h-24">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <Toggle name="active" defaultChecked={c?.active ?? true} label="Activo" />
      </div>
      <div className="sm:col-span-3">
        <SubmitButton>{c ? "Guardar" : "Crear cupón"}</SubmitButton>
      </div>
    </ActionForm>
  );
  return (
    <>
      <PageHeader title="Cupones" description="Descuentos sobre el producto principal del checkout. También se pueden usar en los emails de recuperación de carritos." />
      <Card title="Nuevo cupón" className="mb-6">
        {couponForm()}
      </Card>
      <div className="space-y-3">
        {coupons.map((c) => (
          <details key={c.id} className="card p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-semibold">{c.code}</span>
              <span className="flex items-center gap-2 text-sm">
                {c.type === "PERCENT" ? `${num(c.value)} %` : `${num(c.value)} ${store.baseCurrency}`} · usado {c.usedCount}
                {c.maxUses ? `/${c.maxUses}` : ""} {c.endsAt && `· hasta ${fmtDate(c.endsAt, store.timezone)}`}
                {c.active ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}
              </span>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              {couponForm(c)}
              <div className="mt-3">
                <ActionButton action={deleteCouponAction.bind(null, storeId, c.id)} className="btn btn-danger btn-sm" confirm="¿Eliminar el cupón?">
                  Eliminar
                </ActionButton>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
