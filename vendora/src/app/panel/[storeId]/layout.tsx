import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireStorePage } from "@/lib/auth";
import { storeBaseUrl } from "@/lib/stores";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "view");
  const url = storeBaseUrl(store);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${store.status === "ACTIVE" ? "bg-ok" : "bg-bad"}`} />
          <span className="truncate font-semibold">{store.name}</span>
          <span className="hidden truncate text-muted sm:inline">{url.replace(/^https?:\/\//, "")}</span>
        </div>
        <div className="flex items-center gap-3">
          {store.testMode && (
            <Link href={`/panel/${store.id}/configuracion`} className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">
              Modo prueba
            </Link>
          )}
          {store.status !== "ACTIVE" && (
            <Link href="/panel/plan" className="rounded-full bg-bad-soft px-2.5 py-0.5 text-xs font-semibold text-bad">
              Checkout pausado{store.suspendedReason === "billing" ? " por falta de pago" : ""}
            </Link>
          )}
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
            Ver tienda <ExternalLink size={14} />
          </a>
        </div>
      </div>
      {children}
    </>
  );
}
