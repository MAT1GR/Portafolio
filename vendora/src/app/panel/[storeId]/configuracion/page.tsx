import { requireStorePage, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, appHost } from "@/lib/env";
import { LANGUAGES } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money";
import { getDeliverySettings, getNotifySettings } from "@/lib/store-settings";
import { storeBaseUrl } from "@/lib/stores";
import { deleteStoreAction, duplicateStoreAction, updateDeliveryAction, updateGeneralAction } from "../../actions/stores";
import { ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Card, Field, Notice, PageHeader } from "@/components/ui";

const TIMEZONES = ["America/Argentina/Buenos_Aires", "America/Montevideo", "America/Santiago", "America/Bogota", "America/Lima", "America/Mexico_City", "America/New_York", "America/Sao_Paulo", "Europe/Madrid", "Europe/Rome", "Europe/Berlin", "Europe/Paris", "Europe/Lisbon", "Europe/London", "Europe/Bucharest", "Europe/Prague", "Europe/Budapest", "Europe/Warsaw", "UTC"];

export default async function SettingsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store, role } = await requireStorePage(storeId, "settings");
  const products = await db.product.findMany({ where: { storeId, status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const delivery = getDeliverySettings(store);
  const notify = getNotifySettings(store);
  return (
    <>
      <PageHeader title="Configuración" description={storeBaseUrl(store)} />
      <div className="space-y-6">
        <Card title="General">
          <ActionForm action={updateGeneralAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <input name="name" defaultValue={store.name} required className="input" />
            </Field>
            <Field label="Subdominio" hint={env.storeRootDomain ? `${store.slug}.${env.storeRootDomain}` : `${env.appUrl}/t/${store.slug}`}>
              <input name="slug" defaultValue={store.slug} className="input" />
            </Field>
            <Field label="Tipo de tienda" hint="Checkout: la raíz abre directo el checkout del producto principal y habilita los tests A/B de checkout.">
              <select name="type" defaultValue={store.type} className="input">
                <option value="STORE">Tienda (landing + checkout)</option>
                <option value="CHECKOUT">Checkout</option>
              </select>
            </Field>
            <Field label="Producto principal" hint="Abre en /checkout y alimenta {{price}} en la landing.">
              <select name="mainProductId" defaultValue={store.mainProductId ?? ""} className="input">
                <option value="">—</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Idioma de la tienda">
              <select name="language" defaultValue={store.language} className="input">
                {Object.entries(LANGUAGES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zona horaria">
              <select name="timezone" defaultValue={store.timezone} className="input">
                {[...new Set([store.timezone, ...TIMEZONES])].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Moneda base (precios de productos)">
              <select name="baseCurrency" defaultValue={store.baseCurrency} className="input">
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Dominio propio" hint={`Creá un CNAME de tu dominio apuntando a ${env.storeRootDomain ? `${store.slug}.${env.storeRootDomain}` : appHost()} y conectalo en tu hosting.`}>
              <input name="customDomain" defaultValue={store.customDomain ?? ""} className="input" placeholder="tienda.midominio.com" />
            </Field>
            <Field label="Título SEO">
              <input name="metaTitle" defaultValue={store.metaTitle ?? ""} className="input" />
            </Field>
            <Field label="Meta descripción">
              <input name="metaDescription" defaultValue={store.metaDescription ?? ""} className="input" />
            </Field>
            <Field label="Contexto IA" hint="Marca, público, tono, promesa y palabras a evitar. Lo usa la IA en todo lo que genera para esta tienda." className="sm:col-span-2">
              <textarea name="aiContext" defaultValue={store.aiContext ?? ""} rows={4} className="input" />
            </Field>
            <div className="space-y-1 sm:col-span-2">
              <Toggle name="testMode" defaultChecked={store.testMode} label="Modo prueba" hint="Habilita la pasarela simulada para probar el flujo completo. Desactivalo antes de publicitar." />
              <Toggle name="noindex" defaultChecked={store.noindex} label="Ocultar de buscadores (noindex)" hint="Para landings de remarketing o tiendas de prueba." />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <Card title="Entrega y avisos">
          <ActionForm action={updateDeliveryAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Los links de descarga vencen a las (horas)" hint="Vacío = no vencen">
              <input name="linkExpiryHours" type="number" min={1} defaultValue={delivery.linkExpiryHours ?? ""} className="input" />
            </Field>
            <Field label="Descargas máximas por archivo" hint="Vacío = sin tope">
              <input name="maxDownloads" type="number" min={1} defaultValue={delivery.maxDownloads ?? ""} className="input" />
            </Field>
            <Field label="Mensaje extra en el email de entrega" className="sm:col-span-2">
              <textarea name="extraMessage" defaultValue={delivery.extraMessage} rows={2} className="input" placeholder="Sumate al grupo privado: https://…" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle name="emailOnSale" defaultChecked={notify.emailOnSale} label="Avisarme por email cada venta" />
              <Toggle name="emailOnTransfer" defaultChecked={notify.emailOnTransfer} label="Avisarme cuando suben un comprobante de transferencia" />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        {can(role, "danger") && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Duplicar tienda" description="Copia configuración, markets, pagos, productos con sus archivos, bonos, bumps, embudos, cupones y contenido. Ideal para lanzar en otro país o idioma.">
              <ActionForm action={duplicateStoreAction.bind(null, storeId)} className="flex flex-wrap gap-2">
                <input name="name" required defaultValue={`${store.name} (copia)`} className="input max-w-xs" />
                <SubmitButton className="btn btn-secondary" pending="Duplicando…">
                  Duplicar
                </SubmitButton>
              </ActionForm>
            </Card>
            <Card title="Eliminar tienda">
              <div className="mb-3">
                <Notice tone="bad">Si la tienda tiene ventas, se cierra (los compradores conservan su acceso). Si no, se borra todo.</Notice>
              </div>
              <ActionForm action={deleteStoreAction.bind(null, storeId)} className="flex flex-wrap gap-2">
                <input name="confirm" placeholder={`Escribí ${store.slug}`} className="input max-w-xs" />
                <SubmitButton className="btn btn-danger">Eliminar</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
