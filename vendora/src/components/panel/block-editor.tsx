"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { BLOCK_LABELS, emptyBlock, type Block, type BlockType } from "@/lib/blocks";
import { FileUpload, type ActionResult } from "@/components/client";

type RowField = { key: string; label: string; textarea?: boolean };

/** Editor visual de la página de venta por bloques (ordenar, editar, agregar, quitar). */
export function BlockEditor({
  storeId,
  initial,
  save,
  previewUrl,
}: {
  storeId: string;
  initial: Block[];
  save: (blocks: Block[]) => Promise<ActionResult>;
  previewUrl: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

  const update = (id: string, patch: Record<string, unknown>) => {
    setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
    setDirty(true);
  };
  const move = (i: number, d: number) => {
    setBlocks((bs) => {
      const n = [...bs];
      const j = i + d;
      if (j < 0 || j >= n.length) return bs;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const remove = (id: string) => {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    setDirty(true);
  };
  const add = (type: BlockType) => {
    const b = emptyBlock(type);
    setBlocks((bs) => [...bs, b]);
    setOpen(b.id);
    setDirty(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Los bloques vacíos no se muestran en la página. Los testimonios tienen que ser reales.</p>
        <div className="flex gap-2">
          <a href={previewUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            Ver página
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await save(blocks);
                setMsg({ ok: Boolean(r?.ok), text: r?.message || "" });
                if (r?.ok) {
                  setDirty(false);
                  router.refresh();
                }
              })
            }
            className="btn btn-primary btn-sm"
          >
            {pending ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
          </button>
        </div>
      </div>
      {msg && <p className={`mb-3 text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
      <div className="space-y-2">
        {blocks.map((b, i) => (
          <div key={b.id} className="rounded-2xl border border-line bg-white">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => setOpen(open === b.id ? null : b.id)} className="flex flex-1 items-center gap-2 text-left text-sm font-semibold">
                {open === b.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {BLOCK_LABELS[b.type]}
                <span className="truncate font-normal text-muted">{summary(b)}</span>
              </button>
              <button type="button" onClick={() => move(i, -1)} className="btn btn-ghost btn-sm" aria-label="Subir">
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="btn btn-ghost btn-sm" aria-label="Bajar">
                <ArrowDown size={14} />
              </button>
              <button type="button" onClick={() => remove(b.id)} className="btn btn-ghost btn-sm text-bad" aria-label="Quitar">
                <Trash2 size={14} />
              </button>
            </div>
            {open === b.id && <div className="border-t border-line p-4">{fields(b, update, storeId)}</div>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Plus size={16} className="text-muted" />
        {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
          <button key={t} type="button" onClick={() => add(t)} className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium hover:bg-black/10">
            {BLOCK_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

function summary(b: Block) {
  if ("title" in b && b.title) return `· ${b.title}`;
  if (b.type === "image" || b.type === "video") return b.url ? `· ${b.url.slice(0, 40)}` : "";
  return "";
}

function Text({ label, value, onChange, textarea, placeholder }: { label: string; value?: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} className="input" placeholder={placeholder} />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input" placeholder={placeholder} />
      )}
    </label>
  );
}

function Rows<T extends Record<string, string | undefined>>({ items, fields, onChange, addLabel }: { items: T[]; fields: RowField[]; onChange: (items: T[]) => void; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 rounded-xl bg-paper p-2">
          <div className="grid grid-cols-1 flex-1 gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
                <span className="text-xs text-muted">{f.label}</span>
                {f.textarea ? (
                  <textarea value={it[f.key] ?? ""} rows={2} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} className="input" />
                ) : (
                  <input value={it[f.key] ?? ""} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} className="input" />
                )}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm self-start text-bad" aria-label="Quitar">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, Object.fromEntries(fields.map((f) => [f.key, ""])) as T])} className="btn btn-secondary btn-sm">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function fields(b: Block, update: (id: string, patch: Record<string, unknown>) => void, storeId: string) {
  const set = (k: string) => (v: unknown) => update(b.id, { [k]: v });
  switch (b.type) {
    case "hero":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Text label="Titular" value={b.title} onChange={set("title")} />
          <Text label="Etiqueta (opcional)" value={b.badge} onChange={set("badge")} placeholder="Guía práctica" />
          <div className="sm:col-span-2">
            <Text label="Subtítulo" value={b.subtitle} onChange={set("subtitle")} textarea />
          </div>
          <Text label="Texto del botón" value={b.ctaText} onChange={set("ctaText")} placeholder="Comprar ahora" />
          <ImageField storeId={storeId} value={b.image} onChange={set("image")} />
        </div>
      );
    case "text":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Text label="Texto (separá párrafos con una línea en blanco)" value={b.body} onChange={set("body")} textarea />
        </div>
      );
    case "benefits":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Text label="Ítems (uno por línea)" value={b.items.join("\n")} onChange={(v) => set("items")(v.split("\n").map((x) => x.trimStart()))} textarea />
        </div>
      );
    case "features":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Rows items={b.items} fields={[{ key: "title", label: "Título" }, { key: "text", label: "Texto", textarea: true }]} onChange={set("items")} addLabel="Agregar característica" />
        </div>
      );
    case "image":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ImageField storeId={storeId} value={b.url} onChange={set("url")} />
          <Text label="Epígrafe" value={b.caption} onChange={set("caption")} />
        </div>
      );
    case "video":
      return <Text label="URL del video (YouTube, Vimeo o .mp4)" value={b.url} onChange={set("url")} />;
    case "testimonials":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Rows items={b.items} fields={[{ key: "name", label: "Nombre" }, { key: "role", label: "Detalle (opcional)" }, { key: "text", label: "Testimonio real", textarea: true }]} onChange={set("items")} addLabel="Agregar testimonio" />
        </div>
      );
    case "bonuses":
      return <Text label="Título (los bonos se toman del producto)" value={b.title} onChange={set("title")} />;
    case "offer":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Text label="Texto del botón" value={b.ctaText} onChange={set("ctaText")} />
          <div className="sm:col-span-2">
            <Text label="Nota debajo del botón" value={b.note} onChange={set("note")} />
          </div>
        </div>
      );
    case "guarantee":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Text label="Texto" value={b.body} onChange={set("body")} textarea />
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-3">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Rows items={b.items} fields={[{ key: "q", label: "Pregunta" }, { key: "a", label: "Respuesta", textarea: true }]} onChange={set("items")} addLabel="Agregar pregunta" />
        </div>
      );
    case "cta":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Text label="Título" value={b.title} onChange={set("title")} />
          <Text label="Texto del botón" value={b.ctaText} onChange={set("ctaText")} />
        </div>
      );
    case "countdown":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Text label="Título" value={b.title} onChange={set("title")} placeholder="La preventa termina en" />
          <label className="block">
            <span className="label">Fecha y hora de fin (real)</span>
            <input
              type="datetime-local"
              className="input"
              value={toLocalInput(b.endsAt)}
              onChange={(e) => set("endsAt")(e.target.value ? new Date(e.target.value).toISOString() : b.endsAt)}
            />
          </label>
        </div>
      );
    case "author":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Text label="Nombre" value={b.name} onChange={set("name")} />
          <ImageField storeId={storeId} value={b.image} onChange={set("image")} />
          <div className="sm:col-span-2">
            <Text label="Biografía" value={b.bio} onChange={set("bio")} textarea />
          </div>
        </div>
      );
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function ImageField({ storeId, value, onChange }: { storeId: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="label">Imagen</span>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover" />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-line-2 bg-paper" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input" placeholder="https://…" />
          <FileUpload storeId={storeId} purpose="image" accept="image/*" label="Subir imagen" onUploaded={(r) => r.url && onChange(r.url)} />
        </div>
      </div>
    </div>
  );
}
