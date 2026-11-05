/* Gráficos del panel (HTML puro, una serie, sin doble eje). Color de serie validado: #2a78d6. */

const SERIES = "#2a78d6";

function niceMax(v: number) {
  if (v <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Ingresos por día: barras de una sola serie; las ventas van en el tooltip (no en un segundo eje). */
export function RevenueBars({ data, format }: { data: { date: string; revenue: number; sales: number }[]; format: (n: number) => string }) {
  const max = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const short = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  const ticks = [max, max / 2, 0];
  return (
    <figure>
      <div className="relative flex h-56 gap-3">
        <div className="flex w-16 shrink-0 flex-col justify-between py-0 text-right text-[11px] text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className={`border-t ${t === 0 ? "border-line-2" : "border-dashed border-line"}`} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label="Ingresos por día">
            {data.map((d) => {
              const h = max ? (d.revenue / max) * 100 : 0;
              return (
                <div key={d.date} role="listitem" tabIndex={0} aria-label={`${short(d.date)}: ${format(d.revenue)}, ${d.sales} ventas`} className="group relative flex h-full flex-1 items-end justify-center outline-none">
                  <div className="w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${h}%`, minHeight: d.revenue > 0 ? 3 : 0, background: SERIES }} />
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-32 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-lg group-hover:block group-focus:block">
                    <div className="font-semibold">{short(d.date)}</div>
                    <div className="tabular-nums">{format(d.revenue)}</div>
                    <div className="text-muted">{d.sales} ventas</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-1.5 ml-[76px] flex justify-between text-[11px] text-muted">
        <span>{data[0] ? short(data[0].date) : ""}</span>
        <span>{data.length > 2 ? short(data[Math.floor(data.length / 2)].date) : ""}</span>
        <span>{data.length > 1 ? short(data[data.length - 1].date) : ""}</span>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted">Ver tabla</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted">
                <th className="py-1 font-medium">Día</th>
                <th className="py-1 text-right font-medium">Ingresos</th>
                <th className="py-1 text-right font-medium">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-1">{short(d.date)}</td>
                  <td className="py-1 text-right tabular-nums">{format(d.revenue)}</td>
                  <td className="py-1 text-right tabular-nums">{d.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Embudo: cada paso con su barra horizontal (relativa al primero) y la conversión desde el paso anterior. */
export function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const first = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? s.value / prev : null;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums">
                <b>{s.value.toLocaleString("es-AR")}</b>
                {rate !== null && <span className="ml-2 text-xs text-muted">{(rate * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })} % del paso anterior</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-r-[4px] bg-black/[0.04]">
              <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(s.value > 0 ? 1 : 0, (s.value / first) * 100)}%`, background: SERIES }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
