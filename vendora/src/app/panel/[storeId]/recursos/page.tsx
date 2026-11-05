import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteMediaAction } from "../../actions/settings";
import { ActionButton, CopyButton, FileUpload } from "@/components/client";
import { EmptyState, PageHeader, fmtDate } from "@/components/ui";

export default async function MediaPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "content");
  const media = await db.mediaAsset.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Recursos" description="Imágenes, videos y archivos alojados en tu tienda para usar en la landing, la página de venta y las ofertas." actions={<FileUpload storeId={storeId} purpose="media" label="Subir archivo" />} />
      {media.length === 0 ? (
        <EmptyState title="Sin recursos" description="Subí imágenes (tapas, mockups, fotos de la landing) y copiá su URL para usarlas donde quieras." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="card overflow-hidden">
              <div className="grid aspect-square place-items-center bg-paper">
                {m.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.name} className="h-full w-full object-contain" />
                ) : m.mimeType.startsWith("video/") ? (
                  <video src={m.url} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-muted">{m.mimeType}</span>
                )}
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-medium" title={m.name}>
                  {m.name}
                </div>
                <div className="text-xs text-muted">
                  {(m.size / 1024).toFixed(0)} KB · {fmtDate(m.createdAt, store.timezone, false)}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <CopyButton value={m.url} label="Copiar URL" />
                  <ActionButton action={deleteMediaAction.bind(null, storeId, m.id)} className="btn btn-ghost btn-sm text-bad" confirm="¿Eliminar? Si se usa en alguna página, va a dejar de verse.">
                    Borrar
                  </ActionButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
