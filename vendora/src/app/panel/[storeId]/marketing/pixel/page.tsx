import { requireStorePage } from "@/lib/auth";
import { savePixelAction, testCapiAction } from "../../../actions/marketing";
import { ActionButton, ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Card, Field, Notice, PageHeader } from "@/components/ui";

export default async function PixelPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "marketing");
  return (
    <>
      <PageHeader title="Píxel y tracking" description="Meta Pixel + API de Conversiones con deduplicación, Google Analytics 4 y TikTok Pixel. Los UTM de cada visita viajan hasta el checkout y quedan en cada venta." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Meta (Facebook / Instagram)" className="lg:col-span-2">
          <ActionForm action={savePixelAction.bind(null, storeId)} className="grid gap-4">
            <Field label="ID del píxel (conjunto de datos)">
              <input name="metaPixelId" defaultValue={store.metaPixelId ?? ""} className="input" placeholder="1536567021570502" />
            </Field>
            <Field label="Token de la API de Conversiones" hint={store.metaCapiTokenEnc ? "Hay un token guardado (cifrado). Dejá vacío para conservarlo." : "Administrador de eventos → Configuración → Integración directa → Generar identificador de acceso."}>
              <input name="metaCapiToken" type="password" autoComplete="off" className="input" placeholder={store.metaCapiTokenEnc ? "••••••••••••" : "EAAB…"} />
            </Field>
            {store.metaCapiTokenEnc && <Toggle name="clearToken" label="Borrar el token guardado" />}
            <Field label="Código de prueba (Probar eventos)" hint="Mientras esté cargado, los eventos del servidor van a la pestaña Probar eventos.">
              <input name="metaTestEventCode" defaultValue={store.metaTestEventCode ?? ""} className="input" placeholder="TEST12345" />
            </Field>
            <Field label="Google Analytics 4 (ID de medición)">
              <input name="ga4Id" defaultValue={store.ga4Id ?? ""} className="input" placeholder="G-XXXXXXX" />
            </Field>
            <Field label="TikTok Pixel">
              <input name="tiktokPixelId" defaultValue={store.tiktokPixelId ?? ""} className="input" placeholder="C123ABC…" />
            </Field>
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card title="Probar la API de Conversiones">
            <p className="mb-3 text-sm text-muted">Envía un evento de prueba desde el servidor para confirmar que el token funciona.</p>
            <ActionButton action={testCapiAction.bind(null, storeId)} className="btn btn-secondary btn-sm">
              Enviar evento de prueba
            </ActionButton>
          </Card>
          <Notice title="Eventos que se envían">
            Navegador: PageView, ViewContent, InitiateCheckout, AddPaymentInfo y Purchase. Servidor (API de Conversiones): InitiateCheckout cuando dejan el email y Purchase por cada pago aprobado (incluye upsells), con el mismo event_id para deduplicar, email/teléfono/nombre hasheados, IP, navegador, fbp y fbc.
          </Notice>
        </div>
      </div>
    </>
  );
}
