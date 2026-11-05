import { notFound } from "next/navigation";
import type { FunnelNode, FunnelNodeVariant, Product } from "@prisma/client";
import { requireStorePage, getUserStores, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { abWinner, funnelStats, nodePrice, type NodeStats } from "@/lib/funnel-core";
import { formatMoney, num } from "@/lib/money";
import { getThankYouSettings } from "@/lib/store-settings";
import {
  applyWinnerAction, deleteFunnelAction, deleteNodeAction, duplicateFunnelAction, resetFunnelStatsAction, saveNodeAction, saveVariantsAction, toggleFunnelAction, updateFunnelAction,
} from "../../../actions/funnels";
import { ActionButton, ActionForm, ImageInput, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, Notice, PageHeader, fmtDate, pct } from "@/components/ui";

type NodeFull = FunnelNode & { product: Product & { marketPrices: never[] }; variants: FunnelNodeVariant[] };

export default async function FunnelBuilderPage({ params }: { params: Promise<{ storeId: string; funnelId: string }> }) {
  const { storeId, funnelId } = await params;
  const { store, user } = await requireStorePage(storeId, "marketing");
  const funnel = await db.funnel.findFirst({
    where: { id: funnelId, storeId },
    include: { nodes: { include: { product: { include: { marketPrices: true } }, variants: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!funnel) notFound();
  const products = await db.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  const stats = await funnelStats(funnel);
  const stores = (await getUserStores(user.id)).filter((s) => can(s.role, "marketing"));
  const ty = getThankYouSettings(store, funnel.thankYouOverride);
  const byId = new Map(funnel.nodes.map((n) => [n.id, n]));
  const fmt = (n: number) => formatMoney(n, store.baseCurrency);
  const statOf = (id: string, v: string | null = null) => stats.find((s) => s.nodeId === id && s.variant === v);

  const reachable = new Set<string>();
  const walk = (id: string | null | undefined) => {
    if (!id || reachable.has(id) || !byId.has(id)) return;
    reachable.add(id);
    walk(byId.get(id)!.acceptNextId);
    walk(byId.get(id)!.declineNextId);
  };
  walk(funnel.entryNodeId);

  const nodeOptions = (exclude?: string) => (
    <>
      <option value="">Terminar → página de gracias</option>
      {funnel.nodes
        .filter((n) => n.id !== exclude)
        .map((n) => (
          <option key={n.id} value={n.id}>
            {n.label} · {n.product.name}
          </option>
        ))}
    </>
  );

  const nodeForm = (n?: (typeof funnel.nodes)[number]) => (
    <ActionForm action={saveNodeAction.bind(null, storeId, funnelId, n?.id ?? null)} className="grid grid-cols-1 gap-3 sm:grid-cols-2" reset={!n}>
      <Field label="Nombre interno">
        <input name="label" required defaultValue={n?.label ?? `UpSell ${funnel.nodes.filter((x) => x.type === "UPSELL").length + 1}`} className="input" />
      </Field>
      <Field label="Tipo">
        <select name="type" defaultValue={n?.type ?? "UPSELL"} className="input">
          <option value="UPSELL">Upsell</option>
          <option value="DOWNSELL">Downsell</option>
        </select>
      </Field>
      <Field label="Producto ofrecido" className="sm:col-span-2">
        <select name="productId" required defaultValue={n?.productId ?? ""} className="input">
          <option value="">Elegí un producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {fmt(num(p.price))}
              {p.compareAtPrice ? ` (tachado ${fmt(num(p.compareAtPrice))})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Precio">
        <select name="pricingMode" defaultValue={n?.pricingMode ?? "DISCOUNT"} className="input">
          <option value="DISCOUNT">% de descuento</option>
          <option value="FIXED">Precio fijo (moneda base)</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Descuento %">
          <input name="discountPercent" type="number" min={0} max={100} defaultValue={n?.discountPercent ?? 0} className="input" />
        </Field>
        <Field label="Precio fijo">
          <input name="fixedPrice" inputMode="decimal" defaultValue={n?.fixedPrice ? num(n.fixedPrice) : ""} className="input" />
        </Field>
      </div>
      <Field label="Comparar contra" hint="Precio de tienda = precio de venta. Elegí tachado solo si querés descontar sobre el precio tachado.">
        <select name="compareAgainst" defaultValue={n?.compareAgainst ?? "STORE_PRICE"} className="input">
          <option value="STORE_PRICE">Precio de tienda</option>
          <option value="COMPARE_AT">Precio tachado</option>
        </select>
      </Field>
      <Field label="Contenido">
        <select name="contentMode" defaultValue={n?.contentMode ?? "TEMPLATE"} className="input">
          <option value="TEMPLATE">Plantilla</option>
          <option value="CUSTOM_HTML">HTML propio</option>
        </select>
      </Field>
      <Field label="Título" hint="Variables: {price} {compare_price} {product} {email}" className="sm:col-span-2">
        <input name="title" defaultValue={n?.title ?? ""} className="input" placeholder="¡Esperá! Tu pedido todavía no está completo" />
      </Field>
      <Field label="Subtítulo" className="sm:col-span-2">
        <input name="subtitle" defaultValue={n?.subtitle ?? ""} className="input" />
      </Field>
      <Field label="Texto de la oferta" className="sm:col-span-2">
        <textarea name="body" defaultValue={n?.body ?? ""} rows={4} className="input" />
      </Field>
      <Field label="Botón aceptar" hint="Ej.: SÍ, LO QUIERO POR {price}">
        <input name="acceptText" defaultValue={n?.acceptText ?? ""} className="input" />
      </Field>
      <Field label="Botón rechazar">
        <input name="declineText" defaultValue={n?.declineText ?? ""} className="input" placeholder="No, gracias" />
      </Field>
      <Field label="Texto del timer" hint="Usá {timer}. Ej.: Oferta reservada para vos: {timer}">
        <input name="timerText" defaultValue={n?.timerText ?? ""} className="input" />
      </Field>
      <Field label="Video (opcional)">
        <input name="videoUrl" defaultValue={n?.videoUrl ?? ""} className="input" placeholder="YouTube, Vimeo o .mp4" />
      </Field>
      <div className="sm:col-span-2">
        <ImageInput storeId={storeId} name="imageUrl" defaultValue={n?.imageUrl} label="Imagen (vacío = tapa del producto)" />
      </div>
      <Field label="Si acepta, mostrar">
        <select name="acceptNextId" defaultValue={n?.acceptNextId ?? ""} className="input">
          {nodeOptions(n?.id)}
        </select>
      </Field>
      <Field label="Si rechaza, mostrar">
        <select name="declineNextId" defaultValue={n?.declineNextId ?? ""} className="input">
          {nodeOptions(n?.id)}
        </select>
      </Field>
      <Field label="HTML propio" hint="Tokens: {{accept_url}} {{decline_url}} {{price}} {{compare_price}} {{timer}} {{product_name}} {{email}}" className="sm:col-span-2">
        <textarea name="customHtml" defaultValue={n?.customHtml ?? ""} rows={6} className="input font-mono text-xs" />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Toggle name="isEntry" defaultChecked={n ? funnel.entryNodeId === n.id : !funnel.entryNodeId} label="Es la primera oferta del embudo" />
        <SubmitButton>{n ? "Guardar oferta" : "Agregar oferta"}</SubmitButton>
      </div>
    </ActionForm>
  );

  const Tree = ({ id, depth, seen }: { id: string | null; depth: number; seen: Set<string> }) => {
    if (!id) return <div className="rounded-xl border border-dashed border-line-2 px-3 py-2 text-xs text-muted">Página de gracias</div>;
    const n = byId.get(id);
    if (!n) return null;
    if (seen.has(id) || depth > 8) return <div className="rounded-xl bg-black/5 px-3 py-2 text-xs">↺ vuelve a {n.label}</div>;
    const next = new Set(seen).add(id);
    const s = statOf(n.id);
    const price = nodePrice(n as unknown as NodeFull, null, null, store.baseCurrency);
    return (
      <div>
        <a href={`#node-${n.id}`} className="block rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-sm hover:border-ink/40">
          <div className="flex items-center justify-between gap-2">
            <b>{n.label}</b>
            <Badge tone={n.type === "UPSELL" ? "brand" : "mint"}>{n.type === "UPSELL" ? "Upsell" : "Downsell"}</Badge>
          </div>
          <div className="text-xs text-muted">
            {n.product.name} · {fmt(price.price)}
            {n.abTestActive ? " · A/B" : ""}
          </div>
          <div className="text-xs">
            {s ? `${s.views} vistas · ${pct(s.rate)} · ${fmt(s.perView)}/vista` : "sin vistas"}
          </div>
        </a>
        <div className="mt-2 ml-4 grid grid-cols-1 gap-2 border-l-2 border-line pl-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-semibold text-ok">Si acepta</div>
            <Tree id={n.acceptNextId} depth={depth + 1} seen={next} />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-bad">Si rechaza</div>
            <Tree id={n.declineNextId} depth={depth + 1} seen={next} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title={funnel.name}
        back={{ href: `/panel/${storeId}/embudos`, label: "Embudos" }}
        description={funnel.statsResetAt ? `Estadísticas desde el ${fmtDate(funnel.statsResetAt, store.timezone)}` : "Estadísticas de todo el historial"}
        actions={
          <>
            <ActionButton action={toggleFunnelAction.bind(null, storeId, funnelId)} className={funnel.status === "ACTIVE" ? "btn btn-secondary btn-sm" : "btn btn-brand btn-sm"}>
              {funnel.status === "ACTIVE" ? "Pausar" : "Activar"}
            </ActionButton>
            <ActionButton action={resetFunnelStatsAction.bind(null, storeId, funnelId)} confirm="Reinicia vistas y conversiones de las ofertas (no borra ventas). ¿Continuar?">
              Reiniciar estadísticas
            </ActionButton>
            <ActionButton action={deleteFunnelAction.bind(null, storeId, funnelId)} className="btn btn-danger btn-sm" confirm="¿Eliminar el embudo?">
              Eliminar
            </ActionButton>
          </>
        }
      />
      {funnel.status === "PAUSED" && (
        <div className="mb-5">
          <Notice tone="warn">El embudo está pausado: los compradores van directo a la página de gracias. Probalo con una compra de prueba antes de activarlo.</Notice>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card title="Recorrido" className="lg:col-span-3">
          {funnel.entryNodeId ? <Tree id={funnel.entryNodeId} depth={0} seen={new Set()} /> : <p className="text-sm text-muted">Agregá la primera oferta.</p>}
          {funnel.nodes.some((n) => !reachable.has(n.id)) && (
            <div className="mt-4 text-xs text-muted">Sin conectar: {funnel.nodes.filter((n) => !reachable.has(n.id)).map((n) => n.label).join(", ")}</div>
          )}
        </Card>
        <Card title="Configuración" className="lg:col-span-2">
          <ActionForm action={updateFunnelAction.bind(null, storeId, funnelId)} className="grid gap-3">
            <Field label="Nombre">
              <input name="name" defaultValue={funnel.name} className="input" />
            </Field>
            <Field label="Disparador">
              <select name="trigger" defaultValue={funnel.trigger} className="input">
                <option value="ALWAYS">Disparar siempre</option>
                <option value="PRODUCTS">Solo con estos productos</option>
              </select>
            </Field>
            <select name="triggerProductIds" multiple defaultValue={funnel.triggerProductIds} className="input h-20" aria-label="Productos disparadores">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Reserva (min)">
                <input name="reservationMinutes" type="number" min={1} defaultValue={funnel.reservationMinutes} className="input" />
              </Field>
              <Field label="Prioridad">
                <input name="priority" type="number" defaultValue={funnel.priority} className="input" />
              </Field>
            </div>
            <Field label="Al vencer el timer">
              <select name="onTimerExpire" defaultValue={funnel.onTimerExpire} className="input">
                <option value="NEXT_OFFER">Pasar a la siguiente oferta</option>
                <option value="THANK_YOU">Ir a la página de gracias</option>
              </select>
            </Field>
            <Field label="Primera oferta">
              <select name="entryNodeId" defaultValue={funnel.entryNodeId ?? ""} className="input">
                <option value="">—</option>
                {funnel.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </Field>
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-medium">Página de gracias de este embudo</summary>
              <div className="mt-3 grid gap-2">
                <input name="tyTitle" defaultValue={ty.title} placeholder="Título" className="input" />
                <input name="tyMessage" defaultValue={ty.message} placeholder="Mensaje (usá {email})" className="input" />
                <input name="tyButton" defaultValue={ty.buttonText} placeholder="Texto del botón" className="input" />
                <input name="tyButtonUrl" defaultValue={ty.buttonUrl} placeholder="URL del botón" className="input" />
                <input name="tyRedirect" defaultValue={ty.redirectUrl} placeholder="Redirigir a (https://…)" className="input" />
              </div>
            </details>
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
          <ActionForm action={duplicateFunnelAction.bind(null, storeId, funnelId)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Field label="Copiar embudo a">
              <select name="targetStoreId" defaultValue={storeId} className="input">
                {stores.map((s) => (
                  <option key={s.store.id} value={s.store.id}>
                    {s.store.name}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton className="btn btn-secondary">Copiar</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Ofertas</h2>
      <div className="space-y-4">
        {[...funnel.nodes].sort((a, b) => Number(b.id === funnel.entryNodeId) - Number(a.id === funnel.entryNodeId)).map((n) => {
          const s = statOf(n.id);
          const ab = abWinner(stats, n.id, n.abStartedAt);
          const va = n.variants.find((v) => v.key === "A");
          const vb = n.variants.find((v) => v.key === "B");
          const price = nodePrice(n as unknown as NodeFull, null, null, store.baseCurrency);
          return (
            <details key={n.id} id={`node-${n.id}`} className="card p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {n.label} · {n.product.name}
                  {funnel.entryNodeId === n.id && <span className="ml-2"><Badge tone="brand">Inicio</Badge></span>}
                </span>
                <span className="text-sm text-muted">
                  {price.compareAt ? <s className="mr-1">{fmt(price.compareAt)}</s> : null}
                  <b className="text-ink">{fmt(price.price)}</b> · {s ? `${s.views} vistas · ${s.accepted} aceptadas · ${pct(s.rate)} · ${fmt(s.revenue)} · ${fmt(s.perView)}/vista` : "sin vistas"}
                </span>
              </summary>
              <div className="mt-4 border-t border-line pt-4">{nodeForm(n)}</div>
              <div className="mt-6 rounded-2xl bg-paper p-4">
                <h3 className="mb-1 font-semibold">Test A/B de esta oferta</h3>
                <p className="mb-3 text-xs text-muted">Cada comprador ve una variante (50/50). Para decidir: al menos 7 días y 30 cobros por versión; gana el mayor facturado por vista.</p>
                {n.abTestActive && (
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(["A", "B"] as const).map((k) => {
                      const st = statOf(n.id, k) as NodeStats | undefined;
                      return (
                        <div key={k} className="rounded-xl bg-white p-3 text-sm">
                          <b>Variante {k}</b>
                          <div className="text-muted">{st ? `${st.views} vistas · ${st.accepted} cobros · ${pct(st.rate)} · ${fmt(st.perView)}/vista` : "sin datos"}</div>
                          <div className="mt-2">
                            <ActionButton action={applyWinnerAction.bind(null, storeId, funnelId, n.id, k)} confirm={`Aplicar la variante ${k} como definitiva y apagar el test?`}>
                              Elegir {k}
                            </ActionButton>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-xs sm:col-span-2">
                      {ab.ready ? (
                        <Badge tone="ok">Ganadora sugerida: variante {ab.winner}</Badge>
                      ) : (
                        <span className="text-muted">Todavía sin datos suficientes ({Math.floor(ab.days)} días).</span>
                      )}
                    </div>
                  </div>
                )}
                <ActionForm action={saveVariantsAction.bind(null, storeId, funnelId, n.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(["a", "b"] as const).map((p) => {
                    const v = p === "a" ? va : vb;
                    return (
                      <div key={p} className="grid gap-2 rounded-xl bg-white p-3">
                        <b className="text-sm">Variante {p.toUpperCase()}</b>
                        <input name={`${p}_discount`} type="number" min={0} max={100} defaultValue={v?.discountPercent ?? ""} className="input" placeholder="Descuento % (vacío = el de la oferta)" />
                        <input name={`${p}_fixed`} inputMode="decimal" defaultValue={v?.fixedPrice ? num(v.fixedPrice) : ""} className="input" placeholder="Precio fijo (opcional)" />
                        <input name={`${p}_title`} defaultValue={v?.title ?? ""} className="input" placeholder="Título (opcional)" />
                        <input name={`${p}_accept`} defaultValue={v?.acceptText ?? ""} className="input" placeholder="Botón aceptar (opcional)" />
                        <textarea name={`${p}_body`} defaultValue={v?.body ?? ""} rows={2} className="input" placeholder="Texto (opcional)" />
                        <textarea name={`${p}_html`} defaultValue={v?.customHtml ?? ""} rows={2} className="input font-mono text-xs" placeholder="HTML propio (opcional)" />
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <Toggle name="abTestActive" defaultChecked={n.abTestActive} label="Test activo" />
                    <SubmitButton className="btn btn-secondary">Guardar variantes</SubmitButton>
                  </div>
                </ActionForm>
              </div>
              <div className="mt-4">
                <ActionButton action={deleteNodeAction.bind(null, storeId, funnelId, n.id)} className="btn btn-danger btn-sm" confirm="¿Eliminar esta oferta?">
                  Eliminar oferta
                </ActionButton>
              </div>
            </details>
          );
        })}
        <Card title="Agregar oferta">{nodeForm()}</Card>
      </div>
    </>
  );
}
