# Lista de verificación: función → código

Cada función de [`INVESTIGACION.md`](./INVESTIGACION.md) con el lugar donde está implementada. Rutas relativas a `vendora/`.
Columna **Prueba**: `E2E` = cubierto por `scripts/e2e.mjs` (navegador real), `UT` = cubierto por `tests/*.test.ts`, `Manual` = requiere credenciales reales de un tercero (pasarela, SMTP, Meta) para probarse de punta a punta.

## Cuenta, planes y plataforma

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F01 | Registro, login y recuperación de contraseña | `src/app/actions/auth.ts`, `src/app/(auth)/{login,registro,recuperar,restablecer/[token]}/page.tsx`, `src/lib/auth.ts` (bcrypt + sesión JWT `vd_session` + tabla `Session`), `src/lib/rate-limit.ts` | E2E (login) |
| F02 | Planes con límites (tiendas, bonos, upsells, ebooks IA, recuperación, equipo) | `prisma/schema.prisma` (`Plan`), `src/lib/plans.ts` (`assertCanCreateStore`, `ownedStoreCount`, `assertBonusLimit`, límites de upsells), `src/lib/bootstrap.ts` (`DEFAULT_PLANS`), `src/app/panel/plan/page.tsx`, `src/app/panel/actions/account.ts` (`changePlanAction` → `changePlan` de `src/lib/billing.ts`) | E2E (límite de tiendas) |
| F03 | Prueba gratis de planes pagos | `src/lib/billing.ts` (`inTrial`, `changePlan`: `trialEndsAt`), `src/app/panel/plan/page.tsx`, `src/app/panel/page.tsx` (aviso) | Manual |
| F04 | Comisión por venta según plan (0 % PayPal/transferencia) | `src/lib/orders.ts` (`approvePayment` → `CommissionEntry`), `src/lib/billing.ts` (`billUser`, `runBilling`, `markInvoicePaid`, `invoicePaymentUrl`, suspensión por mora), `src/app/api/webhooks/platform/[provider]/route.ts`, `src/app/admin/facturas/page.tsx` | Manual |
| F05 | Varias tiendas por cuenta | `src/app/panel/nueva/page.tsx`, `src/app/panel/actions/stores.ts` (`createStoreAction`, `deleteStoreAction`), `src/components/panel/nav.tsx` (selector), `src/lib/auth.ts` (`getUserStores`) | E2E |
| F06 | Equipo y roles (dueño, admin, editor, soporte, analista) | `src/lib/auth.ts` (`ROLE_PERMISSIONS`, `can`, `requireStorePage`), `src/app/panel/[storeId]/equipo/page.tsx`, `src/app/panel/actions/settings.ts` (invitaciones), `src/app/(auth)/invitacion/[token]/page.tsx` | Manual |
| F07 | Panel de administración de la plataforma | `src/app/admin/{page,usuarios,tiendas,facturas,planes,correos,correos/[id],tipos-de-cambio}`, `src/app/admin/actions.ts`, `requireSuperadmin` en `src/lib/auth.ts` | E2E |
| F08 | Cuota mensual de ebooks con IA | `src/lib/plans.ts` (`aiEbooksUsed`), `src/app/panel/actions/ebooks.ts`, `src/app/panel/[storeId]/ebooks/page.tsx`, `src/app/panel/plan/page.tsx` | E2E (consumo) |

## Tienda

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F10 | Tienda en subdominio | `src/middleware.ts` (modo `STORE_ROOT_DOMAIN`, reescritura a `/t/{slug}`), `src/lib/stores.ts` (`storeUrl`) | E2E (modo ruta `/t/slug`) |
| F11 | Dominio propio | `src/middleware.ts` (búsqueda por `customDomain` con caché), `src/app/panel/[storeId]/configuracion/page.tsx`, `src/app/panel/actions/stores.ts` | Manual (DNS) |
| F12 | Tipo de tienda: tienda o checkout | `Store.type` en el esquema, `src/app/t/[store]/page.tsx` (tipo CHECKOUT abre el checkout del producto principal), `src/app/panel/[storeId]/configuracion/page.tsx` | E2E |
| F13 | Idioma y zona horaria | `src/lib/i18n.ts` (10 idiomas), `Store.language`/`timezone`, `src/components/ui.tsx` (`fmtDate` con zona), `src/lib/metrics.ts` (días en la zona de la tienda) | UT (legales en 10 idiomas) |
| F14 | Contexto IA y SEO | `Store.aiContext`, `metaTitle`/`metaDescription`, `src/app/t/[store]/layout.tsx` (`generateMetadata`), `src/lib/ai.ts` (usa el contexto en cada generación), `src/app/panel/[storeId]/configuracion/page.tsx` | E2E |
| F15 | Inicio "Productos y precios" (catálogo) | `src/app/t/[store]/page.tsx`, `src/components/store/chrome.tsx` | E2E |
| F16 | Landing con HTML propio (`{{price}}`, `{{currency}}`…) | `src/app/panel/[storeId]/contenido/page.tsx`, `src/app/panel/actions/stores.ts` (`updateLandingAction`), `src/app/t/[store]/vista/landing/route.ts`, `src/lib/store-page.ts` (tokens + script de seguimiento + CSP sandbox) | E2E |
| F17 | Páginas legales (términos, privacidad, reembolsos) | `src/lib/legal.ts` (10 idiomas), `src/app/t/[store]/{terminos,privacidad,reembolsos}/page.tsx`, `src/components/store/legal-page.tsx`, texto propio en `contenido` | UT + E2E |
| F18 | Recursos (biblioteca de archivos) | `src/app/panel/[storeId]/recursos/page.tsx`, `src/app/api/upload/route.ts` (`media`/`image`), `src/app/media/[...key]/route.ts`, modelo `MediaAsset` | E2E (carga) |
| F19 | Duplicar tienda (lanzar en otro mercado) | `src/lib/duplicate.ts` (`duplicateStore`, `copyProduct`), `src/app/panel/actions/stores.ts` | Manual |
| F20 | Editor visual y plantillas | `src/components/panel/block-editor.tsx`, `src/lib/blocks.ts` (`TEMPLATES`, `sanitizeBlocks`), `src/components/store/sales-page.tsx`, pestaña "Página de venta" en `src/app/panel/[storeId]/productos/[productId]/page.tsx` | UT + E2E |
| F21 | Tienda generada con IA | `src/lib/ai.ts`, `src/lib/ai-jobs.ts` (`processAiJob` tipo `STORE`), `src/app/panel/nueva/page.tsx` (modo IA), `src/app/panel/nueva/ia/[jobId]/page.tsx` | E2E (con servidor IA simulado) |

## Productos

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F30 | Tipos de producto digital | `ProductType` en `prisma/schema.prisma`, `src/app/panel/[storeId]/productos/nuevo/page.tsx` | E2E |
| F31 | Archivos del producto y estado del contenido | Pestaña "Contenido y entrega" de `src/app/panel/[storeId]/productos/[productId]/page.tsx`, `src/app/api/upload/route.ts` + `api/upload/local/route.ts`, `src/lib/storage.ts` (disco o S3) | E2E |
| F32 | Precio y precio tachado | `src/lib/pricing.ts` (`productPrice`, `percentOff`), pestaña "Precios y markets" | UT |
| F33 | Bonos incluidos | Modelo `ProductBonus`, `BonusesTab` en la página del producto, `addBonusAction`, `assertBonusLimit`, ítems `BONUS` en `src/lib/orders.ts` | E2E |
| F34 | Producto solo post-compra | `Visibility.POSTPURCHASE_ONLY`; `src/lib/orders.ts` y `src/app/t/[store]/p/[product]/page.tsx` no lo venden directo | E2E |
| F35 | Tapas de ebooks | `src/lib/cover.ts` (SVG → PNG con fuentes DejaVu, texto medido), `generateCoverFor` en `src/lib/ai-jobs.ts`, `aiCoverAction` | UT + E2E |
| F36 | Ebooks con IA (PDF) | `src/lib/ai-jobs.ts` (tipo `EBOOK`), `src/lib/pdf.ts` (pdfkit), `src/app/panel/[storeId]/ebooks/page.tsx`, `src/app/panel/actions/ebooks.ts` | E2E |
| F37 | Cursos y área de miembros | Modelos `CourseModule`/`CourseLesson`/`LessonProgress`; tarjeta "Curso: módulos y lecciones" en la página del producto; `src/app/t/[store]/mis-compras/{page,[productId]/page}.tsx` | E2E (área de miembros) |
| F38 | Página de venta con IA | `src/lib/ai-jobs.ts` (tipo `SALES_PAGE`), `aiSalesPageAction` en `src/app/panel/actions/products.ts` | Manual (clave de IA) |

## Markets y monedas

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F40 | Markets multidivisa (país → moneda, tipo de cambio, redondeo, precio propio) | `src/app/panel/[storeId]/markets/page.tsx`, `src/lib/geo.ts` (`pickMarket`), `src/lib/money.ts` (`applyRounding`), `ProductMarketPrice`, `src/lib/fx.ts` + `src/app/admin/tipos-de-cambio/page.tsx` | UT |
| F41 | Cobrar en la moneda del comprador | `chargeFor` en `src/lib/gateways/index.ts`, `availableGateways` en `src/lib/checkout.ts` (aviso "se cobra como…") | UT (conversión) |

## Checkout

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F50 | Checkout con campos configurables | `CheckoutSettings` en `src/lib/store-settings.ts`, `src/app/panel/[storeId]/checkout/page.tsx`, `src/components/store/checkout-client.tsx`, `src/lib/checkout.ts` (`quoteCheckout`, `loadCheckoutPage`), `src/app/api/checkout/{session,pay}/route.ts` | E2E |
| F51 | Order bump | Modelo `OrderBump`, `src/app/panel/[storeId]/checkout/page.tsx`, `src/components/store/checkout-client.tsx`, ítems `BUMP` en `src/lib/orders.ts` | E2E |
| F52 | Prueba social y cuenta regresiva | `socialProof`/`countdown` en `CheckoutSettings`, `src/components/store/checkout-client.tsx`, `src/components/store/countdown.tsx` | Manual |
| F53 | Bloque de texto del checkout | `Product.checkoutTitle`/`checkoutSubtitle` (página del producto) y `footerNote` del checkout; `src/components/store/checkout-view.tsx` | E2E |
| F54 | UTMs hasta el checkout | `src/lib/tracker.ts` (último toque, decora links a /checkout), `src/components/store/checkout-client.tsx`, `Order.utm`, `src/lib/metrics.ts` (`utmTable`) | E2E + UT |
| F55 | Cupones | `src/app/panel/[storeId]/marketing/cupones/page.tsx`, `src/lib/pricing.ts` (`couponIsValid`, `couponDiscount`), `quoteCheckout` | E2E + UT |
| F56 | Tests A/B de checkout (tiendas tipo checkout) | Modelo `CheckoutTest`, `src/app/panel/[storeId]/marketing/ab/page.tsx`, `src/lib/checkout.ts` (asignación de variante), `abVariant` en eventos y pedidos | Manual |

## Pasarelas de pago

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F60 | Mercado Pago (Checkout Pro + webhook firmado) | `src/lib/gateways/mercadopago.ts` (`createPayment`, `verifySignature`, `fetchPayment`, `refund`), `src/app/api/webhooks/[provider]/[gatewayId]/route.ts` | UT (firma) · Manual |
| F61 | Stripe (Payment Element, 3DS, tarjeta guardada) | `src/lib/gateways/stripe.ts`, `StripeBox` en `src/components/store/checkout-client.tsx`, webhook | Manual |
| F62 | PayPal (Orders v2) | `src/lib/gateways/paypal.ts` (`createPayment`, `capture`, `verifyWebhook`, `refund`), `src/app/t/[store]/pago/[orderId]/page.tsx` | Manual |
| F63 | Whop (Standard Webhooks) | `src/lib/gateways/whop.ts` (`createPayment`, `verifyAndParse`, `eventToStatus`) | UT (firma) · Manual |
| F64 | Transferencia bancaria manual con comprobante | `TRANSFER` en `src/lib/gateways/index.ts`, `src/app/t/[store]/pago/[orderId]/page.tsx` + `src/components/store/buyer-client.tsx` (subida), `approveTransfer` en `src/lib/orders.ts`, `src/app/panel/[storeId]/ventas/[orderId]/page.tsx` | E2E |
| F65 | Cobro multidivisa propio | Cubierto con Stripe por market (`chargeFor`) | Manual |
| — | Pasarela de prueba (modo prueba) | `TEST` en `src/lib/gateways/index.ts`, `src/app/t/[store]/pago/[orderId]/simulador/page.tsx` | E2E |

## Embudos post-compra

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F70 | Embudo de upsells/downsells en árbol | Modelos `Funnel`/`FunnelNode`, `src/app/panel/[storeId]/embudos/{page,[funnelId]/page}.tsx`, `src/app/panel/actions/funnels.ts`, `src/lib/funnels.ts` (`getOfferState`, `acceptOffer`, `declineOffer`) | E2E |
| F71 | Upsell 1-click | `acceptOffer` en `src/lib/funnels.ts` (Stripe off-session con método guardado; prueba nativa; MP/PayPal/Whop por redirección), `confirmStripeOffer`, `src/app/api/offer/route.ts` | E2E (prueba) |
| F72 | Disparador (siempre / por productos) y prioridad | `pickFunnel` en `src/lib/funnel-core.ts` | E2E |
| F73 | Reserva con timer y acción al vencer | `reservationMinutes`/`onTimerExpire`, `src/app/t/[store]/oferta/[orderId]/page.tsx`, `src/components/store/countdown.tsx` | E2E |
| F74 | Descuento con "comparar contra" | `offerPrice` en `src/lib/pricing.ts`, `nodePrice` en `src/lib/funnel-core.ts` | UT |
| F75 | Textos editables con variables | Campos del nodo + `fill` de `src/lib/i18n.ts` en la página de oferta | E2E |
| F76 | Oferta con HTML propio | `src/app/t/[store]/vista/oferta/[orderId]/route.ts` (tokens `{{accept_url}}`, `{{decline_url}}`, `{{timer}}`…) | Manual |
| F77 | Estadísticas por oferta y reinicio | `funnelStats` + `OfferImpression` en `src/lib/funnel-core.ts`, `statsResetAt`, acción "Reiniciar estadísticas" | E2E (impresiones) |
| F78 | Tests A/B de oferta | `FunnelNodeVariant`, `applyVariant`, `abWinner` en `src/lib/funnel-core.ts`, `src/app/panel/[storeId]/marketing/ab/page.tsx` | Manual |
| F79 | Pausar / activar embudo | `Funnel.status`, `src/app/panel/actions/funnels.ts` | Manual |
| F80 | Página de gracias editable | `ThankYouSettings` (+ `thankYouOverride` por embudo), `src/app/t/[store]/gracias/[orderId]/page.tsx` | E2E |
| F81 | Copiar embudo a otra tienda | `copyFunnel` en `src/lib/duplicate.ts`, `duplicateFunnelAction` (respeta el límite del plan) | Manual |

## Entrega

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F90 | Entrega automática por email | `src/lib/delivery.ts`, `src/lib/email.ts` (SMTP o registro en `EmailMessage`), `approvePayment` en `src/lib/orders.ts` | E2E |
| F91 | Links que vencen y tope de descargas | `DeliverySettings` (`linkExpiryHours`, `maxDownloads`), modelo `Download`, `src/app/t/[store]/d/[token]/route.ts`, `src/app/t/[store]/mis-compras/descargar/[downloadId]/route.ts`, "Restablecer descargas" en el pedido | E2E |
| F92 | Área de miembros con enlace mágico | `src/app/api/members/login/route.ts`, `src/app/t/[store]/mis-compras/{page,ingresar/route,salir/route,[productId]/page}.tsx`, `src/lib/buyer.ts` | E2E |
| F93 | Aviso de entrega | `Product.deliveryNotice` en checkout y página de venta | E2E |

## Recuperación de carritos

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F100 | Emails de recuperación (secuencia + cupón + link precargado) | `src/lib/recovery.ts` (`runRecovery`), `src/lib/cron.ts`, `src/app/api/cron/route.ts`, `src/app/t/[store]/recuperar/[checkoutId]/page.tsx`, ajustes en `src/app/panel/[storeId]/carritos/page.tsx` | E2E |
| F101 | Carritos con potencial de recuperación | `src/app/panel/[storeId]/carritos/page.tsx`, `cartStats` en `src/lib/metrics.ts` | E2E |

## Métricas y tracking

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F110 | Panel de métricas (ingresos, ventas, ticket, conversión, embudo) | `src/lib/metrics.ts` (`summary`, `dailySeries`, `topProducts`, `parseRange`), `src/app/panel/[storeId]/page.tsx`, `src/components/panel/charts.tsx` | E2E |
| F111 | Campañas UTM | `utmTable` en `src/lib/metrics.ts`, tabla del dashboard y de la app | E2E |
| F112 | Meta Pixel + API de Conversiones (dedup por `event_id`), GA4, TikTok | `src/lib/tracker.ts` (navegador), `src/lib/tracking.ts` (servidor, CAPI), `src/app/panel/[storeId]/marketing/pixel/page.tsx`, `src/app/api/track/route.ts` | UT (script) · Manual (Meta) |
| F113 | Ventas con estado de pago, reembolsos y exportación | `src/app/panel/[storeId]/ventas/{page,[orderId]/page}.tsx`, `src/app/panel/actions/orders.ts` (`refundAction`, reenviar accesos) + `refundOrder` en `src/lib/orders.ts`, `src/app/api/export/[storeId]/[kind]/route.ts` (CSV) | E2E |

## App y otros

| ID | Función | Implementación | Prueba |
|---|---|---|---|
| F120 | App del dueño (PWA, solo lectura, aviso por venta) | `src/app/app/page.tsx`, `src/app/manifest.ts`, `public/sw.js`, `src/components/push-toggle.tsx`, `src/app/api/push/route.ts`, `src/lib/push.ts` (web-push VAPID) | E2E (carga) · Manual (push) |
| F130 | Clientes | Modelo `Customer`, `src/app/panel/[storeId]/clientes/page.tsx`, exportación CSV | E2E |
| F140 | Aviso de venta al vendedor (email + push) | `notifySale` en `src/lib/orders.ts`, `NotifySettings`, `User.notifyEmailOnSale` | E2E (email registrado) |

## Verificación ejecutada

- `npx tsc --noEmit` sin errores · `npm run build` OK (Next.js 15, todas las rutas).
- `npm test`: 42 pruebas unitarias OK (precios, redondeos, cupones, cifrado, firmas de Mercado Pago y Whop, sanitizado de bloques, script de seguimiento, legales en 10 idiomas, markets, tapas).
- `npm run e2e`: 21/21 pasos OK con Chromium real contra el servidor de producción (compra con bump + cupón, upsell rechazado → downsell aceptado 1-click, descarga PDF, enlace mágico, transferencia aprobada desde el panel, tienda y producto nuevos, landing HTML, recuperación por cron, tienda + ebook con IA, administración y todas las secciones del panel).
- Servidor standalone (`node .next/standalone/server.js`, igual que la imagen Docker) respondiendo con fuentes y binarios nativos incluidos.
