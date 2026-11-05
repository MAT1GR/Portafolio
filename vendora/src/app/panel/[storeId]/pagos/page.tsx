import type { GatewayProvider } from "@prisma/client";
import { requireStorePage } from "@/lib/auth";
import { db } from "@/lib/db";
import { GATEWAYS, gatewayCreds, gatewaySettings } from "@/lib/gateways";
import { webhookUrl } from "@/lib/orders";
import { env } from "@/lib/env";
import { saveGatewayAction } from "../../actions/settings";
import { ActionForm, CopyButton, SubmitButton, Toggle } from "@/components/client";
import { Badge, Card, Field, Notice, PageHeader } from "@/components/ui";

const ORDER: GatewayProvider[] = ["MERCADOPAGO", "STRIPE", "PAYPAL", "WHOP", "TRANSFER", "TEST"];
const WEBHOOK_HELP: Partial<Record<GatewayProvider, string>> = {
  MERCADOPAGO: "Se envía sola en cada pago (notification_url). Opcional: cargala en Tus integraciones → Webhooks para validar la firma.",
  STRIPE: "Developers → Webhooks → Add endpoint. Eventos: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.refunded.",
  PAYPAL: "Developer Dashboard → tu app → Webhooks. Eventos: CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED.",
  WHOP: "Dashboard → Developer → Webhooks. Eventos: payment.succeeded, payment.failed, refund.created.",
};

export default async function PaymentsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStorePage(storeId, "payments");
  const gateways = await db.paymentGateway.findMany({ where: { storeId } });
  const markets = await db.market.findMany({ where: { storeId, active: true } });
  const currencies = [...new Set([store.baseCurrency, ...markets.map((m) => m.currency)])];
  return (
    <>
      <PageHeader title="Medios de pago" description={`El dinero entra directo en tu cuenta de cada pasarela. Monedas de esta tienda: ${currencies.join(", ")}. La comisión de la plataforma no aplica a PayPal ni a transferencias.`} />
      <div className="space-y-4">
        {ORDER.map((provider) => {
          const info = GATEWAYS[provider];
          const g = gateways.find((x) => x.provider === provider);
          const creds = g ? gatewayCreds(g) : {};
          const settings = g ? gatewaySettings(g) : {};
          const hook = g ? webhookUrl(provider, g.id) : null;
          if (provider === "TEST" && !env.allowTestPayments) return null;
          return (
            <details key={provider} className="card p-5" open={!g && provider !== "TEST" && gateways.length <= 1}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{info.label}</b>
                  <span className="ml-2 text-sm text-muted">{info.description}</span>
                </span>
                <span className="flex gap-1">
                  {info.oneClick === "native" && provider !== "TEST" && <Badge tone="mint">Upsell 1-click</Badge>}
                  {!info.commission && <Badge>0 % comisión</Badge>}
                  {g?.enabled ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}
                </span>
              </summary>
              <ActionForm action={saveGatewayAction.bind(null, storeId, provider)} className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
                {provider === "TEST" && (
                  <div className="sm:col-span-2">
                    <Notice tone="warn">Solo se ofrece mientras la tienda está en modo prueba (Configuración). Los pedidos quedan marcados como prueba y no generan comisión ni cuentan en métricas.</Notice>
                  </div>
                )}
                {provider === "MERCADOPAGO" && (
                  <div className="sm:col-span-2">
                    <Notice>Mercado Pago cobra en la moneda de tu cuenta: para Argentina creá un market en ARS (Markets y monedas) y asignale tus países.</Notice>
                  </div>
                )}
                {info.credentialFields.map((f) => (
                  <Field key={f.key} label={f.label} hint={f.help}>
                    <input
                      name={`c_${f.key}`}
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      defaultValue={f.secret ? "" : creds[f.key] ?? ""}
                      placeholder={f.secret && creds[f.key] ? "•••••••• (guardado)" : f.placeholder}
                      className="input"
                    />
                  </Field>
                ))}
                {info.settingFields.map((s) =>
                  s.type === "boolean" ? (
                    <div key={s.key} className="sm:col-span-2">
                      <Toggle name={`s_${s.key}`} defaultChecked={Boolean(settings[s.key])} label={s.label} />
                    </div>
                  ) : s.type === "select" ? (
                    <Field key={s.key} label={s.label}>
                      <select name={`s_${s.key}`} defaultValue={String(settings[s.key] ?? s.options?.[0]?.value ?? "")} className="input">
                        {s.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : s.type === "textarea" ? (
                    <Field key={s.key} label={s.label} className="sm:col-span-2">
                      <textarea name={`s_${s.key}`} defaultValue={String(settings[s.key] ?? "")} rows={5} placeholder={s.placeholder} className="input" />
                    </Field>
                  ) : (
                    <Field key={s.key} label={s.label}>
                      <input name={`s_${s.key}`} type={s.type === "number" ? "number" : "text"} defaultValue={String(settings[s.key] ?? "")} placeholder={s.placeholder} className="input" />
                    </Field>
                  ),
                )}
                <Field label="Nombre visible en el checkout (opcional)">
                  <input name="displayName" defaultValue={g?.displayName ?? ""} className="input" placeholder={info.label} />
                </Field>
                <Field label="Orden">
                  <input name="sortOrder" type="number" defaultValue={g?.sortOrder ?? ORDER.indexOf(provider)} className="input" />
                </Field>
                {info.webhook && (
                  <div className="rounded-xl bg-paper p-3 text-xs sm:col-span-2">
                    <div className="mb-1 font-semibold">URL del webhook</div>
                    {hook ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="break-all">{hook}</code>
                        <CopyButton value={hook} />
                      </div>
                    ) : (
                      <span className="text-muted">Guardá la pasarela para generar la URL.</span>
                    )}
                    <p className="mt-1 text-muted">{WEBHOOK_HELP[provider]}</p>
                  </div>
                )}
                <div className="flex items-center gap-4 sm:col-span-2">
                  <Toggle name="enabled" defaultChecked={g?.enabled ?? false} label="Activo en el checkout" />
                  <SubmitButton>Guardar</SubmitButton>
                </div>
              </ActionForm>
            </details>
          );
        })}
      </div>
    </>
  );
}
