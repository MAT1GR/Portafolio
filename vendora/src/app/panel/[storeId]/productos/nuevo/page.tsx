import { requireStorePage } from "@/lib/auth";
import { TEMPLATES } from "@/lib/blocks";
import { createProductAction } from "../../../actions/products";
import { ActionForm, SubmitButton } from "@/components/client";
import { Card, Field, PageHeader } from "@/components/ui";

const TYPES = [
  ["EBOOK", "Ebook / PDF"],
  ["COURSE", "Curso (área de miembros)"],
  ["TEMPLATE", "Plantillas"],
  ["AUDIO", "Audio"],
  ["VIDEO", "Video"],
  ["SOFTWARE", "Software"],
  ["PACK", "Pack de archivos"],
  ["LINK", "Acceso por link"],
];

export default async function NewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "products");
  return (
    <>
      <PageHeader title="Nuevo producto" back={{ href: `/panel/${storeId}/productos`, label: "Productos" }} />
      <Card>
        <ActionForm action={createProductAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <input name="name" required className="input" />
          </Field>
          <Field label="Tipo">
            <select name="type" className="input">
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Visibilidad">
            <select name="visibility" className="input">
              <option value="PUBLIC">En la tienda</option>
              <option value="HIDDEN">Oculto (solo con link, ideal para bonos y bumps)</option>
              <option value="POSTPURCHASE_ONLY">Solo post-compra (upsell / downsell)</option>
            </select>
          </Field>
          <Field label={`Precio (${store.baseCurrency})`}>
            <input name="price" inputMode="decimal" required className="input" placeholder="19.99" />
          </Field>
          <Field label="Precio tachado (opcional)">
            <input name="compareAtPrice" inputMode="decimal" className="input" />
          </Field>
          <Field label="Descripción corta" className="sm:col-span-2">
            <textarea name="shortDescription" rows={2} className="input" />
          </Field>
          <Field label="Texto del checkout" hint='Ej.: "Libro digital para imprimir" o "Ebook en PDF"'>
            <input name="checkoutSubtitle" className="input" />
          </Field>
          <Field label="Plantilla de página de venta">
            <select name="template" className="input">
              <option value="">Sin página (usar la descripción)</option>
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name} — {t.description}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pending="Creando…">Crear producto</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
