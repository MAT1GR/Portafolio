import Link from "next/link";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCheckoutSettings } from "@/lib/store-settings";
import { offerPrice } from "@/lib/pricing";
import { formatMoney, num } from "@/lib/money";
import { storeUrl } from "@/lib/stores";
import { deleteBumpAction, saveBumpAction, updateCheckoutSettingsAction } from "../../actions/marketing";
import { ActionButton, ActionForm, CopyButton, ImageInput, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, PageHeader } from "@/components/ui";

export default async function CheckoutSettingsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "marketing");
  const s = getCheckoutSettings(store);
  const products = await db.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, include: { marketPrices: true }, orderBy: { name: "asc" } });
  const bumps = await db.orderBump.findMany({ where: { storeId }, include: { mainProduct: true, offerProduct: { include: { marketPrices: true } } }, orderBy: [{ mainProductId: "asc" }, { sortOrder: "asc" }] });
  const main = products.find((p) => p.id === store.mainProductId);
  const productOptions = products.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ));
  const bumpForm = (b?: (typeof bumps)[number]) => (
    <ActionForm action={saveBumpAction.bind(null, storeId, b?.id ?? null)} className="grid grid-cols-1 gap-3 sm:grid-cols-2" reset={!b}>
      <Field label="Se muestra en el checkout de">
        <select name="mainProductId" defaultValue={b?.mainProductId ?? store.mainProductId ?? ""} required className="input">
          <option value="">Elegí un producto</option>
          {productOptions}
        </select>
      </Field>
      <Field label="Producto que se suma">
        <select name="offerProductId" defaultValue={b?.offerProductId ?? ""} required className="input">
          <option value="">Elegí un producto</option>
          {productOptions}
        </select>
      </Field>
      <Field label="Precio">
        <select name="pricingMode" defaultValue={b?.pricingMode ?? "DISCOUNT"} className="input">
          <option value="DISCOUNT">% de descuento</option>
          <option value="FIXED">Precio fijo (moneda base)</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Descuento %">
          <input name="discountPercent" type="number" min={0} max={100} defaultValue={b?.discountPercent ?? 50} className="input" />
        </Field>
        <Field label="Precio fijo">
          <input name="fixedPrice" inputMode="decimal" defaultValue={b?.fixedPrice ? num(b.fixedPrice) : ""} className="input" />
        </Field>
      </div>
      <Field label="Comparar el descuento contra" hint="Precio de tienda = el precio de venta del producto (no el tachado).">
        <select name="compareAgainst" defaultValue={b?.compareAgainst ?? "STORE_PRICE"} className="input">
          <option value="STORE_PRICE">Precio de tienda</option>
          <option value="COMPARE_AT">Precio tachado</option>
        </select>
      </Field>
      <Field label="Encabezado">
        <input name="headline" required defaultValue={b?.headline ?? "Sumalo a tu pedido (solo acá):"} className="input" />
      </Field>
      <Field label="Texto del botón">
        <input name="buttonText" required defaultValue={b?.buttonText ?? "+ Completá tu kit"} className="input" />
      </Field>
      <Field label="Descripción">
        <input name="description" defaultValue={b?.description ?? ""} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <ImageInput storeId={storeId} name="imageUrl" defaultValue={b?.imageUrl} label="Imagen (vacío = tapa del producto)" />
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Toggle name="timerEnabled" defaultChecked={b?.timerEnabled ?? false} label="Timer de la oferta" />
        <label className="flex items-center gap-2 text-sm">
          Minutos <input name="timerMinutes" type="number" min={1} defaultValue={b?.timerMinutes ?? 10} className="input w-20 py-1.5" />
        </label>
        <Toggle name="active" defaultChecked={b?.active ?? true} label="Activo" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{b ? "Guardar bump" : "Crear order bump"}</SubmitButton>
      </div>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title="Checkout y order bumps"
        description="Campos del formulario, prueba social, contadores y ofertas que se suman con un clic antes de pagar."
        actions={main && <CopyButton value={storeUrl(store, "/checkout")} label="Copiar link de /checkout" />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Formulario y elementos del checkout">
          <ActionForm action={updateCheckoutSettingsAction.bind(null, storeId)} className="space-y-3">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              <Toggle name="askName" defaultChecked={s.askName} label="Pedir nombre" />
              <Toggle name="requireName" defaultChecked={s.requireName} label="Nombre obligatorio" />
              <Toggle name="askPhone" defaultChecked={s.askPhone} label="Pedir teléfono" />
              <Toggle name="requirePhone" defaultChecked={s.requirePhone} label="Teléfono obligatorio" />
              <Toggle name="showCoupon" defaultChecked={s.showCoupon} label="Campo de cupón" />
              <Toggle name="showGuarantee" defaultChecked={s.showGuarantee} label={`Mostrar garantía (${store.guaranteeDays} días)`} />
              <Toggle name="showSecureBadges" defaultChecked={s.showSecureBadges} label="Sellos de pago seguro" />
            </div>
            <p className="text-xs text-muted">Pedir solo el email es lo que menos fricción genera: el resto es opcional.</p>
            <div className="rounded-2xl border border-line p-3">
              <Toggle name="spEnabled" defaultChecked={s.socialProof.enabled} label="Barra “X personas mirando esta oferta”" hint="Número aleatorio entre el mínimo y el máximo. Usala con criterio." />
              <div className="mt-2 flex gap-2">
                <input name="spMin" type="number" min={1} defaultValue={s.socialProof.min} className="input w-24 py-1.5" aria-label="Mínimo" />
                <input name="spMax" type="number" min={1} defaultValue={s.socialProof.max} className="input w-24 py-1.5" aria-label="Máximo" />
              </div>
            </div>
            <div className="rounded-2xl border border-line p-3">
              <Toggle name="cdEnabled" defaultChecked={s.countdown.enabled} label="Cuenta regresiva en el checkout" hint="Empieza cuando la persona entra. Solo si la oferta realmente vence." />
              <input name="cdMinutes" type="number" min={1} defaultValue={s.countdown.minutes} className="input mt-2 w-24 py-1.5" aria-label="Minutos" />
            </div>
            <Field label="Texto del botón de pago">
              <input name="buttonText" defaultValue={s.buttonText} className="input" placeholder="Pagar ahora" />
            </Field>
            <Field label="Nota al pie del botón">
              <input name="footerNote" defaultValue={s.footerNote} className="input" placeholder="Recibís el PDF al instante en tu email" />
            </Field>
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Nuevo order bump" description="Una oferta complementaria que se agrega con un clic dentro del checkout.">
          {bumpForm()}
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Order bumps ({bumps.length})</h2>
      <div className="space-y-3">
        {bumps.map((b) => {
          const price = offerPrice(b.offerProduct, b, null, store.baseCurrency);
          return (
            <details key={b.id} className="card p-4">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{b.offerProduct.name}</b> <span className="text-sm text-muted">en el checkout de {b.mainProduct.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {price.compareAt && <s className="mr-1 text-muted">{formatMoney(price.compareAt, price.currency)}</s>}
                    <b>{formatMoney(price.price, price.currency)}</b>
                  </span>
                  {b.active ? <Badge tone="ok">Activo</Badge> : <Badge>Pausado</Badge>}
                </span>
              </summary>
              <div className="mt-4 border-t border-line pt-4">
                {bumpForm(b)}
                <div className="mt-3">
                  <ActionButton action={deleteBumpAction.bind(null, storeId, b.id)} className="btn btn-danger btn-sm" confirm="¿Eliminar el order bump?">
                    Eliminar
                  </ActionButton>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      {!main && (
        <p className="mt-6 text-sm text-muted">
          Elegí el producto principal de la tienda en <Link href={`/panel/${storeId}/configuracion`} className="underline">Configuración</Link> para que /checkout funcione.
        </p>
      )}
    </>
  );
}
