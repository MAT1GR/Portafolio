import Link from "next/link";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { funnelStats } from "@/lib/funnel-core";
import { getStoreOwnerPlan, upsellProducts } from "@/lib/plans";
import { createFunnelAction } from "../../actions/funnels";
import { ActionForm, SubmitButton } from "@/components/client";
import { Badge, Card, Field, PageHeader, pct } from "@/components/ui";

export default async function FunnelsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  await requireStorePage(storeId, "marketing");
  const funnels = await db.funnel.findMany({ where: { storeId }, include: { nodes: true }, orderBy: [{ status: "asc" }, { priority: "desc" }] });
  const products = await db.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const plan = await getStoreOwnerPlan(storeId);
  const used = await upsellProducts(storeId);
  const stats = await Promise.all(funnels.map((f) => funnelStats(f)));
  return (
    <>
      <PageHeader title="Embudos post-compra" description={`Upsells y downsells 1-click después del pago, con ramas "si acepta / si rechaza", reserva con timer y A/B. Productos de upsell: ${used.size}/${plan.maxUpsellsPerStore} (plan ${plan.name}).`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {funnels.length === 0 && <p className="card p-6 text-sm text-muted">Todavía no hay embudos. Creá uno y agregale la primera oferta.</p>}
          {funnels.map((f, i) => {
            const overall = stats[i].filter((s) => s.variant === null);
            const views = overall.reduce((a, s) => a + s.views, 0);
            const accepted = overall.reduce((a, s) => a + s.accepted, 0);
            const revenue = overall.reduce((a, s) => a + s.revenue, 0);
            return (
              <Link key={f.id} href={`/panel/${storeId}/embudos/${f.id}`} className="card block p-5 hover:border-ink/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{f.name}</div>
                  <div className="flex gap-1">
                    {f.status === "ACTIVE" ? <Badge tone="ok">Activo</Badge> : <Badge tone="warn">Pausado</Badge>}
                    <Badge>{f.trigger === "ALWAYS" ? "Disparar siempre" : `${f.triggerProductIds.length} producto(s)`}</Badge>
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted">
                  {f.nodes.length} oferta(s) · reserva {f.reservationMinutes} min · {views} vistas · {accepted} aceptadas ({pct(views ? accepted / views : 0)}) · {revenue.toFixed(2)} facturado
                </div>
              </Link>
            );
          })}
        </div>
        <Card title="Nuevo embudo">
          <ActionForm action={createFunnelAction.bind(null, storeId)} className="grid gap-3">
            <Field label="Nombre">
              <input name="name" required className="input" placeholder="Post-compra principal" />
            </Field>
            <Field label="Disparador">
              <select name="trigger" className="input">
                <option value="ALWAYS">Disparar siempre</option>
                <option value="PRODUCTS">Solo si compran estos productos</option>
              </select>
            </Field>
            <Field label="Productos que lo disparan">
              <select name="triggerProductIds" multiple className="input h-24">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reserva de la oferta (minutos)">
              <input name="reservationMinutes" type="number" min={1} defaultValue={10} className="input" />
            </Field>
            <Field label="Cuando vence el timer">
              <select name="onTimerExpire" className="input">
                <option value="NEXT_OFFER">Pasar a la siguiente oferta (rama rechazo)</option>
                <option value="THANK_YOU">Ir a la página de gracias</option>
              </select>
            </Field>
            <SubmitButton>Crear embudo</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
