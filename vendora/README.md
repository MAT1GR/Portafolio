# Vendora

Plataforma para vender productos digitales (ebooks, cursos, plantillas, packs): tienda o checkout por producto creado a mano o con IA, checkout de alta conversión con order bumps y cupones, embudos post-compra con upsells 1-click, entrega automática con links que vencen y área de miembros, recuperación de carritos, markets multidivisa, métricas por campaña UTM con Meta Pixel + API de Conversiones, equipo con roles, app instalable con aviso de cada venta y panel de administración con facturación de planes y comisiones.

- Especificación funcional (investigación función por función): [`docs/INVESTIGACION.md`](docs/INVESTIGACION.md)
- Lista de verificación función → código: [`docs/CHECKLIST.md`](docs/CHECKLIST.md)

## Stack y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| App | **Next.js 15 (App Router) + React 19 + TypeScript** | Un solo proyecto para panel, tiendas públicas, API y webhooks; render en servidor (SEO y velocidad del checkout), server actions para formularios sin API extra. |
| Base de datos | **PostgreSQL + Prisma 6** | Datos relacionales (pedidos, ítems, pagos, embudos) con transacciones; migraciones versionadas; funciona con Neon, Supabase, RDS o local. |
| Estilos | **Tailwind CSS 4** | Diseño propio consistente sin librería de componentes pesada. |
| Pagos | SDK oficial de **Stripe** + API REST de **Mercado Pago**, **PayPal** (Orders v2) y **Whop**; **transferencia** manual | Cubren Argentina/LatAm (MP), tarjetas internacionales con 1-click real (Stripe), PayPal y cobro en USD sin empresa en EE. UU. (Whop). |
| IA | **Claude** (`@anthropic-ai/sdk`, modelo `claude-opus-5-5` por defecto) con salida JSON validada por esquema | Genera tienda, producto, página de venta, ebook completo y tapa. |
| PDF y tapas | **pdfkit** + **resvg** con fuentes DejaVu incluidas | Ebooks en PDF y tapas PNG sin depender de fuentes del sistema ni de servicios externos. |
| Archivos | Disco local o **S3 compatible** (S3, Cloudflare R2, MinIO) con URLs firmadas | Subidas grandes directas al bucket; descargas privadas firmadas. |
| Emails | **SMTP** (nodemailer) | Cualquier proveedor (SES, Resend, Brevo, Gmail). Sin SMTP se guardan en `/admin/correos`. |
| Push | **Web Push (VAPID)** + PWA | "App" del dueño instalable en iOS/Android sin publicar en tiendas. |

## Requisitos

- Node.js 22 o superior y npm.
- PostgreSQL 14 o superior.

## Instalación local

```bash
cd vendora
```

```bash
npm install
```

```bash
cp .env.example .env
```

Editá `.env`: como mínimo `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY` y `CRON_SECRET` (generá cada secreto con `openssl rand -hex 32`). Después:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Abrí http://localhost:3000. El seed crea:

- **Administrador**: `admin@vendora.local` / `vendora1234` (o `ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`), con plan Escala y rol de superadmin.
- **Tienda demo** en http://localhost:3000/t/demo, en modo prueba, con producto principal, bono, order bump (50 %), embudo upsell → downsell, cupón `BIENVENIDA10`, markets USD/ARS/EUR y la pasarela "Modo prueba" para recorrer todo el flujo sin cobrar.

Para que las tareas periódicas (recuperación de carritos, facturación, cola de IA, tipos de cambio) corran en local, dejá abierto en otra terminal:

```bash
npm run worker
```

## Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. |
| `APP_URL` | URL pública del panel, sin barra final (se usa en emails, webhooks y links). |
| `STORE_ROOT_DOMAIN` | Dominio raíz de las tiendas (`tiendas.tudominio.com` → `slug.tiendas.tudominio.com`). Vacío: las tiendas viven en `/t/slug`. |
| `NEXT_PUBLIC_BRAND_NAME` | Nombre de la marca en toda la app. |
| `AUTH_SECRET` | Firma de sesiones y links (**obligatorio en producción**, 16+ caracteres). |
| `ENCRYPTION_KEY` | Cifra (AES-256-GCM) las credenciales de las pasarelas y tokens guardados. No la cambies después de cargar credenciales. |
| `CRON_SECRET` | Protege `/api/cron` (`Authorization: Bearer …`). |
| `ADMIN_EMAIL` | Ese email queda como superadmin al registrarse o al correr el seed. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envío de emails. |
| `STORAGE_DRIVER` | `local` (disco) o `s3`. |
| `LOCAL_STORAGE_DIR` | Carpeta de archivos con el driver local. |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | Bucket S3/R2. `S3_PUBLIC_URL` es la URL pública para imágenes. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_EFFORT` | Funciones de IA. Sin clave, las opciones de IA avisan que no están configuradas. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificaciones push (generalas con `npm run vapid`). |
| `PLATFORM_STRIPE_SECRET_KEY`, `PLATFORM_STRIPE_WEBHOOK_SECRET` | Cobro de facturas de la plataforma con tarjeta. |
| `PLATFORM_MP_ACCESS_TOKEN`, `PLATFORM_MP_WEBHOOK_SECRET` | Cobro de facturas de la plataforma con Mercado Pago (en ARS). |
| `BILLING_DUE_DAYS`, `BILLING_GRACE_DAYS` | Vencimiento de facturas y días de gracia antes de suspender tiendas. |
| `ALLOW_TEST_PAYMENTS` | `false` desactiva la pasarela de prueba en toda la plataforma. |
| `FX_API_URL` | Opcional: API de tipos de cambio (`{ "rates": { "ARS": 1450, … } }` con base USD). Sin ella se usan los cargados en `/admin/tipos-de-cambio`. |

## Configuración por tienda (desde el panel)

- **Medios de pago** (`Panel → Medios de pago`): pegás las credenciales de cada pasarela (quedan cifradas). Cada una muestra su URL de webhook (`APP_URL/api/webhooks/{proveedor}/{id}`) y qué eventos activar:
  - **Mercado Pago**: Access Token de producción. La URL de notificación se envía sola en cada pago; opcionalmente cargá la clave secreta del webhook para validar la firma `x-signature`.
  - **Stripe**: Secret key, Publishable key y secreto del webhook (`payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`). Habilita upsells 1-click sin volver a pedir la tarjeta.
  - **PayPal**: Client ID, Secret y Webhook ID (`CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`).
  - **Whop**: API key, Company ID y secreto del webhook (`payment.succeeded`, `payment.failed`, `refund.created`).
  - **Transferencia**: datos bancarios; el comprador sube el comprobante y aprobás el pago desde el pedido.
- **Dominio propio** (`Configuración`): el vendedor crea un registro CNAME de su dominio hacia el host de la app y lo carga en la tienda; el middleware lo reconoce automáticamente (el certificado lo emite el hosting: Vercel, Caddy, Cloudflare, etc.).
- **Pixel / API de Conversiones / GA4 / TikTok** (`Píxel y tracking`): ID del píxel, token de CAPI (cifrado) y código de eventos de prueba.

## Despliegue

### Opción A: Docker (VPS propio)

```bash
cp .env.example .env
```

Completá `.env` (secretos, `APP_URL`, SMTP; el `DATABASE_URL` lo pone el compose) y levantá todo:

```bash
docker compose up -d --build
```

Levanta PostgreSQL, la app (aplica las migraciones al arrancar) y un worker que llama a `/api/cron` cada minuto. Los archivos quedan en el volumen `storage`. Con la app ya arrancada, cargá los datos iniciales una sola vez:

```bash
docker compose run --rm seed
```

Poné adelante un proxy con HTTPS (Caddy, Nginx o Traefik) y, si usás subdominios, un DNS comodín `*.STORE_ROOT_DOMAIN` hacia el servidor.

### Opción B: Vercel + Neon/Supabase + Cloudflare R2

1. Base de datos en Neon o Supabase; copiá la cadena de conexión a `DATABASE_URL`.
2. Bucket en Cloudflare R2 (o S3): `STORAGE_DRIVER=s3` y las variables `S3_*`. Habilitá CORS del bucket para `PUT` desde tu dominio (las subidas van directo al bucket).
3. Importá el repositorio en Vercel con **Root Directory = `vendora`**, cargá las variables y desplegá. El build ejecuta `prisma generate && next build`.
4. Aplicá las migraciones y el seed una vez desde tu máquina (con el `DATABASE_URL` de producción):

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

5. `vercel.json` programa `/api/cron` cada 10 minutos (Vercel envía `CRON_SECRET` como Bearer). En el plan Hobby de Vercel los cron son diarios: usá un cron externo (cron-job.org, GitHub Actions) que llame `GET APP_URL/api/cron` con el header `Authorization: Bearer CRON_SECRET`.
6. Subdominios: agregá el dominio comodín `*.STORE_ROOT_DOMAIN` al proyecto de Vercel.

### Opción C: Node en un servidor

```bash
npm ci
```

```bash
npm run build
```

```bash
npm run db:migrate
```

```bash
npm start
```

Más un cron del sistema que llame a `/api/cron` cada minuto (o `npm run worker` con un gestor de procesos como pm2 o systemd).

## Pruebas

Unitarias (precios, redondeos, cupones, cifrado, firmas de webhooks, sanitizado, legales, tapas):

```bash
npm test
```

End-to-end con navegador real (Playwright/Chromium). Necesita la base sembrada, el servidor corriendo y, para la parte de IA, el servidor simulado de Claude:

```bash
node scripts/mock-anthropic.mjs 4010
```

```bash
ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run build && ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm start
```

```bash
npm run e2e
```

Recorre: landing → página de venta con UTM → checkout con bump y cupón → pago de prueba → upsell rechazado → downsell aceptado en 1-click → página de gracias → descarga del PDF → área de miembros con enlace mágico → transferencia con comprobante aprobada desde el panel → tienda y producto nuevos con archivo → landing con HTML propio → recuperación de carritos por cron → tienda + ebook con IA → panel de administración y todas las secciones del panel. Requiere `psql` en el PATH (lee y prepara datos de la base).

## Estructura

```
vendora/
├── docs/                    Investigación (especificación) y checklist función → código
├── prisma/                  Esquema, migraciones y seed
├── public/                  Íconos, service worker de la app
├── scripts/                 worker (cron), vapid, e2e, servidor simulado de IA
├── src/
│   ├── middleware.ts        Subdominios y dominios propios → tienda
│   ├── app/
│   │   ├── page.tsx         Landing de Vendora
│   │   ├── (auth)/          Login, registro, recuperación, invitaciones
│   │   ├── panel/           Panel del vendedor (tiendas, productos, checkout, embudos, métricas…)
│   │   ├── admin/           Administración de la plataforma
│   │   ├── app/             App instalable (PWA) del dueño
│   │   ├── t/[store]/       Tienda pública: catálogo, producto, checkout, pago, ofertas, gracias, mis compras, legales
│   │   └── api/             Checkout, subidas, webhooks, cron, tracking, push, exportaciones
│   ├── components/          UI del panel y de la tienda
│   └── lib/                 Dominio: pedidos, pagos, embudos, entrega, métricas, IA, facturación…
└── tests/                   Pruebas unitarias (vitest)
```

## Decisiones tomadas

- **Marca propia "Vendora"** (configurable con `NEXT_PUBLIC_BRAND_NAME`), con textos y diseño originales; se replican funciones, no activos.
- **App móvil → PWA** con notificaciones push: misma función (ver ventas y recibir aviso de cada venta) sin depender de App Store/Play Store.
- **Cobro de la plataforma por factura mensual** (abono + comisiones acumuladas) pagable con Stripe o Mercado Pago, con suspensión por mora, en lugar de débito automático de la tarjeta.
- **"Impul Pay" multidivisa → Stripe** cobrando en la moneda de cada market.
- **Modo prueba por tienda** con pasarela simulada para probar el flujo completo sin cobrar; los pedidos de prueba no cuentan en métricas ni comisiones y la tienda muestra un aviso visible.
