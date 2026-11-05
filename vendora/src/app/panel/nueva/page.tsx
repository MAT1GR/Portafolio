import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { LANGUAGES } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/money";
import { createStoreAction, createStoreAiAction } from "../actions/stores";
import { ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Card, Field, Notice, PageHeader, Tabs } from "@/components/ui";
import { ownedStoreCount } from "@/lib/plans";

export const metadata = { title: "Nueva tienda" };

export default async function NewStorePage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const user = await requireUser();
  const { modo } = await searchParams;
  const ai = modo === "ia";
  const count = await ownedStoreCount(user.id);
  const atLimit = count >= user.plan.maxStores;
  const langOptions = Object.entries(LANGUAGES).map(([k, v]) => (
    <option key={k} value={k}>
      {v.label}
    </option>
  ));
  const currencyOptions = CURRENCIES.map((c) => (
    <option key={c} value={c}>
      {c}
    </option>
  ));
  return (
    <>
      <PageHeader title="Nueva tienda" back={{ href: "/panel", label: "Mis tiendas" }} />
      <Tabs
        active={ai ? "ia" : "manual"}
        items={[
          { key: "ia", href: "/panel/nueva?modo=ia", label: "✨ Crear con IA" },
          { key: "manual", href: "/panel/nueva", label: "Crear a mano" },
        ]}
      />
      {atLimit && (
        <div className="mb-5">
          <Notice tone="warn" title="Llegaste al límite de tiendas de tu plan">
            Tu plan {user.plan.name} permite {user.plan.maxStores} tienda(s).{" "}
            <Link href="/panel/plan" className="underline">
              Mejorá tu plan
            </Link>{" "}
            para crear más.
          </Notice>
        </div>
      )}
      {ai ? (
        <Card title="Contale a la IA qué querés vender" description="Arma nombre, colores, producto principal, página de venta, bonos, order bump, upsell y tapa. Todo queda en borrador para que lo revises.">
          {!aiConfigured() && (
            <div className="mb-4">
              <Notice tone="warn">La IA no está configurada en este servidor. Cargá ANTHROPIC_API_KEY en las variables de entorno.</Notice>
            </div>
          )}
          <ActionForm action={createStoreAiAction} className="grid gap-4">
            <Field label="Idea del producto" hint="Ej.: guía para que mamás le expliquen la primera menstruación a su hija de 9 a 12 años.">
              <textarea name="idea" required rows={4} className="input" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Público">
                <input name="audience" className="input" placeholder="Mamás de 30 a 45 años" />
              </Field>
              <Field label="Tono">
                <input name="tone" className="input" placeholder="Cálido, claro, sin tecnicismos" />
              </Field>
              <Field label="Idioma de la tienda">
                <select name="language" defaultValue="es" className="input">
                  {langOptions}
                </select>
              </Field>
              <Field label="Moneda base">
                <select name="baseCurrency" defaultValue="USD" className="input">
                  {currencyOptions}
                </select>
              </Field>
              <Field label="Tipo">
                <select name="type" className="input">
                  <option value="STORE">Tienda (landing + checkout)</option>
                  <option value="CHECKOUT">Solo checkout (para landings externas)</option>
                </select>
              </Field>
            </div>
            <Toggle name="withEbook" defaultChecked label="Escribir también el ebook en PDF" hint="Usa 1 ebook con IA de tu cuota mensual." />
            <div>
              <SubmitButton className="btn btn-brand" pending="Enviando a la IA…">
                <Sparkles size={16} /> Crear tienda con IA
              </SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <Card title="Datos básicos" description="Después podés cambiar todo desde Configuración.">
          <ActionForm action={createStoreAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre de la tienda">
              <input name="name" required className="input" />
            </Field>
            <Field label="Subdominio" hint="Se genera del nombre si lo dejás vacío.">
              <input name="slug" className="input" placeholder="mitienda" />
            </Field>
            <Field label="Tipo">
              <select name="type" className="input">
                <option value="STORE">Tienda (landing + checkout)</option>
                <option value="CHECKOUT">Solo checkout</option>
              </select>
            </Field>
            <Field label="Idioma">
              <select name="language" defaultValue="es" className="input">
                {langOptions}
              </select>
            </Field>
            <Field label="Moneda base (precios del catálogo)">
              <select name="baseCurrency" defaultValue="USD" className="input">
                {currencyOptions}
              </select>
            </Field>
            <Field label="Zona horaria">
              <input name="timezone" defaultValue="America/Argentina/Buenos_Aires" className="input" />
            </Field>
            <Field label="Market adicional (opcional)" hint="Ej.: Argentina en ARS para cobrar con Mercado Pago.">
              <select name="marketCurrency" defaultValue="" className="input">
                <option value="">Ninguno</option>
                {currencyOptions}
              </select>
            </Field>
            <Field label="Países del market" hint="Códigos separados por coma: AR, UY">
              <input name="marketCountries" className="input" placeholder="AR" />
            </Field>
            <input type="hidden" name="marketName" value="Market local" />
            <div className="sm:col-span-2">
              <SubmitButton pending="Creando…">Crear tienda</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
