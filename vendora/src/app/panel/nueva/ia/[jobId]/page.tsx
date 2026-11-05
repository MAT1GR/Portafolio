import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/client";
import { Card, Notice, PageHeader } from "@/components/ui";

export default async function AiJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const user = await requireUser();
  const job = await db.aiJob.findFirst({ where: { id: (await params).jobId, userId: user.id } });
  if (!job) notFound();
  const out = (job.output ?? {}) as { storeId?: string; productId?: string; ebookJobId?: string };
  const ebook = out.ebookJobId ? await db.aiJob.findUnique({ where: { id: out.ebookJobId } }) : null;
  const running = job.status === "QUEUED" || job.status === "RUNNING" || (ebook && (ebook.status === "QUEUED" || ebook.status === "RUNNING"));
  return (
    <>
      <PageHeader title="Creando tu tienda con IA" back={{ href: "/panel", label: "Mis tiendas" }} />
      <AutoRefresh seconds={3} until={!running} />
      <Card>
        <Step label="Tienda, producto, página de venta, bonos, bump y upsell" status={job.status} progress={job.progress} message={job.message} error={job.error} />
        {ebook && <Step label="Ebook en PDF" status={ebook.status} progress={ebook.progress} message={ebook.message} error={ebook.error} />}
        {job.status === "DONE" && out.storeId && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={`/panel/${out.storeId}/productos/${out.productId}`} className="btn btn-brand">
              Revisar el producto
            </Link>
            <Link href={`/panel/${out.storeId}`} className="btn btn-secondary">
              Ir a la tienda
            </Link>
          </div>
        )}
        {job.status === "DONE" && (
          <div className="mt-4">
            <Notice>Todo quedó en borrador y en modo prueba. Revisá los textos, publicá el producto, conectá un medio de pago real y desactivá el modo prueba.</Notice>
          </div>
        )}
      </Card>
    </>
  );
}

function Step({ label, status, progress, message, error }: { label: string; status: string; progress: number; message: string | null; error: string | null }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">{status === "DONE" ? "Listo" : status === "FAILED" ? "Error" : `${progress}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div className={`h-full transition-all ${status === "FAILED" ? "bg-bad" : "bg-brand"}`} style={{ width: `${status === "DONE" ? 100 : Math.max(4, progress)}%` }} />
      </div>
      <p className={`mt-1.5 text-xs ${status === "FAILED" ? "text-bad" : "text-muted"}`}>{status === "FAILED" ? error : message || "En cola…"}</p>
    </div>
  );
}
