import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { bonusCount, upsellProducts, getStoreOwnerPlan } from "@/lib/plans";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

const TYPE_LABEL: Record<string, string> = { EBOOK: "Ebook", COURSE: "Curso", TEMPLATE: "Plantilla", AUDIO: "Audio", VIDEO: "Video", SOFTWARE: "Software", PACK: "Pack", LINK: "Link" };
const STATUS: Record<string, [string, "ok" | "neutral" | "warn"]> = { PUBLISHED: ["Publicado", "ok"], DRAFT: ["Borrador", "warn"], ARCHIVED: ["Archivado", "neutral"] };
const VIS: Record<string, string> = { PUBLIC: "En la tienda", HIDDEN: "Oculto (solo link)", POSTPURCHASE_ONLY: "Solo post-compra" };

export default async function ProductsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "products");
  const products = await db.product.findMany({
    where: { storeId },
    include: { _count: { select: { files: true, modules: true, bonuses: true, orderItems: { where: { status: "PAID" } } } } },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  const plan = await getStoreOwnerPlan(storeId);
  const [bonuses, upsells] = await Promise.all([bonusCount(storeId), upsellProducts(storeId)]);
  return (
    <>
      <PageHeader
        title="Productos"
        description={`Bonos ${bonuses}/${plan.maxBonusesPerStore} · Upsells ${upsells.size}/${plan.maxUpsellsPerStore} (plan ${plan.name})`}
        actions={
          <>
            <Link href={`/panel/${storeId}/ebooks`} className="btn btn-secondary">
              <Sparkles size={16} /> Ebook con IA
            </Link>
            <Link href={`/panel/${storeId}/productos/nuevo`} className="btn btn-primary">
              <Plus size={16} /> Nuevo producto
            </Link>
          </>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="Cargá tu primer producto"
          description="Ebook, curso, plantillas, audio, video, software o un pack. Subís los archivos, ponés el precio y listo."
          action={
            <Link href={`/panel/${storeId}/productos/nuevo`} className="btn btn-primary">
              Nuevo producto
            </Link>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Visibilidad</th>
                <th>Contenido</th>
                <th className="text-right">Ventas</th>
                <th className="text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const ready = p._count.files + p._count.modules > 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/panel/${storeId}/productos/${p.id}`} className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-12 w-9 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-9 rounded bg-black/5" />
                        )}
                        <span>
                          <span className="block font-semibold hover:underline">{p.name}</span>
                          <span className="flex gap-1">
                            <Badge tone={STATUS[p.status][1]}>{STATUS[p.status][0]}</Badge>
                            {store.mainProductId === p.id && <Badge tone="brand">Principal</Badge>}
                            {p._count.bonuses > 0 && <Badge tone="mint">+{p._count.bonuses} bonos</Badge>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>{TYPE_LABEL[p.type]}</td>
                    <td className="text-xs">{VIS[p.visibility]}</td>
                    <td>{ready ? <Badge tone="ok">Listo</Badge> : <Badge tone="bad">Sin contenido</Badge>}</td>
                    <td className="text-right tabular-nums">{p._count.orderItems}</td>
                    <td className="text-right tabular-nums">
                      {p.compareAtPrice && <s className="mr-1 text-xs text-muted">{formatMoney(p.compareAtPrice, store.baseCurrency)}</s>}
                      {formatMoney(p.price, store.baseCurrency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
