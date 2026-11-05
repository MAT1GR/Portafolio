import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { cartStats } from "@/lib/metrics";
import { formatMoney } from "@/lib/money";
import { getRecoverySettings } from "@/lib/store-settings";
import { getStoreOwnerPlan } from "@/lib/plans";
import { asUtm } from "@/lib/tracking";
import { dict } from "@/lib/i18n";
import { updateRecoveryAction } from "../../actions/orders";
import { ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, EmptyState, Field, Notice, PageHeader, Stat, fmtDate, pct } from "@/components/ui";

const STATUS = { OPEN: ["Abierto", "neutral"], ABANDONED: ["Abandonado", "warn"], RECOVERED: ["Recuperado", "ok"], COMPLETED: ["Comprado", "ok"] } as const;

export default async function CartsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "orders");
  const plan = await getStoreOwnerPlan(storeId);
  const settings = getRecoverySettings(store);
  const d = dict(store.language);
  const since = { from: new Date(Date.now() - 30 * 86400_000), to: new Date() };
  const stats = await cartStats([storeId], since);
  const carts = await db.checkout.findMany({
    where: { storeId, email: { not: null }, status: { in: ["OPEN", "ABANDONED", "RECOVERED"] } },
    orderBy: { emailCapturedAt: "desc" },
    take: 100,
  });
  const products = new Map((await db.product.findMany({ where: { id: { in: [...new Set(carts.map((c) => c.productId))] } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title="Carritos abandonados"
        description="Personas que dejaron su email en el checkout y no pagaron. Con la recuperación activa reciben hasta 3 emails con un link para retomar la compra."
        actions={
          <a href={`/api/export/${storeId}/carritos`} className="btn btn-secondary">
            Exportar CSV
          </a>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Abandonados (30 días)" value={stats.abandoned} />
        <Stat label="Abiertos" value={stats.open} />
        <Stat label="Recuperados" value={stats.recovered} />
        <Stat label="Tasa de recuperación" value={pct(stats.recoveryRate)} />
      </div>
      <Card title="Recuperación automática por email" className="mb-6">
        {!plan.cartRecovery && (
          <div className="mb-4">
            <Notice tone="warn">La recuperación de carritos está incluida en los planes Crecimiento y Escala. Tu plan actual: {plan.name}.</Notice>
          </div>
        )}
        <ActionForm action={updateRecoveryAction.bind(null, storeId)} className="space-y-5">
          <Toggle name="enabled" defaultChecked={settings.enabled} label="Enviar emails de recuperación" hint="Se envían en el idioma de la tienda. Podés usar {product} y {store} en los textos." />
          {settings.steps.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 rounded-2xl border border-line p-4 sm:grid-cols-4">
              <Field label={`Email ${i + 1}: horas después`}>
                <input name={`delay${i}`} type="number" min={0.25} step={0.25} defaultValue={s.delayMinutes / 60} className="input" />
              </Field>
              <Field label="Asunto" className="sm:col-span-3">
                <input name={`subject${i}`} defaultValue={s.subject} placeholder={d[`emailRecoverySubject${(i + 1) as 1 | 2 | 3}`]} className="input" />
              </Field>
              <Field label="Mensaje" className="sm:col-span-3">
                <textarea name={`body${i}`} defaultValue={s.body} rows={2} placeholder={d[`emailRecoveryBody${(i + 1) as 1 | 2 | 3}`]} className="input" />
              </Field>
              <Field label="Cupón (opcional)">
                <input name={`coupon${i}`} defaultValue={s.couponCode} className="input uppercase" placeholder="VOLVE10" />
              </Field>
            </div>
          ))}
          <SubmitButton>Guardar</SubmitButton>
        </ActionForm>
      </Card>
      {carts.length === 0 ? (
        <EmptyState title="Sin carritos todavía" description="Aparecen cuando alguien escribe su email en el checkout y no termina de pagar." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Producto</th>
                <th>Origen</th>
                <th>Estado</th>
                <th>Emails</th>
                <th className="text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {carts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.email}</div>
                    <div className="text-xs text-muted">{fmtDate(c.emailCapturedAt, store.timezone)}</div>
                  </td>
                  <td className="max-w-[200px] truncate">{products.get(c.productId) ?? "—"}</td>
                  <td className="text-xs text-muted">{asUtm(c.utm).campaign || asUtm(c.utm).source || "—"}</td>
                  <td>
                    <Badge tone={STATUS[c.status as keyof typeof STATUS][1]}>{STATUS[c.status as keyof typeof STATUS][0]}</Badge>
                  </td>
                  <td>{c.recoveryStep}/3</td>
                  <td className="text-right tabular-nums">{formatMoney(c.total, c.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
