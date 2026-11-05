# Investigación de Impultienda → especificación de Vendora

Fecha: 05/11/2026. Objetivo: documentar **función por función** lo que ofrece Impultienda (impultienda.ar, también publicado como imputienda.com) para construir **Vendora**, una plataforma propia con marca, textos, diseño y código propios que cubre las mismas funciones.

## Cómo se investigó y nivel de confianza

- **Acceso directo al sitio:** la red de este entorno bloquea impultienda.ar (el proxy devuelve 403), así que el sitio se leyó a través del buscador web, que indexa su contenido: home, `/dashboard`, tiendas de ejemplo (`*.impultienda.ar`), sus páginas legales, el dominio espejo imputienda.com (donde está la tabla de planes), la ficha de la App Store y Google Play (vía AppBrain), el blog de EspiAd y la lista de videos de YouTube.
- **Uso real:** el vault de Matías (CEREBROMATI) tiene notas de operación diaria en Impultienda (tiendas vireya, vireya2, vireyauy, vireyade; embudos, markets, order bumps, A/B). Eso confirma funciones que no están en la web pública.
- Etiquetas usadas:
  - **[Web]** confirmado en una fuente pública.
  - **[Uso real]** confirmado en las notas de uso de Impultienda del vault.
  - **[Inferido]** no verificable públicamente; se define cómo se implementa para no dejar huecos (y no se presenta como función confirmada de Impultienda).

## Qué es Impultienda (resumen)

Plataforma SaaS argentina (empresa: ZOUT TECH LLC, Miami) para **vender productos digitales** (ebooks, cursos, plantillas, audio, video, software): crea la tienda (opcionalmente con IA), cobra con Mercado Pago, Stripe, PayPal, Whop o transferencia, agrega order bumps y upsells 1-click, entrega el producto automáticamente por email, recupera carritos y mide ventas, conversión y campañas UTM. Dice tener +500.000 ventas procesadas; Store Leads estimó +2.000 tiendas activas (oct/2026). Tiene app para iPhone/Android (solo lectura) para dueños de tienda. **[Web]**

## Actores

| Actor | Qué hace |
|---|---|
| **Dueño de tienda (vendedor)** | Crea tiendas y productos, configura cobros, checkout, embudos, píxel; mira métricas. |
| **Miembro del equipo** | Opera una tienda con permisos limitados (rol). Solo en el plan más alto. |
| **Comprador final** | Visita la landing/tienda, paga en el checkout, acepta o rechaza ofertas post-compra, recibe y descarga el producto, entra al área de miembros. |
| **Administrador de la plataforma** | Opera el SaaS: usuarios, tiendas, planes, comisiones, facturas. **[Inferido]** (necesario para que la plataforma propia funcione). |

---

## 1. Cuenta, planes y facturación

### F01 — Registro, login y recuperación de contraseña
- **Qué hace:** cuenta única para el panel web y la app móvil. "Creá tu tienda gratis en minutos". **[Web]**
- **Quién:** dueño de tienda.
- **Cómo:** registro con email; la app usa "la misma cuenta del sitio" y no permite registrarse. **[Web]**
- **Vendora:** registro/login con email y contraseña (bcrypt), sesión con cookie httpOnly firmada y revocable, recuperación por email con token de un solo uso.

### F02 — Planes con límites
- **Qué hace:** cuatro planes que escalan en tiendas con IA, ebooks con IA por mes, bonos, upsells, recuperación de carritos, roles de equipo y comisión. **[Web: imputienda.com]**

| | Free | Starter | Pro | Max |
|---|---|---|---|---|
| Precio | US$ 0 | US$ 20/mes | US$ 60/mes | US$ 100/mes |
| Tiendas con IA | 1 | 2 | 3 | 5 |
| Ebooks con IA por mes | — | 4 | 6 | sin límite |
| Bonos por tienda | 1 | 2 | 3 | 5 |
| Upsells por tienda | 1 | 1 | 2 | 3 |
| Recuperación de carritos | — | — | Sí | Sí |
| Roles de equipo | — | — | — | Sí |
| Comisión por venta | 5 % | 4 % | 3 % | 2 % |

- Todos incluyen checkout, entrega automática, métricas y tracking. **[Web]**
- **[Uso real]:** el límite de upsells cuenta **productos distintos** usados como oferta post-compra ("el plan permite solo 2 upsells: hoy Papá También + Su Primer Celular", aunque el embudo tenía 6 nodos). Los bonos se ven como "bonos 3/3".
- **Vendora:** tabla `Plan` editable desde el admin, con los mismos ejes. Planes por defecto con nombres y precios propios: **Gratis** (US$0, 5 %), **Inicial** (US$19, 4 %), **Crecimiento** (US$49, 3 %), **Escala** (US$89, 2 %). Los límites se validan en el servidor al crear tiendas, bonos, ofertas, ebooks con IA, invitar miembros y activar la recuperación.

### F03 — Prueba gratis de planes pagos
- **Qué hace:** "Usá el plan elegido 45 días sin pagar. Cargás una tarjeta pero no se cobra nada hasta que termina la prueba; si cancelás antes, no pagás". El plan Free no pide tarjeta. **[Web]**
- **Vendora:** al elegir un plan pago por primera vez se activa una prueba (días configurables, 30 por defecto). Durante la prueba no se factura el abono. Al terminar, el ciclo mensual emite la factura; si el usuario vuelve a Gratis antes, no paga. La implementación cobra por factura (Stripe o Mercado Pago de la plataforma) en lugar de debitar una tarjeta guardada: cubre el mismo resultado sin guardar datos de tarjeta.

### F04 — Comisión por venta según plan
- **Qué hace:** comisión 5/4/3/2 % según plan. Aplica a ventas con Mercado Pago, Stripe y Whop; **0 % en PayPal y transferencia**. **[Web]**
- **Vendora:** cada pago aprobado genera un registro en el libro de comisiones (convertido a USD con la tabla de tipos de cambio). Se suma a la factura mensual de la plataforma. PayPal, transferencia y pagos de prueba quedan en 0 %.

### F05 — Varias tiendas por cuenta
- **Qué hace:** una cuenta maneja varias tiendas (límite por plan). **[Web] [Uso real: vireya, vireya2, vireyauy, vireyade]**
- **Vendora:** selector de tienda en el panel, vista "Mis tiendas" y métricas consolidadas.

### F06 — Equipo y roles
- **Qué hace:** "roles de equipo" en el plan Max. **[Web]** No se publican los roles. **[Inferido]**
- **Vendora:** invitación por email con roles **Administrador** (todo menos facturación y borrar la tienda), **Editor** (productos, páginas, ofertas, contenido), **Soporte** (ventas y clientes: reenviar accesos, aprobar transferencias), **Analista** (solo métricas). Solo en el plan con `teamRoles`.

### F07 — Panel de administración de la plataforma
- **[Inferido]** Necesario para operar Vendora como negocio propio.
- **Vendora:** `/admin` con resumen (GMV, comisiones, MRR, usuarios, tiendas), usuarios (cambiar plan, suspender), tiendas (suspender), facturas (marcar pagadas), planes (precios, límites, comisión, días de prueba), tipos de cambio y bandeja de correos enviados.

### F08 — Cuota mensual de ebooks con IA
- **Qué hace:** cantidad de ebooks generables con IA por mes según plan. **[Web]**
- **Vendora:** contador mensual por cuenta; se bloquea la generación al llegar al límite.

---

## 2. Tienda

### F10 — Tienda en subdominio
- **Qué hace:** cada tienda vive en `slug.impultienda.ar` (ej. nostalgico, northstar-commerce, vireya). **[Web] [Uso real]**
- **Vendora:** `slug.TU_DOMINIO_DE_TIENDAS` resuelto por middleware; además `/t/slug` funciona como ruta alternativa (útil en local o sin DNS comodín).

### F11 — Dominio propio
- **[Uso real]** ("Falta: PDF en alemán, píxel de Alemania, dominio"). Cómo se configura: **[Inferido]**.
- **Vendora:** campo "dominio personalizado" por tienda con instrucciones de DNS (CNAME); el middleware resuelve el host contra la base.

### F12 — Tipo de tienda: tienda o checkout
- **[Uso real]** "El A/B de checkout no está disponible (Vireya no es tienda tipo checkout)".
- **Vendora:** tipo **Tienda** (inicio con landing o catálogo, `/checkout` del producto principal) y tipo **Checkout** (la raíz abre directamente el checkout del producto principal, pensado para landings externas). Los tests A/B de checkout se habilitan solo en tiendas tipo Checkout, igual que en Impultienda.

### F13 — Idioma y zona horaria de la tienda
- **[Uso real]** idioma de la tienda (es, en, it, de; "Impultienda no tiene rumano") y zona horaria (Europe/Bucharest, Europe/Rome, Europe/Berlin).
- **Vendora:** textos de tienda, checkout, ofertas, emails y área de miembros en **10 idiomas**: español, inglés, portugués, italiano, francés, alemán, rumano, checo, húngaro y polaco (cubre los mercados que Matías ya opera). Zona horaria por tienda para fechas y métricas.

### F14 — Contexto IA y SEO
- **[Uso real]** "Contexto IA y meta descripción en rumano/alemán".
- **Vendora:** campo "Contexto IA" (marca, tono, público) que alimenta todas las generaciones con IA; título y meta descripción SEO; opción `noindex` (usado en la landing de remarketing).

### F15 — Inicio "Productos y precios"
- **[Web]** tiendas de ejemplo muestran el catálogo con productos y "ver en el checkout".
- **Vendora:** inicio por defecto con portada de la tienda y grilla de productos públicos con precio en la moneda del comprador.

### F16 — Contenido: landing con HTML propio
- **[Uso real]** la landing se publica en "Contenido"; los botones apuntan a `/checkout`; tokens `{{price}}` y `{{currency}}` muestran el precio local ("la landing toma el precio solo"). Se recomienda HTML propio en vez de plantillas. **[Uso real + video Sangregorio]**
- **Vendora:** editor de HTML de la landing por tienda con vista previa; tokens `{{price}}`, `{{compare_price}}`, `{{currency}}`, `{{checkout_url}}`, `{{product_name}}`, `{{store_name}}`; se inyectan solos el script de seguimiento (visitas, UTM) y el píxel.

### F17 — Páginas legales
- **[Web]** cada tienda tiene Términos, Privacidad y "Reembolso, entrega y cancelación" con empresa vendedora, email de contacto, garantía (ej. 7 días) y aviso de entrega inmediata por email.
- **Vendora:** `/terminos`, `/privacidad`, `/reembolsos` generadas desde los datos legales de la tienda (razón social, ID fiscal, dirección, email, días de garantía) en el idioma de la tienda, con opción de reemplazarlas por texto propio.

### F18 — Recursos (biblioteca de archivos)
- **[Uso real]** imágenes "subidas a Recursos" y alojadas en el hosting de Impultienda para usarlas en la landing.
- **Vendora:** biblioteca de medios por tienda: subir imágenes/videos/archivos, copiar la URL pública, borrar.

### F19 — Duplicar tienda
- **[Uso real]** "vireyade: copia de vireyauy. Pagos copiados".
- **Vendora:** "Duplicar tienda" copia configuración, markets, pasarelas, productos (con archivos), bonos, order bumps, embudos, cupones y contenido a una tienda nueva (respetando el límite de tiendas).

### F20 — Editor visual y plantillas de alta conversión
- **[Web]** "templates de alta conversión", editor visual sin código.
- **Vendora:** página de venta por bloques (portada, texto, beneficios, características, imagen, video, testimonios reales, bonos, oferta con precio, garantía, preguntas frecuentes, llamado a la acción, cuenta regresiva con fecha fija) con orden editable y vista previa; 3 plantillas de partida (Clásica, Corta, Ebook). Personalización de colores, logo y portada de la tienda.

### F21 — Tienda generada con IA
- **[Web]** "Tienda con IA": "la IA crea tu producto y tu página si aún no los tenés" (opcional).
- **Vendora:** asistente "Crear tienda con IA": a partir de idea, público, idioma y tono genera nombre, colores, contexto IA, producto principal con página de venta, bonos, order bump y upsell sugeridos (todo en borrador para revisar). Usa Claude (Anthropic). No inventa testimonios ni cifras.

---

## 3. Productos y contenido

### F30 — Tipos de producto digital
- **[Web]** ebooks, cursos, plantillas, audio, video, software y packs, siempre entregados en forma digital.
- **Vendora:** tipos Ebook, Curso, Plantilla, Audio, Video, Software, Pack y Link externo.

### F31 — Archivos del producto y estado del contenido
- **[Uso real]** "Ver más opciones → Subir/Reemplazar PDF"; la tarjeta dice "Sin contenido" hasta subir el archivo y pasa a "Listo".
- **Vendora:** subir varios archivos (PDF, video, zip…), links externos, reemplazar y ordenar; estado "Sin contenido / Listo" visible en productos y ebooks.

### F32 — Precio y precio tachado
- **[Web] [Uso real]** precio de venta y tachado (ej. $18.990 tachado $34.990).
- **Vendora:** precio y precio tachado en la moneda base, con precios propios por market.

### F33 — Bonos incluidos
- **[Uso real]** "Los 3 bonos van incluidos en el producto principal"; "bonos 3/3"; tarjeta "3 REGALOS…".
- **Vendora:** asociar productos como bonos de otro producto; se entregan junto con la compra y se muestran en checkout y página de venta. Límite por plan.

### F34 — Producto solo post-compra
- **[Uso real]** "precio $9.990, tachado $14.990, solo post-compra".
- **Vendora:** visibilidad Pública / Oculta / Solo post-compra (no aparece en el catálogo ni tiene checkout directo).

### F35 — Diseño de ebooks: tapas
- **[Uso real]** sección "Diseño de ebooks" con tapas; "Tapa generada con IA de Impultienda"; subir tapa propia.
- **Vendora:** sección Ebooks con tapa por producto: subir imagen o **generar tapa con IA** (Claude define título, paleta y estilo; el servidor la dibuja en SVG y la convierte a PNG).

### F36 — Ebooks con IA
- **[Web]** generación de ebooks con IA con cuota mensual.
- **Vendora:** el vendedor indica tema, público, idioma, tono y cantidad de capítulos; Claude arma el índice y escribe capítulo por capítulo (en segundo plano), el servidor genera el **PDF** maquetado y lo adjunta al producto. Descuenta de la cuota mensual.

### F37 — Cursos y área de miembros
- **[Web]** una política de tienda dice: "después del pago recibís un email con acceso al área de miembros donde está el contenido".
- **Vendora:** cursos con módulos y lecciones (texto, video embebido o archivo); área de miembros en la tienda con acceso por enlace mágico al email, progreso por lección y descargas.

### F38 — Página de venta con IA
- **[Web]** la IA crea la página si no la tenés.
- **Vendora:** botón "Generar página con IA" en cada producto (usa el contexto IA de la tienda).

---

## 4. Markets y monedas

### F40 — Markets multidivisa
- **[Uso real]** "Market Rumania en RON (multidivisa con Impul Pay)", "market Česko CZK", "market Deutschland EUR (solo DE)"; producto con precio base en USD y precio por market con tachado ("RON 89,99 tachado 179,99; base USD 18,85 / 37,71").
- **Vendora:** markets por tienda (nombre, moneda, países, tipo de cambio y redondeo). Precio de cada producto por market: manual (con tachado) o convertido desde el precio base. El comprador cae en el market de su país (cabecera de geolocalización del hosting o selector).

### F41 — Cobrar en la moneda del comprador
- **[Web]** "Cobrá en tu moneda".
- **Vendora:** el checkout muestra y cobra en la moneda del market cuando la pasarela la soporta (Stripe: casi todas; Mercado Pago: la moneda de la cuenta; PayPal: su lista); si no, muestra el monto equivalente que cobrará la pasarela.

---

## 5. Checkout

### F50 — Checkout de alta conversión con campos configurables
- **[Web] [Uso real]** "dejar solo el mail como dato obligatorio".
- **Vendora:** checkout de una página con resumen del producto y bonos, campos configurables (nombre y teléfono opcionales u obligatorios; email siempre), métodos de pago habilitados, garantía y sellos de pago seguro.

### F51 — Order bump
- **[Uso real]** bump en checkout con producto, precio y tachado ("AR$4.990 tachado 9.990, -50 %"), encabezado ("Sumalo a tu pedido (solo acá):"), texto del botón ("+ Completa tu kit") y timer opcional.
- **Vendora:** order bumps por producto con precio fijo o % de descuento (comparado contra precio de tienda o tachado), encabezado, descripción, botón, imagen y timer opcional; precio por market.

### F52 — Prueba social y contadores en el checkout
- **[Uso real]** barra "X personas comprando" y timers que se pueden apagar.
- **Vendora:** interruptores para la barra de personas viendo/comprando (con rango configurable) y la cuenta regresiva del checkout. Apagados por defecto.

### F53 — Bloque de texto del checkout
- **[Uso real]** "bloque del checkout 'Digitales Buch zum Ausdrucken'".
- **Vendora:** texto/subtítulo del checkout por producto (ej. "Libro digital para imprimir").

### F54 — UTMs hasta el checkout
- **[Uso real]** requisito "UTMs pasando al checkout".
- **Vendora:** el script de la tienda guarda los UTM de la visita y los agrega a los links de `/checkout`; la venta queda atribuida a source/medium/campaign/content/term.

### F55 — Cupones de descuento
- **[Inferido]** estándar de la categoría; no aparece en las fuentes.
- **Vendora:** cupones por código (% o monto fijo), por producto, vigencia, usos máximos.

### F56 — Tests A/B de checkout
- **[Uso real]** disponibles solo en tiendas tipo checkout.
- **Vendora:** variantes A/B del checkout del producto principal (título, precio, tachado, order bump, texto del botón) con reparto 50/50 fijo por visitante y métricas por variante.

---

## 6. Pagos

### F60 — Mercado Pago **[Web]** · F61 — Stripe **[Web]** · F62 — PayPal **[Web]** · F63 — Whop (cobrar en USD sin LLC; retiros a banco o cripto) **[Web]** · F64 — Transferencia bancaria manual **[Web]**
- **Qué hacen:** el dinero entra en la cuenta del vendedor en cada plataforma. **[Web]**
- **F65 — "Impul Pay" multidivisa [Uso real]:** cobro multidivisa propio. En Vendora se cubre con **Stripe** (cobra en la moneda de cada market).
- **Vendora (cada tienda conecta sus credenciales, guardadas cifradas):**
  - **Mercado Pago:** Checkout Pro (preferencia → redirección → webhook con verificación de firma → consulta del pago).
  - **Stripe:** Payment Element en el checkout, guarda el medio de pago para el upsell 1-click, webhook firmado.
  - **PayPal:** Orders v2 (crear → aprobar → capturar), sandbox o live.
  - **Whop:** crea la configuración de checkout por API v1 y confirma por webhook (formato Standard Webhooks).
  - **Transferencia:** muestra datos bancarios; el comprador sube el comprobante; el vendedor aprueba y se dispara la entrega.
  - **Modo prueba (extra de Vendora):** pasarela simulada para probar todo el flujo sin cobrar; no genera comisión.

---

## 7. Post-compra (embudos)

### F70 — Embudo de upsells y downsells en árbol
- **[Uso real]** "UpSell 1 → acepta → UpSell 3 → rechaza → UpSell 4; rechaza → DownSell 1 → UpSell 2 → DownSell 2".
- **Vendora:** constructor de embudo con nodos Upsell/Downsell y ramas "si acepta" / "si rechaza".

### F71 — Upsell 1-click
- **[Web]** "Añadí ofertas después del pago sin volver a pedir la tarjeta".
- **Vendora:** con Stripe se cobra con el medio de pago guardado (off-session, sin volver a pedir datos; si el banco pide autenticación, se resuelve en la misma pantalla). Con Mercado Pago, PayPal y Whop se abre un pago corto con los datos ya cargados (esas pasarelas no permiten cobros sin intervención del comprador). Con transferencia la oferta suma al pedido pendiente. **[Inferido: comportamiento por pasarela]**

### F72 — Disparador del embudo
- **[Uso real]** funnel "Disparar siempre" o por producto ("trigger MPM + 3 regalos").
- **Vendora:** disparar siempre o solo si el pedido contiene ciertos productos; prioridad entre embudos.

### F73 — Reserva con timer
- **[Uso real]** "reserva 10 min"; textos "Oferta reservada para: {timer}"; duda abierta sobre qué pasa al vencer.
- **Vendora:** minutos de reserva por embudo y acción al vencer configurable: **pasar a la siguiente oferta (rama rechazo)** o ir a la página de gracias. Resuelve la duda de Matías (31 de 54 no llegaban al downsell).

### F74 — Descuento con "comparar contra"
- **[Uso real]** "widget Upsell → Descuento → Comparar contra: Precio de tienda" (había un error cobrando el tachado).
- **Vendora:** precio de la oferta = % de descuento sobre **precio de tienda** o **precio tachado**, o precio fijo; la vista previa muestra el monto final antes de guardar.

### F75 — Textos editables con variables
- **[Uso real]** "⚠️ ESPERÁ…", botones "SÍ, LO QUIERO POR {price}" / "No, gracias", timer "{timer}", gracias "{email}".
- **Vendora:** título, subtítulo, cuerpo, imagen/video, botones y texto del timer editables con `{price}`, `{compare_price}`, `{timer}`, `{email}`, `{product}`.

### F76 — HTML propio en la oferta
- **[Uso real]** "Marketing → Apps → Postcompra → editar oferta → HTML propio" (ruleta, trivia, etc.).
- **Vendora:** modo HTML propio por oferta con tokens `{{accept_url}}`, `{{decline_url}}`, `{{price}}`, `{{compare_price}}`, `{{timer}}`, `{{product_name}}`, `{{email}}`.

### F77 — Estadísticas por oferta y reinicio
- **[Uso real]** "UpSell 1: 233 vistas, 6,87 %, $472/visita"; botón "Reiniciar estadísticas".
- **Vendora:** por nodo: vistas, aceptadas, % de aceptación, facturado y $/visita; reinicio por embudo (sin borrar ventas).

### F78 — Tests A/B de oferta post-compra
- **[Uso real]** "Marketing → Tests A/B": variantes A/B de una oferta; "pide 7 días y 30 upsells cobrados por versión para decidir".
- **Vendora:** variantes A/B por nodo (descuento, textos o HTML), asignación 50/50, métricas por variante y aviso de ganador cuando cada versión tiene ≥7 días y ≥30 cobros.

### F79 — Pausar/activar embudo **[Uso real]**
### F80 — Página de gracias editable
- **[Uso real]** "Nákup dokončen! / Odkazy ke stažení vám pošleme na {email} / Zpět do obchodu".
- **Vendora:** título, mensaje con `{email}`, texto del botón y URL de redirección opcional por tienda (y por embudo).

### F81 — Copiar embudo a otra tienda
- **[Uso real]** "Embudo de upsells CZ copiado de vireya" (se hizo a mano). **[Inferido: como función]**
- **Vendora:** "Duplicar embudo" en la misma tienda o en otra de la cuenta.

---

## 8. Entrega

### F90 — Entrega automática por email
- **[Web]** apenas se paga llega un email con un enlace seguro de descarga.
- **Vendora:** al aprobarse cada pago se crean los accesos y se envía el email (en el idioma de la tienda) con links de descarga, bonos y acceso al área de miembros; reenvío manual desde la venta.

### F91 — Links que vencen y tope de descargas
- **[Web]** "links que pueden vencer y tope de descargas".
- **Vendora:** por tienda: vencimiento en horas (o nunca) y descargas máximas por archivo; los links son tokens aleatorios, y el área de miembros permite pedir uno nuevo.

### F92 — Área de miembros **[Web]** (ver F37).

### F93 — Aviso de entrega
- **[Uso real]** checklist "aviso de entrega cargado (qué recibe, por dónde, dentro de las 24 h)".
- **Vendora:** texto de aviso de entrega por producto, visible en checkout y en la página de gracias.

---

## 9. Recuperación de carritos

### F100 — Emails de recuperación
- **[Web]** recuperación de carritos (planes Pro y Max) con emails de recuperación.
- **Vendora:** si el comprador dejó su email y no pagó, se envía una secuencia (hasta 3 emails, demoras configurables, cupón opcional) con link para retomar el checkout precargado. Solo en planes con `cartRecovery`.

### F101 — Carritos con potencial de recuperación
- **[Web: app]** lista de carritos abandonados.
- **Vendora:** lista con email, producto, monto, UTM, emails enviados y estado (abierto, abandonado, recuperado), más tasa de recuperación.

---

## 10. Métricas y tracking

### F110 — Panel de métricas
- **[Web] [Uso real]** ingresos, ventas, ticket promedio (con variación %), conversión sobre visitas ("3,14 % sobre 541 visitas"), pagos iniciados → compras ("17 %").
- **Vendora:** rango de fechas y comparación con el período anterior; ingresos, ventas, ticket promedio, visitas, conversión, embudo visitas → checkout → pago iniciado → compra, ingresos por bumps/upsells, gráfico diario, productos más vendidos y feed de ventas.

### F111 — Campañas UTM
- **[Web]** "campañas por UTM y visitas".
- **Vendora:** tabla por campaña/fuente/medio/contenido con visitas, checkouts, ventas, ingresos y conversión.

### F112 — Meta Pixel y API de Conversiones
- **[Web] [Uso real]** "app de píxel de la tienda", token CAPI, "Probar eventos".
- **Vendora:** por tienda: Pixel ID, token CAPI (cifrado) y código de prueba. Eventos PageView, ViewContent, InitiateCheckout, AddPaymentInfo y Purchase desde el navegador, y Purchase/InitiateCheckout desde el servidor con el mismo `event_id` (deduplicación), datos del comprador hasheados y `fbp`/`fbc`. Extra: Google Analytics 4 y TikTok Pixel (navegador).

### F113 — Ventas con estado de pago
- **[Web: app]** historial de ventas con estado de pago; **[Uso real]** pagos rechazados/pendientes.
- **Vendora:** listado con filtros (estado, pasarela, fechas, búsqueda), detalle con pagos, ítems, UTM, accesos y descargas; acciones: aprobar transferencia, reembolsar (Mercado Pago/Stripe/PayPal por API; resto manual) y reenviar accesos; exportar CSV.

---

## 11. App móvil

### F120 — App para el dueño (solo lectura)
- **[Web]** iPhone y Android: ventas e ingresos de hoy y del mes de todas las tiendas, **notificación por cada venta**, feed de ventas en vivo, ingresos semanales y mensuales por tienda, conversión de 30 días (visitas, checkouts, compras), historial con estado de pago, ticket promedio, campañas UTM y visitas, carritos abandonados. Login con la misma cuenta; no permite registrarse ni editar.
- **Vendora:** **app instalable (PWA)** en `/app` con exactamente esos datos, actualización automática y **notificaciones push web** por cada venta (iOS 16.4+ y Android). Se eligió PWA en vez de apps nativas porque se instala desde el navegador sin pasar por las tiendas de apps y comparte el backend.

---

## 12. Clientes y notificaciones

### F130 — Clientes **[Inferido]**
- **Vendora:** compradores por tienda con compras, total gastado, país y UTM; exportar CSV.

### F140 — Aviso de venta al vendedor **[Inferido]**
- **Vendora:** email al dueño por cada venta (además del push de la app), configurable.

---

## Lo que no se replica (y por qué)

- **Biblioteca de B-roll:** una nota menciona "B-roll Impultienda". No hay evidencia pública de que sea una función de la plataforma; no se implementa una biblioteca de stock. Los clips propios se suben a **Recursos** (F18).
- **Apps nativas de las tiendas de Apple/Google:** reemplazadas por la PWA (F120), que cubre las mismas pantallas y avisos.
- **Débito automático de la tarjeta guardada para el abono:** reemplazado por factura mensual pagable con Stripe o Mercado Pago (F03/F04).

## Fuentes

- https://impultienda.ar/ y https://impultienda.ar/dashboard (vía buscador)
- https://imputienda.com/ (planes, comisiones, prueba, preguntas frecuentes)
- https://espiad.app/blog/impultienda
- https://apps.apple.com/us/app/impultienda/id6800140857 · https://play.google.com/store/apps/details?id=ar.impultienda.app · https://www.appbrain.com/app/impultienda/ar.impultienda.app
- Tiendas: https://nostalgico.impultienda.ar/ · https://northstar-commerce.impultienda.ar/terms · https://northstar-commerce.impultienda.ar/refund-policy · https://p-s-growth-ventures.impultienda.ar/terms
- https://www.youtube.com/playlist?list=PLQD-EFCtXrHQ · https://www.youtube.com/watch?v=TWIt1HhH3l0
- https://storeleads.app/reports/impultienda/AR/top-stores
- Vault CEREBROMATI: "Impultienda - Investigación y cobro para Uruguay", "Embudo postcompra - Mi Primera Menstruación", "Postcompra jugable - Impultienda", "Lanzamiento CZ y HU (03-11)", "Rumania - Lanzamiento tienda y testeo", "Italia y Alemania - Tiendas configuradas (31-10)", "Mercados validados para lanzar - Impultienda y Whop", "Proceso de lanzamiento - Mi Primera Menstruación", "Aprendizajes MPM - 20 y 21-10", "SOP - Lanzamiento de testeo".
