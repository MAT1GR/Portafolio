"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

export type ActionResult = { ok: boolean; message?: string; redirect?: string; data?: Record<string, unknown> } | null;
export type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** Formulario conectado a una server action, con mensaje de resultado. */
export function ActionForm({
  action,
  children,
  className,
  reset,
  hideMessage,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  reset?: boolean;
  hideMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    if (state.redirect) router.push(state.redirect);
    else router.refresh();
    if (reset) ref.current?.reset();
  }, [state, router, reset]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {!hideMessage && state?.message && (
        <p role="status" className={`mt-3 text-sm font-medium ${state.ok ? "text-ok" : "text-bad"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({ children, className = "btn btn-primary", pending: pendingText = "Guardando…", name, value }: { children: ReactNode; className?: string; pending?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} name={name} value={value}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botón que ejecuta una server action con confirmación. */
export function ActionButton({
  action,
  children,
  className = "btn btn-secondary btn-sm",
  confirm,
  fields,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  confirm?: string;
  fields?: Record<string, string>;
}) {
  // El botón puede desaparecer con la revalidación (p. ej. "Aprobar transferencia"): el aviso se manda al Toaster
  // del layout apenas responde la acción, antes de que React desmonte el botón.
  const [state, formAction] = useActionState(async (prev: ActionResult, fd: FormData) => {
    const r = await action(prev, fd);
    if (r?.ok && r.message && r.message !== "Cambios guardados") window.dispatchEvent(new CustomEvent("vd-toast", { detail: r.message }));
    return r;
  }, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (state.redirect) router.push(state.redirect);
      else router.refresh();
    }
  }, [state, router]);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start"
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton className={className} pending="…">
        {children}
      </SubmitButton>
      {state && !state.ok && state.message && <span className="mt-1 text-xs text-bad">{state.message}</span>}
    </form>
  );
}

/** Avisos flotantes de resultado (los dispara ActionButton); vive en el layout para sobrevivir a los refrescos. */
export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const id = ++n;
      setItems((list) => [...list, { id, text: String((e as CustomEvent).detail) }]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener("vd-toast", onToast);
    return () => window.removeEventListener("vd-toast", onToast);
  }, []);
  if (!items.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 grid gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} role="status" className="rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">
          ✓ {t.text}
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ value, label = "Copiar", className = "btn btn-secondary btn-sm" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "¡Copiado!" : label}
    </button>
  );
}

export function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full bg-line-2 transition peer-checked:bg-ink after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Refresca la página cada N segundos (para estados en curso: trabajos de IA, pagos). */
export function AutoRefresh({ seconds = 3, until }: { seconds?: number; until?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (until) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, until]);
  return null;
}

/** Subida de archivos a /api/upload (disco o S3 con URL firmada). Devuelve la clave/URL al formulario. */
export function FileUpload({
  storeId,
  purpose,
  accept,
  onUploaded,
  label = "Subir archivo",
  productId,
}: {
  storeId: string;
  purpose: "product-file" | "media" | "image" | "transfer-proof";
  accept?: string;
  onUploaded?: (r: { key: string; url: string | null; name: string; size: number; mimeType: string; id?: string }) => void;
  label?: string;
  productId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  return (
    <div>
      <label className={`btn btn-secondary btn-sm cursor-pointer ${busy ? "opacity-60" : ""}`}>
        {busy ? `Subiendo… ${progress}%` : label}
        <input
          type="file"
          className="sr-only"
          accept={accept}
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(null);
            setProgress(0);
            try {
              const result = await uploadFile({ storeId, purpose, file, productId, onProgress: setProgress });
              onUploaded?.(result);
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}

export async function uploadFile({
  storeId,
  purpose,
  file,
  productId,
  onProgress,
  orderId,
  accessKey,
}: {
  storeId: string;
  purpose: string;
  file: File;
  productId?: string;
  onProgress?: (n: number) => void;
  orderId?: string;
  accessKey?: string;
}) {
  const init = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step: "init", storeId, purpose, productId, orderId, accessKey, name: file.name, size: file.size, type: file.type || "application/octet-stream" }),
  });
  const plan = await init.json();
  if (!init.ok) throw new Error(plan.error || "No se pudo subir el archivo");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(plan.method || "PUT", plan.uploadUrl);
    if (plan.headers) for (const [k, v] of Object.entries(plan.headers as Record<string, string>)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress?.(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Error al subir (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Error de red al subir el archivo"));
    xhr.send(file);
  });
  const done = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step: "complete", storeId, purpose, productId, orderId, accessKey, key: plan.key, name: file.name, size: file.size, type: file.type || "application/octet-stream" }),
  });
  const result = await done.json();
  if (!done.ok) throw new Error(result.error || "No se pudo registrar el archivo");
  return result as { key: string; url: string | null; name: string; size: number; mimeType: string; id?: string };
}

/** Input de imagen: URL editable + subir a Recursos. */
export function ImageInput({ storeId, name, defaultValue, label }: { storeId: string; name: string; defaultValue?: string | null; label?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-line-2 bg-paper" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input name={name} value={value} onChange={(e) => setValue(e.target.value)} className="input" placeholder="https://…" />
          <FileUpload storeId={storeId} purpose="image" accept="image/*" label="Subir imagen" onUploaded={(r) => r.url && setValue(r.url)} />
        </div>
      </div>
    </div>
  );
}
