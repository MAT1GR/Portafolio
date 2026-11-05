import Link from "next/link";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { storeUrl } from "@/lib/stores";
import { getThankYouSettings } from "@/lib/store-settings";
import { legalSections } from "@/lib/legal";
import { updateBrandAction, updateLandingAction, updateLegalAction, updateThankYouAction } from "../../actions/stores";
import { ActionForm, ImageInput, SubmitButton } from "@/components/client";
import { Card, Field, Notice, PageHeader, Tabs } from "@/components/ui";

export default async function ContentPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { storeId } = await params;
  const tab = (await searchParams).tab || "landing";
  const { store } = await requireStorePage(storeId, "content");
  const ty = getThankYouSettings(store);
  const main = store.mainProductId ? await db.product.findUnique({ where: { id: store.mainProductId } }) : null;
  const base = `/panel/${storeId}/contenido`;
  return (
    <>
      <PageHeader title="Contenido" description="Landing de la tienda (portada estándar o HTML propio), marca, página de gracias y textos legales." />
      <Tabs
        active={tab}
        items={[
          { key: "landing", href: `${base}?tab=landing`, label: "Landing" },
          { key: "marca", href: `${base}?tab=marca`, label: "Marca y portada" },
          { key: "gracias", href: `${base}?tab=gracias`, label: "Página de gracias" },
          { key: "legales", href: `${base}?tab=legales`, label: "Legales y contacto" },
        ]}
      />
      {tab === "landing" && (
        <Card
          title="Landing de la tienda"
          description="Lo que se ve al entrar a la tienda. Usá HTML propio para una landing a medida; los botones tienen que apuntar a /checkout."
          actions={
            <a href={storeUrl(store, "/")} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
              Ver
            </a>
          }
        >
          {!main && (
            <div className="mb-4">
              <Notice tone="warn">
                Elegí el producto principal en <Link href={`/panel/${storeId}/configuracion`} className="underline">Configuración</Link>: es el que abre /checkout y el que toman {"{{price}}"} y {"{{currency}}"}.
              </Notice>
            </div>
          )}
          <ActionForm action={updateLandingAction.bind(null, storeId)} className="space-y-3">
            <select name="landingMode" defaultValue={store.landingMode} className="input max-w-sm">
              <option value="DEFAULT">Portada estándar (catálogo de productos)</option>
              <option value="CUSTOM_HTML">HTML propio</option>
            </select>
            <p className="text-xs text-muted">
              Tokens: {"{{price}}"} {"{{compare_price}}"} {"{{currency}}"} {"{{checkout_url}}"} {"{{product_name}}"} {"{{store_name}}"}. El seguimiento de visitas, los UTM hacia el checkout y el píxel se agregan solos.
            </p>
            <textarea name="landingHtml" defaultValue={store.landingHtml ?? ""} rows={18} className="input font-mono text-xs" placeholder="<!doctype html>…" />
            <SubmitButton>Guardar landing</SubmitButton>
          </ActionForm>
        </Card>
      )}
      {tab === "marca" && (
        <Card title="Marca y portada estándar">
          <ActionForm action={updateBrandAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageInput storeId={storeId} name="logoUrl" defaultValue={store.logoUrl} label="Logo" />
            <ImageInput storeId={storeId} name="bannerUrl" defaultValue={store.bannerUrl} label="Imagen de portada" />
            <Field label="Color principal (botones)">
              <input name="primaryColor" type="color" defaultValue={store.primaryColor} className="h-11 w-24 rounded-lg border border-line" />
            </Field>
            <Field label="Color de contraste (títulos y fondos oscuros)">
              <input name="accentColor" type="color" defaultValue={store.accentColor} className="h-11 w-24 rounded-lg border border-line" />
            </Field>
            <Field label="Titular de la portada" className="sm:col-span-2">
              <input name="headline" defaultValue={store.headline ?? ""} className="input" />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <textarea name="description" defaultValue={store.description ?? ""} rows={3} className="input" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
      {tab === "gracias" && (
        <Card title="Página de gracias" description="Se muestra al terminar la compra y el embudo. Cada embudo puede tener la suya.">
          <ActionForm action={updateThankYouAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Título" hint="Vacío = texto por defecto en el idioma de la tienda">
              <input name="title" defaultValue={ty.title} className="input" placeholder="¡Compra confirmada!" />
            </Field>
            <Field label="Mensaje" hint="Usá {email} y {name}">
              <input name="message" defaultValue={ty.message} className="input" placeholder="Te enviamos los accesos a {email}" />
            </Field>
            <Field label="Texto del botón">
              <input name="buttonText" defaultValue={ty.buttonText} className="input" placeholder="Volver a la tienda" />
            </Field>
            <Field label="URL del botón">
              <input name="buttonUrl" defaultValue={ty.buttonUrl} className="input" placeholder="https://…" />
            </Field>
            <Field label="Redirigir automáticamente a (opcional)" className="sm:col-span-2" hint="A los 5 segundos. Útil para un grupo de WhatsApp o una página de bienvenida.">
              <input name="redirectUrl" defaultValue={ty.redirectUrl} className="input" placeholder="https://…" />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
      {tab === "legales" && (
        <Card title="Datos legales y de contacto" description="Con estos datos se generan los términos, la privacidad y la política de reembolsos en el idioma de la tienda. Podés reemplazar cualquiera con tu propio texto.">
          <ActionForm action={updateLegalAction.bind(null, storeId)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Razón social / titular">
              <input name="legalName" defaultValue={store.legalName ?? ""} className="input" />
            </Field>
            <Field label="CUIT / Tax ID">
              <input name="legalTaxId" defaultValue={store.legalTaxId ?? ""} className="input" />
            </Field>
            <Field label="Dirección">
              <input name="legalAddress" defaultValue={store.legalAddress ?? ""} className="input" />
            </Field>
            <Field label="Días de garantía">
              <input name="guaranteeDays" type="number" min={0} max={365} defaultValue={store.guaranteeDays} className="input" />
            </Field>
            <Field label="Email de soporte">
              <input name="supportEmail" type="email" defaultValue={store.supportEmail ?? ""} className="input" />
            </Field>
            <Field label="WhatsApp de soporte">
              <input name="supportWhatsapp" defaultValue={store.supportWhatsapp ?? ""} className="input" placeholder="+54 9 341 …" />
            </Field>
            {(["termsText", "privacyText", "refundText"] as const).map((k) => {
              const kind = k === "termsText" ? "terms" : k === "privacyText" ? "privacy" : "refunds";
              return (
                <Field key={k} label={k === "termsText" ? "Términos (texto propio)" : k === "privacyText" ? "Privacidad (texto propio)" : "Reembolsos (texto propio)"} className="sm:col-span-2" hint="Vacío = texto generado automáticamente">
                  <textarea name={k} defaultValue={store[k] ?? ""} rows={4} className="input" placeholder={legalSections(store, kind).map(([t, b]) => `${t}: ${b}`).join("\n\n").slice(0, 400) + "…"} />
                </Field>
              );
            })}
            <div className="sm:col-span-2">
              <SubmitButton>Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
