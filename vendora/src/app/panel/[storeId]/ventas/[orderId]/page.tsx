import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { asUtm } from "@/lib/tracking";
import { storeUrl } from "@/lib/stores";
import { approveTransferAction, markRefundedAction, refundAction, resendAccessAction, resetDownloadsAction } from "../../../actions/orders";
import { ActionButton, CopyButton } from "@/components/client";
import { Badge, Card, ORDER_STATUS, PAYMENT_STATUS, PROVIDER_LABEL, PageHeader, fmtDate } from "@/components/ui";

const KIND: Record<string, string> = { MAIN: "Principal", BUMP: "Order bump", BONUS: "Bono", UPSELL: "Upsell", DOWNSELL: "Downsell" };

export default async function OrderDetailPage({ params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  const { storeId, orderId } = await params;
  const { store } = await requireStorePage(storeId, "orders");
  const order = await db.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
      grants: { include: { product: true, downloads: { include: { file: true } } } },
      impressions: { include: { node: true }, orderBy: { shownAt: "asc" } },
      customer: true,
    },
  });
  if (!order) notFound();
  const utm = asUtm(order.utm);
  const pendingTransfer = order.payments.some((p) => p.provider === "TRANSFER" && p.status === "PENDING");
  const canRefund = order.payments.some((p) => p.status === "APPROVED");
  const commission = await db.commissionEntry.findMany({ where: { orderId } });
  const fmt = (n: unknown, c = order.currency) => formatMoney(n as number, c);

  return (
    <>
      <PageHeader
        title={`Pedido #${order.number}`}
        description={`${fmtDate(order.createdAt, store.timezone)} · ${order.email}`}
        back={{ href: `/panel/${storeId}/ventas`, label: "Ventas" }}
        actions={
          <>
            {pendingTransfer && (
              <ActionButton action={approveTransferAction.bind(null, storeId, orderId)} className="btn btn-brand btn-sm" confirm="¿Confirmás que recibiste la transferencia? Se entrega el producto.">
                Aprobar transferencia
              </ActionButton>
            )}
            {(order.status === "PAID" || order.status === "PARTIALLY_REFUNDED") && (
              <>
                <ActionButton action={resendAccessAction.bind(null, storeId, orderId)}>Reenviar accesos</ActionButton>
                <ActionButton action={resetDownloadsAction.bind(null, storeId, orderId)}>Restablecer descargas</ActionButton>
              </>
            )}
            {canRefund && (
              <>
                <ActionButton action={refundAction.bind(null, storeId, orderId)} className="btn btn-danger btn-sm" confirm="Se reembolsa por la pasarela y se desactivan los accesos. ¿Continuar?">
                  Reembolsar
                </ActionButton>
                <ActionButton action={markRefundedAction.bind(null, storeId, orderId)} className="btn btn-ghost btn-sm" confirm="Marca el pedido como reembolsado sin llamar a la pasarela (si ya lo devolviste desde ahí). ¿Continuar?">
                  Marcar reembolsado
                </ActionButton>
              </>
            )}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Productos">
            <ul className="divide-y divide-line text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted">{KIND[i.kind]}</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums">{Number(i.total) > 0 ? fmt(i.total) : "Incluido"}</div>
                    <Badge tone={i.status === "PAID" ? "ok" : i.status === "PENDING" ? "warn" : "neutral"}>{i.status === "PAID" ? "Pagado" : i.status === "PENDING" ? "Pendiente" : i.status === "REFUNDED" ? "Reembolsado" : "Fallido"}</Badge>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Descuento {order.couponCode ? `(${order.couponCode})` : ""}</span>
                  <span>-{fmt(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Cobrado</span>
                <span>{fmt(order.paidTotal)}</span>
              </div>
            </div>
          </Card>
          <Card title="Pagos">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Pasarela</th>
                    <th>Estado</th>
                    <th>Referencia</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.kind === "INITIAL" ? "Compra" : "Oferta post-compra"}</td>
                      <td>{PROVIDER_LABEL[p.provider]}</td>
                      <td>
                        <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                        {p.failureReason && <div className="text-xs text-muted">{p.failureReason}</div>}
                      </td>
                      <td className="max-w-[160px] truncate text-xs text-muted">{p.providerPaymentId || p.providerRef || "—"}</td>
                      <td className="text-right tabular-nums">
                        {fmt(p.amount, p.currency)}
                        {p.chargedCurrency && p.chargedCurrency !== p.currency && <div className="text-xs text-muted">{fmt(p.chargedAmount, p.chargedCurrency)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.transferProofUrl && (
              <a href={`/api/proof/${order.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium underline">
                Ver comprobante de transferencia
              </a>
            )}
          </Card>
          <Card title="Accesos entregados">
            {order.grants.length === 0 ? (
              <p className="text-sm text-muted">Se crean al aprobarse el pago.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {order.grants.map((g) => (
                  <li key={g.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{g.product.name}</span>
                      {g.revokedAt ? <Badge tone="bad">Desactivado</Badge> : <Badge tone="ok">Activo</Badge>}
                    </div>
                    {g.downloads.map((dl) => (
                      <div key={dl.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                        <span>
                          {dl.file.name} · {dl.count}/{dl.maxDownloads ?? "∞"} descargas · {dl.expiresAt ? `vence ${fmtDate(dl.expiresAt, store.timezone)}` : "no vence"}
                        </span>
                        <CopyButton value={storeUrl(store, `/d/${dl.token}`)} label="Copiar link" />
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {order.impressions.length > 0 && (
            <Card title="Embudo post-compra">
              <ul className="space-y-1 text-sm">
                {order.impressions.map((im) => (
                  <li key={im.id} className="flex justify-between">
                    <span>
                      {im.node.label} {im.variantKey ? `(variante ${im.variantKey})` : ""}
                    </span>
                    <span className="text-muted">
                      {im.result ? { ACCEPTED: "Aceptó", DECLINED: "Rechazó", EXPIRED: "Venció", FAILED: "Pago fallido" }[im.result] : "Vista"} · {fmt(im.price, im.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Estado">
            <Badge tone={ORDER_STATUS[order.status].tone}>{ORDER_STATUS[order.status].label}</Badge>
            {order.testMode && (
              <span className="ml-2">
                <Badge tone="warn">Pedido de prueba</Badge>
              </span>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Pagado</dt>
                <dd>{fmtDate(order.paidAt, store.timezone)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Pasarela</dt>
                <dd>{PROVIDER_LABEL[order.provider]}</dd>
              </div>
              {order.abVariant && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Variante A/B</dt>
                  <dd>{order.abVariant}</dd>
                </div>
              )}
              {commission.map((c) => (
                <div key={c.id} className="flex justify-between gap-2">
                  <dt className="text-muted">Comisión plataforma</dt>
                  <dd>{fmt(c.amount, c.currency)}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Comprador">
            <div className="text-sm">
              <div className="font-medium">{order.name || "—"}</div>
              <div className="text-muted">{order.email}</div>
              {order.phone && <div className="text-muted">{order.phone}</div>}
              {order.country && <div className="text-muted">País: {order.country}</div>}
              <Link href={`/panel/${storeId}/clientes?q=${encodeURIComponent(order.email)}`} className="mt-2 inline-block underline">
                Ver cliente
              </Link>
            </div>
          </Card>
          <Card title="Origen (UTM)">
            <dl className="space-y-1 text-sm">
              {(["source", "medium", "campaign", "content", "term"] as const).map((k) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted">utm_{k}</dt>
                  <dd className="max-w-[160px] truncate">{utm[k] || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
