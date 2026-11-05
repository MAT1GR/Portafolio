import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { markInvoicePaidAction, runBillingAction, voidInvoiceAction } from "../actions";
import { ActionButton } from "@/components/client";
import { Badge, PageHeader, fmtDate } from "@/components/ui";

export default async function AdminInvoices() {
  const invoices = await db.platformInvoice.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <>
      <PageHeader title="Facturas" description="Abono mensual + comisiones por venta de cada cuenta." actions={<ActionButton action={runBillingAction} className="btn btn-secondary">Ejecutar facturación ahora</ActionButton>} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Cuenta</th>
              <th>Período</th>
              <th className="text-right">Total</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="font-semibold">{i.number}</td>
                <td className="text-xs">
                  {i.user.email}
                  <div className="text-muted">plan {i.planKey}</div>
                </td>
                <td className="text-xs">
                  {fmtDate(i.periodStart, undefined, false)} – {fmtDate(i.periodEnd, undefined, false)}
                </td>
                <td className="text-right tabular-nums">
                  USD {num(i.totalUsd).toFixed(2)}
                  <div className="text-xs text-muted">
                    abono {num(i.planAmountUsd).toFixed(2)} · com. {num(i.commissionsUsd).toFixed(2)}
                  </div>
                </td>
                <td>
                  <Badge tone={i.status === "PAID" ? "ok" : i.status === "OVERDUE" ? "bad" : i.status === "OPEN" ? "warn" : "neutral"}>{i.status}</Badge>
                  {i.paidAt && <div className="text-xs text-muted">{i.provider} · {fmtDate(i.paidAt)}</div>}
                </td>
                <td className="space-x-1">
                  {(i.status === "OPEN" || i.status === "OVERDUE") && (
                    <>
                      <ActionButton action={markInvoicePaidAction.bind(null, i.id)} confirm="¿Marcar como pagada (pago manual)?">
                        Marcar pagada
                      </ActionButton>
                      <ActionButton action={voidInvoiceAction.bind(null, i.id)} className="btn btn-ghost btn-sm" confirm="¿Anular la factura?">
                        Anular
                      </ActionButton>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
