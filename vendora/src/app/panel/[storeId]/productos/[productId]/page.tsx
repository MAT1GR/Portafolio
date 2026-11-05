import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney, num } from "@/lib/money";
import { productPrice } from "@/lib/pricing";
import { sanitizeBlocks, TEMPLATES } from "@/lib/blocks";
import { storeUrl } from "@/lib/stores";
import { aiConfigured } from "@/lib/ai";
import { getStoreOwnerPlan, bonusCount } from "@/lib/plans";
import {
  addBonusAction, addLinkAction, addModuleAction, aiCoverAction, aiSalesPageAction, applyTemplateAction, deleteFileAction, deleteLessonAction, deleteModuleAction,
  deleteProductAction, duplicateProductAction, moveFileAction, removeBonusAction, renameFileAction, saveLessonAction, saveSalesHtmlAction, saveSalesPageAction,
  updatePricesAction, updateProductAction,
} from "../../../actions/products";
import { ActionButton, ActionForm, AutoRefresh, CopyButton, FileUpload, ImageInput, SubmitButton } from "@/components/client";
import { BlockEditor } from "@/components/panel/block-editor";
import { Badge, Card, Field, Notice, PageHeader, Tabs } from "@/components/ui";

type Props = { params: Promise<{ storeId: string; productId: string }>; searchParams: Promise<{ tab?: string }> };

export default async function ProductEditPage({ params, searchParams }: Props) {
  const { storeId, productId } = await params;
  const tab = (await searchParams).tab || "general";
  const { store } = await requireStorePage(storeId, "products");
  const product = await db.product.findFirst({
    where: { id: productId, storeId },
    include: {
      files: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } },
      bonuses: { include: { bonusProduct: { include: { _count: { select: { files: true } } } } }, orderBy: { sortOrder: "asc" } },
      marketPrices: true,
    },
  });
  if (!product) notFound();
  const jobs = await db.aiJob.findMany({ where: { productId, status: { in: ["QUEUED", "RUNNING"] } } });
  const lastFailed = await db.aiJob.findFirst({ where: { productId, status: "FAILED", finishedAt: { gte: new Date(Date.now() - 10 * 60_000) } }, orderBy: { finishedAt: "desc" } });
  const base = `/panel/${storeId}/productos/${productId}`;
  const publicUrl = storeUrl(store, `/p/${product.slug}`);
  const checkoutUrl = storeUrl(store, `/checkout/${product.slug}`);
  const ready = product.files.length + product.modules.length > 0;

  return (
    <>
      <PageHeader
        title={product.name}
        back={{ href: `/panel/${storeId}/productos`, label: "Productos" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={product.status === "PUBLISHED" ? "ok" : product.status === "DRAFT" ? "warn" : "neutral"}>
              {product.status === "PUBLISHED" ? "Publicado" : product.status === "DRAFT" ? "Borrador" : "Archivado"}
            </Badge>
            {ready ? <Badge tone="ok">Contenido listo</Badge> : <Badge tone="bad">Sin contenido</Badge>}
            {product.aiGenerated && <Badge tone="mint">Creado con IA</Badge>}
          </span>
        }
        actions={
          <>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Ver página
            </a>
            <CopyButton value={checkoutUrl} label="Copiar link de checkout" />
            <ActionButton action={duplicateProductAction.bind(null, storeId, productId)}>Duplicar</ActionButton>
            <ActionButton action={deleteProductAction.bind(null, storeId, productId)} className="btn btn-danger btn-sm" confirm="¿Eliminar el producto? Si tiene ventas, se archiva.">
              Eliminar
            </ActionButton>
          </>
        }
      />
      {jobs.length > 0 && (
        <div className="mb-4">
          <AutoRefresh seconds={4} />
          <Notice tone="mint">La IA está trabajando en este producto ({jobs.map((j) => j.message || "en cola").join(", ")})…</Notice>
        </div>
      )}
      {lastFailed && !jobs.length && (
        <div className="mb-4">
          <Notice tone="bad">La IA no pudo terminar: {lastFailed.error}</Notice>
        </div>
      )}
      <Tabs
        active={tab}
        items={[
          { key: "general", href: `${base}?tab=general`, label: "General" },
          { key: "precios", href: `${base}?tab=precios`, label: "Precios y markets" },
          { key: "contenido", href: `${base}?tab=contenido`, label: "Contenido y entrega" },
          { key: "bonos", href: `${base}?tab=bonos`, label: `Bonos (${product.bonuses.length})` },
          { key: "pagina", href: `${base}?tab=pagina`, label: "Página de venta" },
        ]}
      />

      {tab === "general" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <ActionForm action={updateProductAction.bind(null, storeId, productId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" className="sm:col-span-2">
                <input name="name" defaultValue={product.name} required className="input" />
              </Field>
              <Field label="URL del producto" hint={`/p/${product.slug}`}>
                <input name="slug" defaultValue={product.slug} className="input" />
              </Field>
              <Field label="Tipo">
                <select name="type" defaultValue={product.type} className="input">
                  {["EBOOK", "COURSE", "TEMPLATE", "AUDIO", "VIDEO", "SOFTWARE", "PACK", "LINK"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Estado">
                <select name="status" defaultValue={product.status} className="input">
                  <option value="DRAFT">Borrador</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </Field>
              <Field label="Visibilidad">
                <select name="visibility" defaultValue={product.visibility} className="input">
                  <option value="PUBLIC">En la tienda</option>
                  <option value="HIDDEN">Oculto (solo con link)</option>
                  <option value="POSTPURCHASE_ONLY">Solo post-compra</option>
                </select>
              </Field>
              <Field label="Descripción corta" className="sm:col-span-2">
                <textarea name="shortDescription" defaultValue={product.shortDescription ?? ""} rows={2} className="input" />
              </Field>
              <Field label="Descripción" className="sm:col-span-2">
                <textarea name="description" defaultValue={product.description ?? ""} rows={6} className="input" />
              </Field>
              <Field label="Título en el checkout" hint="Vacío = nombre del producto">
                <input name="checkoutTitle" defaultValue={product.checkoutTitle ?? ""} className="input" />
              </Field>
              <Field label="Bloque de texto del checkout" hint='Ej.: "Digitales Buch zum Ausdrucken"'>
                <input name="checkoutSubtitle" defaultValue={product.checkoutSubtitle ?? ""} className="input" />
              </Field>
              <Field label="Aviso de entrega" hint="Qué recibe, por dónde y cuándo. Se muestra en el checkout." className="sm:col-span-2">
                <input name="deliveryNotice" defaultValue={product.deliveryNotice ?? ""} className="input" placeholder="Te llega el PDF a tu email al instante." />
              </Field>
              <Field label="Orden en el catálogo">
                <input name="sortOrder" type="number" defaultValue={product.sortOrder} className="input" />
              </Field>
              <div className="sm:col-span-2">
                <ImageInput storeId={storeId} name="imageUrl" defaultValue={product.imageUrl} label="Tapa / imagen del producto" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>Guardar</SubmitButton>
              </div>
            </ActionForm>
          </Card>
          <Card title="Tapa con IA" description="Claude elige título, paleta y estilo; se dibuja en alta resolución y queda en Recursos.">
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="mb-4 w-full rounded-xl border border-line" />
            )}
            <ActionButton action={aiCoverAction.bind(null, storeId, productId)} className="btn btn-brand btn-sm">
              <Sparkles size={14} /> Generar tapa
            </ActionButton>
            {!aiConfigured() && <p className="mt-2 text-xs text-muted">Requiere ANTHROPIC_API_KEY en el servidor.</p>}
          </Card>
        </div>
      )}

      {tab === "precios" && <PricesTab storeId={storeId} product={product} baseCurrency={store.baseCurrency} />}

      {tab === "contenido" && (
        <div className="space-y-6">
          <Card title="Archivos y links de entrega" description="Se entregan automáticamente por email apenas se acredita el pago (y quedan en Mis compras).">
            {product.files.length === 0 ? (
              <p className="mb-4 text-sm text-bad">Sin contenido: el comprador no recibiría nada. Subí un archivo o agregá un link.</p>
            ) : (
              <ul className="mb-4 divide-y divide-line">
                {product.files.map((f, i) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <ActionForm action={renameFileAction.bind(null, storeId, productId, f.id)} className="flex min-w-0 flex-1 items-center gap-2" hideMessage>
                      <Badge tone={f.kind === "LINK" ? "mint" : "neutral"}>{f.kind === "LINK" ? "Link" : (f.mimeType?.split("/")[1] ?? "archivo").slice(0, 8)}</Badge>
                      <input name="name" defaultValue={f.name} className="input max-w-xs py-1.5" />
                      <SubmitButton className="btn btn-ghost btn-sm" pending="…">
                        Renombrar
                      </SubmitButton>
                      <span className="text-xs text-muted">{f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : f.url}</span>
                      {f.aiGenerated && <Badge tone="mint">IA</Badge>}
                    </ActionForm>
                    <div className="flex gap-1">
                      {i > 0 && <ActionButton action={moveFileAction.bind(null, storeId, productId, f.id, -1)} className="btn btn-ghost btn-sm">↑</ActionButton>}
                      {i < product.files.length - 1 && <ActionButton action={moveFileAction.bind(null, storeId, productId, f.id, 1)} className="btn btn-ghost btn-sm">↓</ActionButton>}
                      <ActionButton action={deleteFileAction.bind(null, storeId, productId, f.id)} className="btn btn-ghost btn-sm text-bad" confirm="¿Eliminar este archivo?">
                        Quitar
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-start gap-4">
              <FileUpload storeId={storeId} purpose="product-file" productId={productId} label="Subir archivo (PDF, video, zip…)" />
              <ActionForm action={addLinkAction.bind(null, storeId, productId)} className="flex flex-wrap items-center gap-2" reset>
                <input name="name" placeholder="Nombre (ej. Grupo privado)" className="input w-48 py-1.5" />
                <input name="url" placeholder="https://…" className="input w-64 py-1.5" />
                <SubmitButton className="btn btn-secondary btn-sm">Agregar link</SubmitButton>
              </ActionForm>
            </div>
          </Card>
          <Card title="Curso: módulos y lecciones" description="Opcional. Las lecciones se ven en el área de miembros (Mis compras) con progreso.">
            {product.modules.map((m) => (
              <div key={m.id} className="mb-4 rounded-2xl border border-line p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{m.title}</h3>
                  <ActionButton action={deleteModuleAction.bind(null, storeId, productId, m.id)} className="btn btn-ghost btn-sm text-bad" confirm="¿Eliminar el módulo y sus lecciones?">
                    Eliminar módulo
                  </ActionButton>
                </div>
                {m.lessons.map((l) => (
                  <details key={l.id} className="mb-2 rounded-xl bg-paper p-3">
                    <summary className="cursor-pointer text-sm font-medium">{l.title}</summary>
                    <ActionForm action={saveLessonAction.bind(null, storeId, productId)} className="mt-3 grid gap-2">
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input name="title" defaultValue={l.title} className="input" />
                      <input name="videoUrl" defaultValue={l.videoUrl ?? ""} placeholder="Video (YouTube, Vimeo o .mp4)" className="input" />
                      <input name="fileUrl" defaultValue={l.fileUrl ?? ""} placeholder="Material descargable (URL)" className="input" />
                      <textarea name="content" defaultValue={l.content ?? ""} rows={4} placeholder="Texto de la lección" className="input" />
                      <div className="flex gap-2">
                        <SubmitButton className="btn btn-primary btn-sm">Guardar lección</SubmitButton>
                      </div>
                    </ActionForm>
                    <div className="mt-2">
                      <ActionButton action={deleteLessonAction.bind(null, storeId, productId, l.id)} className="btn btn-ghost btn-sm text-bad" confirm="¿Eliminar la lección?">
                        Eliminar lección
                      </ActionButton>
                    </div>
                  </details>
                ))}
                <details className="rounded-xl border border-dashed border-line-2 p-3">
                  <summary className="cursor-pointer text-sm font-medium">+ Nueva lección</summary>
                  <ActionForm action={saveLessonAction.bind(null, storeId, productId)} className="mt-3 grid gap-2" reset>
                    <input type="hidden" name="moduleId" value={m.id} />
                    <input name="title" required placeholder="Título" className="input" />
                    <input name="videoUrl" placeholder="Video (YouTube, Vimeo o .mp4)" className="input" />
                    <input name="fileUrl" placeholder="Material descargable (URL)" className="input" />
                    <textarea name="content" rows={3} placeholder="Texto de la lección" className="input" />
                    <SubmitButton className="btn btn-primary btn-sm">Agregar lección</SubmitButton>
                  </ActionForm>
                </details>
              </div>
            ))}
            <ActionForm action={addModuleAction.bind(null, storeId, productId)} className="flex gap-2" reset>
              <input name="title" required placeholder="Nombre del módulo" className="input max-w-sm" />
              <SubmitButton className="btn btn-secondary">Agregar módulo</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {tab === "bonos" && <BonusesTab storeId={storeId} productId={productId} bonuses={product.bonuses} />}

      {tab === "pagina" && (
        <div className="space-y-6">
          <Card
            title="Página de venta"
            description="Armala con bloques (editor visual) o pegá tu propio HTML."
            actions={
              <ActionButton action={aiSalesPageAction.bind(null, storeId, productId)} className="btn btn-brand btn-sm">
                <Sparkles size={14} /> Escribir con IA
              </ActionButton>
            }
          >
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Plantillas:</span>
              {TEMPLATES.map((t) => (
                <ActionButton key={t.key} action={applyTemplateAction.bind(null, storeId, productId, t.key)} confirm={`Reemplaza los bloques actuales por la plantilla "${t.name}". ¿Continuar?`}>
                  {t.name}
                </ActionButton>
              ))}
            </div>
            {product.salesPageMode === "CUSTOM_HTML" && (
              <div className="mb-4">
                <Notice tone="warn">La página publicada usa HTML propio. Guardar los bloques vuelve a la página por bloques.</Notice>
              </div>
            )}
            <BlockEditor storeId={storeId} initial={sanitizeBlocks(product.salesPage)} save={saveSalesPageAction.bind(null, storeId, productId)} previewUrl={publicUrl} />
          </Card>
          <Card title="HTML propio" description="Pegá una página completa. Tokens disponibles: {{price}}, {{compare_price}}, {{currency}}, {{checkout_url}}, {{product_name}}, {{store_name}}. El seguimiento y el píxel se agregan solos.">
            <ActionForm action={saveSalesHtmlAction.bind(null, storeId, productId)} className="space-y-3">
              <select name="mode" defaultValue={product.salesPageMode} className="input max-w-xs">
                <option value="BLOCKS">Publicar la página por bloques</option>
                <option value="CUSTOM_HTML">Publicar el HTML propio</option>
              </select>
              <textarea name="html" defaultValue={product.salesPageHtml ?? ""} rows={14} className="input font-mono text-xs" placeholder="<!doctype html>…" />
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}

async function PricesTab({ storeId, product, baseCurrency }: { storeId: string; product: { id: string; price: unknown; compareAtPrice: unknown; marketPrices: { marketId: string; price: unknown; compareAtPrice: unknown }[] }; baseCurrency: string }) {
  const markets = await db.market.findMany({ where: { storeId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  const base = { price: product.price as never, compareAtPrice: product.compareAtPrice as never };
  return (
    <Card title="Precios" description="El precio base se convierte a cada market con su tipo de cambio y redondeo. Cargá un precio propio por market para fijarlo (ej. RON 89,99 tachado 179,99).">
      <ActionForm action={updatePricesAction.bind(null, storeId, product.id)} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Precio base (${baseCurrency})`}>
            <input name="price" defaultValue={num(product.price as never)} inputMode="decimal" className="input" />
          </Field>
          <Field label="Precio tachado base">
            <input name="compareAtPrice" defaultValue={product.compareAtPrice ? num(product.compareAtPrice as never) : ""} inputMode="decimal" className="input" />
          </Field>
        </div>
        {markets.length === 0 ? (
          <Notice>
            No tenés markets. <Link href={`/panel/${storeId}/markets`} className="underline">Creá markets</Link> para cobrar en la moneda de cada país.
          </Notice>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Convertido</th>
                  <th>Precio propio</th>
                  <th>Tachado propio</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => {
                  const own = product.marketPrices.find((x) => x.marketId === m.id);
                  const conv = productPrice(base, m, baseCurrency);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted">
                          {m.currency} · {m.countries.join(", ") || "sin países"}
                        </div>
                      </td>
                      <td className="text-sm text-muted tabular-nums">
                        {formatMoney(conv.price, m.currency)}
                        {conv.compareAt ? ` / ${formatMoney(conv.compareAt, m.currency)}` : ""}
                      </td>
                      <td>
                        <input name={`m_${m.id}_price`} defaultValue={own ? num(own.price as never) : ""} inputMode="decimal" className="input w-32 py-1.5" placeholder="Automático" />
                      </td>
                      <td>
                        <input name={`m_${m.id}_compare`} defaultValue={own?.compareAtPrice ? num(own.compareAtPrice as never) : ""} inputMode="decimal" className="input w-32 py-1.5" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SubmitButton>Guardar precios</SubmitButton>
      </ActionForm>
    </Card>
  );
}

async function BonusesTab({
  storeId,
  productId,
  bonuses,
}: {
  storeId: string;
  productId: string;
  bonuses: { id: string; bonusProduct: { id: string; name: string; _count: { files: number } } }[];
}) {
  const plan = await getStoreOwnerPlan(storeId);
  const used = await bonusCount(storeId);
  const candidates = await db.product.findMany({ where: { storeId, id: { not: productId, notIn: bonuses.map((b) => b.bonusProduct.id) }, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  return (
    <Card title="Bonos incluidos (regalos)" description={`Se entregan junto con este producto, sin costo. Bonos usados en la tienda: ${used}/${plan.maxBonusesPerStore} (plan ${plan.name}).`}>
      <ul className="mb-5 divide-y divide-line">
        {bonuses.length === 0 && <li className="py-2 text-sm text-muted">Este producto no tiene bonos.</li>}
        {bonuses.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
            <Link href={`/panel/${storeId}/productos/${b.bonusProduct.id}?tab=contenido`} className="font-medium hover:underline">
              🎁 {b.bonusProduct.name}
            </Link>
            <div className="flex items-center gap-2">
              {b.bonusProduct._count.files ? <Badge tone="ok">Listo</Badge> : <Badge tone="bad">Sin contenido</Badge>}
              <ActionButton action={removeBonusAction.bind(null, storeId, productId, b.id)} className="btn btn-ghost btn-sm text-bad">
                Quitar
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
      <ActionForm action={addBonusAction.bind(null, storeId, productId)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Usar un producto existente">
          <select name="bonusProductId" className="input">
            <option value="">—</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="…o crear un bono nuevo">
          <input name="newName" className="input" placeholder="3 regalos para hacer juntas" />
        </Field>
        <Field label="Valor de referencia (tachado)">
          <input name="newValue" inputMode="decimal" className="input" placeholder="15" />
        </Field>
        <div className="sm:col-span-3">
          <SubmitButton>Agregar bono</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
