import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { CURRENCIES, ROUNDING_MODES, applyRounding, formatMoney, num } from "@/lib/money";
import { perUsd } from "@/lib/fx";
import { COUNTRIES } from "@/lib/geo";
import { deleteMarketAction, saveMarketAction } from "../../actions/settings";
import { ActionButton, ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, PageHeader } from "@/components/ui";

export default async function MarketsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "settings");
  const markets = await db.market.findMany({ where: { storeId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  const baseUsd = await perUsd(store.baseCurrency);
  const suggestions = Object.fromEntries(await Promise.all(CURRENCIES.map(async (c) => [c, (await perUsd(c)) / baseUsd] as const)));
  const marketForm = (m?: (typeof markets)[number]) => (
    <ActionForm action={saveMarketAction.bind(null, storeId, m?.id ?? null)} className="grid grid-cols-1 gap-3 sm:grid-cols-3" reset={!m}>
      <Field label="Nombre">
        <input name="name" required defaultValue={m?.name} className="input" placeholder="Rumania" />
      </Field>
      <Field label="Moneda">
        <select name="currency" defaultValue={m?.currency ?? "USD"} className="input">
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label={`Tipo de cambio (1 ${store.baseCurrency} = …)`} hint="Ver referencias abajo">
        <input name="rate" inputMode="decimal" required defaultValue={m ? num(m.rate) : ""} className="input" />
      </Field>
      <Field label="Países (códigos)" hint="Ej.: RO, MD" className="sm:col-span-2">
        <input name="countries" defaultValue={m?.countries.join(", ")} className="input" placeholder="RO" />
      </Field>
      <Field label="Redondeo">
        <select name="rounding" defaultValue={m?.rounding ?? "none"} className="input">
          {ROUNDING_MODES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
        <Toggle name="active" defaultChecked={m?.active ?? true} label="Activo" />
        <Toggle name="isDefault" defaultChecked={m?.isDefault ?? markets.length === 0} label="Predeterminado (si el país no coincide)" />
        <SubmitButton>{m ? "Guardar" : "Crear market"}</SubmitButton>
      </div>
    </ActionForm>
  );
  return (
    <>
      <PageHeader title="Markets y monedas" description={`Cada market cobra en su moneda a los visitantes de sus países. Los precios se convierten desde la moneda base (${store.baseCurrency}) o se fijan por producto.`} />
      <div className="space-y-3">
        {markets.map((m) => (
          <details key={m.id} className="card p-4">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
              <span>
                <b>{m.name}</b> <span className="text-sm text-muted">· {m.currency} · {m.countries.join(", ") || "sin países"}</span>
              </span>
              <span className="flex items-center gap-2 text-sm">
                10 {store.baseCurrency} → {formatMoney(applyRounding(10 * num(m.rate), m.rounding, m.currency), m.currency)}
                {m.isDefault && <Badge tone="brand">Predeterminado</Badge>}
                {!m.active && <Badge>Inactivo</Badge>}
              </span>
            </summary>
            <div className="mt-4 border-t border-line pt-4">
              {marketForm(m)}
              <div className="mt-3">
                <ActionButton action={deleteMarketAction.bind(null, storeId, m.id)} className="btn btn-danger btn-sm" confirm="¿Eliminar el market? Se borran sus precios propios.">
                  Eliminar
                </ActionButton>
              </div>
            </div>
          </details>
        ))}
      </div>
      <Card title="Nuevo market" className="mt-6">
        {marketForm()}
        <details className="mt-4 text-xs text-muted">
          <summary className="cursor-pointer">Referencias de tipo de cambio (editables en la administración)</summary>
          <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">
            {CURRENCIES.map((c) => (
              <span key={c}>
                {c}: {suggestions[c].toLocaleString("es-AR", { maximumFractionDigits: 4 })}
              </span>
            ))}
          </div>
          <div className="mt-3">Códigos de país: {COUNTRIES.map(([code, name]) => `${code} ${name}`).join(" · ")}</div>
        </details>
      </Card>
    </>
  );
}
