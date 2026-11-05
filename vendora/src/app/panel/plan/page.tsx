import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { aiEbooksUsed, planFeatures, ownedStoreCount } from "@/lib/plans";
import { inTrial, platformPaymentMethods } from "@/lib/billing";
import { changePlanAction, payInvoiceAction } from "../actions/account";
import { ActionButton } from "@/components/client";
import { Badge, Card, Notice, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Plan y facturación" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const user = await requireUser();
  const { pago } = await searchParams;
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const invoices = await db.platformInvoice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 24 });
  const pending = await db.commissionEntry.aggregate({ where: { userId: user.id, status: "PENDING" }, _sum: { amountUsd: true } });
  const stores = await ownedStoreCount(user.id);
  const ebooks = await aiEbooksUsed(user.id);
  const methods = platformPaymentMethods();
  return (
    <>
      <PageHeader
        title="Plan y facturación"
        description={`Plan actual: ${user.plan.name}${inTrial(user) ? ` · prueba gratis hasta el ${fmtDate(user.trialEndsAt, undefined, false)}` : ""}. Próximo cierre: ${fmtDate(user.nextBillingAt, undefined, false)}.`}
      />
      {pago === "ok" && (
        <div className="mb-5">
          <Notice tone="ok">¡Gracias! Cuando la pasarela confirme el pago, la factura se marca como pagada.</Notice>
        </div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4 text-sm">
          <div className="text-muted">Tiendas</div>
          <b className="text-xl">
            {stores}/{user.plan.maxStores}
          </b>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">Ebooks con IA este mes</div>
          <b className="text-xl">
            {ebooks}/{user.plan.aiEbooksPerMonth ?? "∞"}
          </b>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">Comisión por venta</div>
          <b className="text-xl">{(user.plan.commissionBps / 100).toLocaleString("es-AR")} %</b>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-muted">Comisiones a facturar</div>
          <b className="text-xl">USD {num(pending._sum.amountUsd).toFixed(2)}</b>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const current = p.id === user.planId;
          const price = num(p.priceUsd);
          return (
            <div key={p.id} className={`card flex flex-col p-5 ${current ? "ring-2 ring-ink" : ""}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{p.name}</h2>
                {current && <Badge tone="brand">Actual</Badge>}
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold">
                {price ? `USD ${price}` : "Gratis"}
                {price ? <span className="text-sm font-normal text-muted">/mes</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted">{p.description}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {planFeatures(p).map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              {!current && (
                <div className="mt-5">
                  <ActionButton action={changePlanAction.bind(null, p.key)} className="btn btn-primary w-full" confirm={price && !user.trialUsed && p.trialDays ? `Empezás con ${p.trialDays} días gratis. ¿Continuar?` : `¿Cambiar al plan ${p.name}?`}>
                    {price && !user.trialUsed && p.trialDays ? `Probar ${p.trialDays} días gratis` : `Cambiar a ${p.name}`}
                  </ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Card title="Facturas" className="mt-6" description="Cada mes se factura el abono (fuera del período de prueba) más las comisiones por ventas con Mercado Pago, Stripe y Whop.">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay facturas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Período</th>
                  <th className="text-right">Abono</th>
                  <th className="text-right">Comisiones</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="font-semibold">#{i.number}</td>
                    <td className="text-xs">
                      {fmtDate(i.periodStart, undefined, false)} – {fmtDate(i.periodEnd, undefined, false)}
                    </td>
                    <td className="text-right tabular-nums">USD {num(i.planAmountUsd).toFixed(2)}</td>
                    <td className="text-right tabular-nums">USD {num(i.commissionsUsd).toFixed(2)}</td>
                    <td className="text-right font-semibold tabular-nums">USD {num(i.totalUsd).toFixed(2)}</td>
                    <td>
                      <Badge tone={i.status === "PAID" ? "ok" : i.status === "OVERDUE" ? "bad" : i.status === "OPEN" ? "warn" : "neutral"}>
                        {{ PAID: "Pagada", OPEN: `Vence ${fmtDate(i.dueAt, undefined, false)}`, OVERDUE: "Vencida", VOID: "Anulada" }[i.status]}
                      </Badge>
                    </td>
                    <td>
                      {(i.status === "OPEN" || i.status === "OVERDUE") && (
                        <div className="flex gap-1">
                          {methods.stripe && (
                            <ActionButton action={payInvoiceAction.bind(null, i.id, "stripe")} className="btn btn-brand btn-sm">
                              Pagar con tarjeta
                            </ActionButton>
                          )}
                          {methods.mercadopago && (
                            <ActionButton action={payInvoiceAction.bind(null, i.id, "mercadopago")} className="btn btn-secondary btn-sm">
                              Mercado Pago
                            </ActionButton>
                          )}
                          {!methods.stripe && !methods.mercadopago && <span className="text-xs text-muted">Coordiná el pago con soporte</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
