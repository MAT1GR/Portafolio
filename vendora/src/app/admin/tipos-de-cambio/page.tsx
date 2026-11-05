import { db } from "@/lib/db";
import { DEFAULT_RATES } from "@/lib/fx";
import { num } from "@/lib/money";
import { refreshRatesAction, saveRateAction } from "../actions";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client";
import { PageHeader, fmtDate } from "@/components/ui";

export default async function AdminRates() {
  const rows = await db.exchangeRate.findMany();
  const map = new Map(rows.map((r) => [r.currency, r]));
  return (
    <>
      <PageHeader
        title="Tipos de cambio"
        description="Unidades de cada moneda por 1 USD. Se usan para convertir comisiones a USD, reportes multimoneda y cobros de PayPal/Whop en otra moneda."
        actions={<ActionButton action={refreshRatesAction} className="btn btn-secondary">Actualizar desde la API</ActionButton>}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.keys(DEFAULT_RATES).map((c) => {
          const r = map.get(c);
          return (
            <ActionForm key={c} action={saveRateAction.bind(null, c)} className="card flex items-end gap-2 p-3" hideMessage>
              <label className="flex-1">
                <span className="label">
                  {c} <span className="text-xs font-normal text-muted">{r ? `${r.source} · ${fmtDate(r.updatedAt)}` : "valor de referencia"}</span>
                </span>
                <input name="perUsd" inputMode="decimal" defaultValue={r ? num(r.perUsd) : DEFAULT_RATES[c]} className="input" />
              </label>
              <SubmitButton className="btn btn-secondary btn-sm" pending="…">
                Guardar
              </SubmitButton>
            </ActionForm>
          );
        })}
      </div>
    </>
  );
}
