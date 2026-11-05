import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { aiEbooksUsed, getStoreOwnerPlan } from "@/lib/plans";
import { LANGUAGES } from "@/lib/i18n";
import { aiCoverAction } from "../../actions/products";
import { createAiEbookAction } from "../../actions/ebooks";
import { ActionButton, ActionForm, AutoRefresh, SubmitButton } from "@/components/client";
import { Badge, Card, Field, Notice, PageHeader, fmtDate } from "@/components/ui";

export default async function EbooksPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "products");
  const plan = await getStoreOwnerPlan(storeId);
  const used = await aiEbooksUsed(store.ownerId);
  const ebooks = await db.product.findMany({
    where: { storeId, type: "EBOOK", status: { not: "ARCHIVED" } },
    include: { files: { select: { id: true, name: true, aiGenerated: true } }, bonusOf: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  const jobs = await db.aiJob.findMany({ where: { storeId, kind: { in: ["EBOOK", "COVER"] } }, orderBy: { createdAt: "desc" }, take: 8 });
  const running = jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING");
  const quota = plan.aiEbooksPerMonth === null ? "sin límite" : `${used}/${plan.aiEbooksPerMonth} este mes`;

  return (
    <>
      <PageHeader title="Ebooks con IA" description={`Diseño de ebooks: tapas, contenido y generación con IA. Cuota: ${quota} (plan ${plan.name}).`} />
      <AutoRefresh seconds={5} until={!running} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Escribir un ebook con IA" description="Índice, capítulos, tapa y PDF maquetado. Queda como archivo del producto." className="lg:col-span-1">
          {!aiConfigured() && (
            <div className="mb-3">
              <Notice tone="warn">Configurá ANTHROPIC_API_KEY en el servidor para usar la IA.</Notice>
            </div>
          )}
          <ActionForm action={createAiEbookAction.bind(null, storeId)} className="grid gap-3" reset>
            <Field label="Tema">
              <textarea name="topic" required rows={3} className="input" placeholder="Cómo hablar con tu hija de 10 años sobre la primera menstruación" />
            </Field>
            <Field label="Público">
              <input name="audience" className="input" placeholder="Mamás primerizas en el tema" />
            </Field>
            <Field label="Tono">
              <input name="tone" className="input" placeholder="Cálido y práctico" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capítulos">
                <input name="chapters" type="number" min={2} max={12} defaultValue={6} className="input" />
              </Field>
              <Field label="Palabras por capítulo">
                <input name="words" type="number" min={300} max={2500} step={100} defaultValue={900} className="input" />
              </Field>
            </div>
            <Field label="Idioma">
              <select name="language" defaultValue={store.language} className="input">
                {Object.entries(LANGUAGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Agregar a un producto existente (opcional)">
              <select name="productId" className="input">
                <option value="">Crear un producto nuevo</option>
                {ebooks.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Precio si es nuevo (${store.baseCurrency})`}>
              <input name="price" inputMode="decimal" className="input" placeholder="9.99" />
            </Field>
            <SubmitButton className="btn btn-brand" pending="Enviando…">
              <Sparkles size={16} /> Escribir ebook
            </SubmitButton>
          </ActionForm>
          {jobs.length > 0 && (
            <div className="mt-5 space-y-2 border-t border-line pt-4">
              {jobs.map((j) => (
                <div key={j.id} className="text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{j.kind === "EBOOK" ? "Ebook" : "Tapa"} · {fmtDate(j.createdAt, store.timezone)}</span>
                    <Badge tone={j.status === "DONE" ? "ok" : j.status === "FAILED" ? "bad" : "mint"}>{j.status === "DONE" ? "Listo" : j.status === "FAILED" ? "Error" : `${j.progress}%`}</Badge>
                  </div>
                  <div className={j.status === "FAILED" ? "text-bad" : "text-muted"}>{j.status === "FAILED" ? j.error : j.message}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
          {ebooks.length === 0 && <p className="text-sm text-muted">Todavía no hay ebooks en esta tienda.</p>}
          {ebooks.map((e) => (
            <div key={e.id} className="card overflow-hidden">
              <div className="aspect-[3/5] bg-paper">
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt={e.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center p-4 text-center text-sm text-muted">Sin tapa</div>
                )}
              </div>
              <div className="p-3">
                <Link href={`/panel/${storeId}/productos/${e.id}`} className="line-clamp-2 text-sm font-semibold hover:underline">
                  {e.name}
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.files.length ? <Badge tone="ok">Listo</Badge> : <Badge tone="bad">Sin contenido</Badge>}
                  {e.bonusOf.length > 0 && <Badge tone="mint">Bono</Badge>}
                  {e.visibility === "POSTPURCHASE_ONLY" && <Badge>Post-compra</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <ActionButton action={aiCoverAction.bind(null, storeId, e.id)} className="btn btn-secondary btn-sm">
                    Tapa con IA
                  </ActionButton>
                  <Link href={`/panel/${storeId}/productos/${e.id}?tab=contenido`} className="btn btn-ghost btn-sm">
                    Subir / reemplazar PDF
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
