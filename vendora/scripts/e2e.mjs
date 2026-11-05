/**
 * Prueba end-to-end con navegador real (Playwright) contra un servidor corriendo.
 * Requisitos: base sembrada (npm run db:seed), servidor en E2E_BASE (por defecto http://localhost:3000)
 * y, para la parte de IA, el servidor simulado: node scripts/mock-anthropic.mjs 4010 con
 * ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 en el servidor.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const DB = process.env.DATABASE_URL || "postgresql://vendora:vendora@localhost:5432/vendora";
const ADMIN = { email: process.env.ADMIN_EMAIL || "admin@vendora.local", password: process.env.SEED_ADMIN_PASSWORD || "vendora1234" };
const CRON = process.env.CRON_SECRET || "dev-cron-secret";
const SHOTS = process.env.E2E_SHOTS || "";
const results = [];

function sql(q) {
  return execFileSync("psql", [DB, "-t", "-A", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t });
    console.log(`✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}: ${e.message}`);
  }
}
async function until(fn, msg, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(msg);
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}
const uid = Date.now().toString(36);
// Limpieza de corridas anteriores (las tiendas de prueba ocupan cupo del plan).
sql(`begin; delete from "Order" where "storeId" in (select id from "Store" where slug like 'e2e-%' or slug like 'tienda-demo-ia%'); delete from "Store" where slug like 'e2e-%' or slug like 'tienda-demo-ia%'; commit;`);

const browser = await chromium.launch();
const buyer = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await buyer.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

const buyerEmail = `comprador-${uid}@example.com`;

await step("Landing de la plataforma", async () => {
  await page.goto(BASE);
  await page.getByText("sube el ticket").waitFor();
  await shot(page, "01-landing");
});

await step("Página de venta con UTM", async () => {
  await page.goto(`${BASE}/t/demo/p/ordena-tus-finanzas-en-7-dias?utm_source=facebook&utm_medium=paid&utm_campaign=e2e-${uid}&utm_content=ad1`);
  await page.getByRole("heading", { name: /Ordená tus finanzas/ }).first().waitFor();
  await shot(page, "02-pagina-venta");
});

await step("Checkout: email, order bump y cupón", async () => {
  await page.getByRole("link", { name: /Comprar ahora/ }).first().click();
  await page.waitForURL(/\/checkout\//);
  assert(page.url().includes(`utm_campaign=e2e-${uid}`), "Los UTM no pasaron al checkout");
  await page.getByPlaceholder("tu@email.com").fill(buyerEmail);
  await page.getByPlaceholder("tu@email.com").blur();
  await page.getByRole("button", { name: /Sumar el checklist/ }).click();
  await page.getByText(/\+ Checklist anti-deudas/).waitFor();
  await page.getByText("¿Tenés un cupón?").click();
  await page.getByLabel("¿Tenés un cupón?").fill("bienvenida10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByText("Cupón BIENVENIDA10 aplicado").waitFor();
  await shot(page, "03-checkout");
});

await step("Pago con la pasarela de prueba", async () => {
  await page.getByLabel(/Modo prueba/).check();
  await page.getByRole("button", { name: /Pagar ahora/ }).click();
  await page.waitForURL(/simulador/);
  await shot(page, "04-simulador");
  await page.getByRole("button", { name: "Aprobar pago" }).click();
  await page.waitForURL(/\/oferta\//);
});

await step("Upsell: rechazar → aparece el downsell", async () => {
  await page.getByRole("heading", { name: /Esperá/ }).waitFor();
  await page.getByText(/Oferta reservada para vos/).waitFor();
  await shot(page, "05-upsell");
  await page.getByRole("button", { name: "No, gracias" }).click();
  await page.getByRole("heading", { name: /Última oportunidad/ }).waitFor();
});

await step("Downsell: aceptar 1-click → página de gracias", async () => {
  await page.getByRole("button", { name: /Sí, lo quiero por/ }).click();
  await page.waitForURL(/\/gracias\//);
  await page.getByText("¡Compra confirmada!").waitFor();
  await shot(page, "06-gracias");
  const text = await page.textContent("main");
  for (const p of ["Ordená tus finanzas", "Planilla de presupuesto", "Checklist anti-deudas", "Invertir desde cero"]) assert(text.includes(p), `Falta entregar: ${p}`);
});

await step("Descarga con link seguro (PDF)", async () => {
  const href = await page.locator('a[href*="/d/"]').first().getAttribute("href");
  const res = await buyer.request.get(new URL(href, BASE).toString());
  assert(res.status() === 200, `Descarga respondió ${res.status()}`);
  assert((res.headers()["content-type"] || "").includes("pdf"), "No es un PDF");
  const body = await res.body();
  assert(body.subarray(0, 4).toString() === "%PDF", "El archivo no es un PDF válido");
});

await step("Base: pedido pagado, ítems, embudo, UTM, email y eventos", async () => {
  const row = sql(`select id, status, "paidTotal", "discountTotal", "couponCode", utm->>'campaign' from "Order" where email='${buyerEmail}'`);
  const [orderId, status, paidTotal, discount, coupon, campaign] = row.split("|");
  assert(status === "PAID", `Estado ${status}`);
  assert(Number(paidTotal) > 0 && Number(discount) > 0, `Totales ${paidTotal} / ${discount}`);
  assert(coupon === "BIENVENIDA10", "Cupón no registrado");
  assert(campaign === `e2e-${uid}`, `UTM ${campaign}`);
  const kinds = sql(`select string_agg(kind::text || ':' || status::text, ',' order by kind) from "OrderItem" where "orderId"='${orderId}'`);
  for (const k of ["MAIN:PAID", "BUMP:PAID", "BONUS:PAID", "DOWNSELL:PAID"]) assert(kinds.includes(k), `Ítems: ${kinds}`);
  const imp = sql(`select string_agg(n.label || ':' || i.result::text, ',') from "OfferImpression" i join "FunnelNode" n on n.id=i."nodeId" where i."orderId"='${orderId}'`);
  assert(imp.includes("UpSell 1:DECLINED") && imp.includes("DownSell 1:ACCEPTED"), `Impresiones: ${imp}`);
  const emails = Number(sql(`select count(*) from "EmailMessage" where "to"='${buyerEmail}' and kind='delivery'`));
  assert(emails >= 2, `Emails de entrega: ${emails}`);
  const ev = sql(`select count(*) filter (where type='PRODUCT_VIEW'), count(*) filter (where type='CHECKOUT_VIEW'), count(*) filter (where type='CHECKOUT_STARTED'), count(*) filter (where type='PURCHASE') from "AnalyticsEvent" where "utmCampaign"='e2e-${uid}'`);
  const [pv, cv, cs, pu] = ev.split("|").map(Number);
  assert(pv >= 1 && cv >= 1 && cs >= 1 && pu >= 2, `Eventos: ${ev}`);
});

await step("Área de miembros con enlace mágico", async () => {
  await page.goto(`${BASE}/t/demo/mis-compras`);
  await page.getByPlaceholder("tu@email.com").fill(buyerEmail);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await page.getByText(/Revisá tu email/).waitFor();
  const html = sql(`select html from "EmailMessage" where "to"='${buyerEmail}' and kind='buyer-login' order by "createdAt" desc limit 1`);
  const link = html.match(/href="([^"]*mis-compras\/ingresar\?token=[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  assert(link, "No llegó el enlace de acceso");
  await page.goto(link);
  await page.getByRole("heading", { name: "Mis compras" }).waitFor();
  await page.getByText("Invertir desde cero").first().click();
  await page.getByRole("link", { name: /Descargar/ }).first().waitFor();
  await shot(page, "07-mis-compras");
});

let transferOrder = "";
await step("Transferencia: instrucciones y comprobante", async () => {
  const p2 = await buyer.newPage();
  await p2.goto(`${BASE}/t/demo/checkout`);
  await p2.getByPlaceholder("tu@email.com").fill(`transfer-${uid}@example.com`);
  await p2.getByLabel(/Transferencia bancaria/).check();
  await p2.getByRole("button", { name: /Pagar ahora/ }).click();
  await p2.getByRole("heading", { name: "Datos para la transferencia" }).waitFor();
  await p2.getByText(/Alias: GUIAS.DEMO/).waitFor();
  const proof = path.join(os.tmpdir(), `proof-${uid}.png`);
  fs.writeFileSync(proof, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await p2.locator('input[type="file"]').setInputFiles(proof);
  await p2.getByText(/Recibimos tu comprobante/).waitFor();
  await shot(p2, "08-transferencia");
  transferOrder = sql(`select id from "Order" where email='transfer-${uid}@example.com'`);
  assert(sql(`select "transferProofUrl" is not null from "Order" where id='${transferOrder}'`) === "t", "Comprobante no guardado");
  await p2.close();
});

// ───────────── Panel del vendedor ─────────────
const seller = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const sp = await seller.newPage();
sp.on("pageerror", (e) => console.log("  [pageerror panel]", e.message));
const demoId = sql(`select id from "Store" where slug='demo'`);

await step("Login del vendedor", async () => {
  await sp.goto(`${BASE}/login`);
  await sp.getByLabel("Email").fill(ADMIN.email);
  await sp.getByLabel("Contraseña").fill(ADMIN.password);
  await sp.getByRole("button", { name: "Ingresar" }).click();
  await sp.waitForURL(/\/panel/);
});

await step("Dashboard de métricas y ventas", async () => {
  await sp.goto(`${BASE}/panel/${demoId}`);
  await sp.getByText("Ingresos por día").waitFor();
  await sp.getByText("Embudo de conversión").waitFor();
  await shot(sp, "09-dashboard");
  await sp.goto(`${BASE}/panel/${demoId}/ventas?prueba=1`);
  await sp.getByText(buyerEmail).first().waitFor();
});

await step("Aprobar transferencia desde el panel", async () => {
  await sp.goto(`${BASE}/panel/${demoId}/ventas/${transferOrder}`);
  sp.once("dialog", (d) => d.accept());
  await sp.getByRole("button", { name: "Aprobar transferencia" }).click();
  await sp.getByText(/Pago aprobado/).waitFor();
  assert(sql(`select status from "Order" where id='${transferOrder}'`) === "PAID", "La transferencia no quedó pagada");
  assert(Number(sql(`select count(*) from "AccessGrant" where "orderId"='${transferOrder}'`)) >= 2, "No se entregaron los accesos");
});

let newStoreId = "";
await step("Crear tienda y producto a mano, subir archivo y publicar", async () => {
  await sp.goto(`${BASE}/panel/nueva`);
  await sp.locator('input[name="name"]').fill(`Tienda E2E ${uid}`);
  await sp.locator('input[name="slug"]').fill(`e2e-${uid}`);
  await sp.getByRole("button", { name: "Crear tienda" }).click();
  await sp.waitForURL(/\/productos\/nuevo/);
  newStoreId = sp.url().split("/panel/")[1].split("/")[0];
  await sp.locator('input[name="name"]').fill("Producto E2E");
  await sp.locator('input[name="price"]').fill("15");
  await sp.locator('select[name="template"]').selectOption("corta");
  await sp.getByRole("button", { name: "Crear producto" }).click();
  await sp.waitForURL(/\/productos\/c/);
  const productUrl = sp.url().split("?")[0];
  await sp.goto(`${productUrl}?tab=contenido`);
  const file = path.join(os.tmpdir(), `archivo-${uid}.pdf`);
  fs.writeFileSync(file, "%PDF-1.4\n% archivo de prueba\n");
  await sp.locator('input[type="file"]').first().setInputFiles(file);
  await until(() => sql(`select count(*) from "ProductFile" f join "Product" p on p.id=f."productId" where p."storeId"='${newStoreId}' and f.name='archivo-${uid}.pdf'`) === "1", "El archivo no se registró");
  await sp.locator(`input[value="archivo-${uid}.pdf"]`).waitFor();
  await sp.goto(`${productUrl}?tab=general`);
  await sp.locator('select[name="status"]').selectOption("PUBLISHED");
  await sp.getByRole("button", { name: "Guardar" }).first().click();
  await sp.getByText("Cambios guardados").waitFor();
  assert(sql(`select status from "Product" where "storeId"='${newStoreId}'`) === "PUBLISHED", "No se publicó");
});

await step("Landing con HTML propio y token de precio", async () => {
  await sp.goto(`${BASE}/panel/${newStoreId}/contenido?tab=landing`);
  await sp.locator('select[name="landingMode"]').selectOption("CUSTOM_HTML");
  await sp.locator('textarea[name="landingHtml"]').fill('<h1 id="t">Landing propia</h1><p id="p">Precio: {{price}}</p><a id="cta" href="/checkout">Comprar</a>');
  await sp.getByRole("button", { name: "Guardar landing" }).click();
  await sp.getByText(/Landing guardada/).waitFor();
  const res = await buyer.request.get(`${BASE}/t/e2e-${uid}`);
  const html = await res.text();
  assert(html.includes("Landing propia") && /Precio: (US\$|USD|\$)\s?15/.test(html), `Landing: ${html.slice(0, 200)}`);
  assert(html.includes("/api/track"), "Falta el script de seguimiento en la landing");
});

await step("Compra en la tienda nueva (checkout tipo tienda)", async () => {
  const p3 = await buyer.newPage();
  await p3.goto(`${BASE}/t/e2e-${uid}/checkout`);
  await p3.getByPlaceholder("tu@email.com").fill(`nuevo-${uid}@example.com`);
  await p3.getByRole("button", { name: /Pagar ahora/ }).click();
  await p3.waitForURL(/simulador/);
  await p3.getByRole("button", { name: "Aprobar pago" }).click();
  await p3.waitForURL(/\/gracias\//);
  await p3.getByText(`archivo-${uid}.pdf`).waitFor();
  await p3.close();
});

await step("Recuperación de carritos (cron)", async () => {
  const email = `carrito-${uid}@example.com`;
  const productId = sql(`select id from "Product" where slug='ordena-tus-finanzas-en-7-dias'`);
  const res = await buyer.request.post(`${BASE}/api/checkout/session`, { data: { storeId: demoId, productId, email, visitorId: `vis-${uid}`, bumpIds: [] } });
  assert(res.ok(), `session ${res.status()}`);
  sql(`update "Checkout" set "emailCapturedAt" = now() - interval '3 hours', "createdAt" = now() - interval '3 hours' where email='${email}'`);
  const cron = await buyer.request.get(`${BASE}/api/cron`, { headers: { Authorization: `Bearer ${CRON}` } });
  assert(cron.ok(), `cron ${cron.status()}`);
  assert(sql(`select status from "Checkout" where email='${email}'`) === "ABANDONED", "No se marcó abandonado");
  assert(Number(sql(`select count(*) from "EmailMessage" where "to"='${email}' and kind='recovery-1'`)) === 1, "No se envió el email de recuperación");
});

await step("Crear tienda con IA (servidor simulado) + ebook en PDF", async () => {
  await sp.goto(`${BASE}/panel/nueva?modo=ia`);
  await sp.locator('textarea[name="idea"]').fill("Guía para organizar las comidas de la semana");
  await sp.getByRole("button", { name: /Crear tienda con IA/ }).click();
  await sp.waitForURL(/\/panel\/nueva\/ia\//);
  const jobId = sp.url().split("/").pop();
  let status = "";
  for (let i = 0; i < 60; i++) {
    status = sql(`select status from "AiJob" where id='${jobId}'`);
    if (status === "DONE" || status === "FAILED") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(status === "DONE", `Trabajo de IA: ${status} ${sql(`select coalesce(error,'') from "AiJob" where id='${jobId}'`)}`);
  const out = JSON.parse(sql(`select output from "AiJob" where id='${jobId}'`));
  let ebook = "";
  for (let i = 0; i < 60 && out.ebookJobId; i++) {
    ebook = sql(`select status from "AiJob" where id='${out.ebookJobId}'`);
    if (ebook === "DONE" || ebook === "FAILED") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(ebook === "DONE", `Ebook IA: ${ebook}`);
  assert(Number(sql(`select count(*) from "ProductFile" where "productId"='${out.productId}' and "aiGenerated"`)) === 1, "Falta el PDF generado");
  assert(sql(`select "imageUrl" is not null from "Product" where id='${out.productId}'`) === "t", "Falta la tapa");
  await sp.reload();
  await sp.getByRole("link", { name: "Revisar el producto" }).waitFor();
  await shot(sp, "10-ia");
});

await step("Páginas de administración", async () => {
  for (const p of ["/admin", "/admin/usuarios", "/admin/tiendas", "/admin/facturas", "/admin/planes", "/admin/correos", "/admin/tipos-de-cambio"]) {
    const r = await sp.goto(`${BASE}${p}`);
    assert(r.status() === 200, `${p} → ${r.status()}`);
  }
});

await step("Secciones del panel cargan sin errores", async () => {
  for (const s of ["", "/ventas", "/clientes", "/carritos", "/productos", "/ebooks", "/checkout", "/embudos", "/marketing/ab", "/marketing/cupones", "/marketing/pixel", "/contenido", "/recursos", "/markets", "/pagos", "/equipo", "/configuracion"]) {
    const r = await sp.goto(`${BASE}/panel/${demoId}${s}`);
    assert(r.status() === 200, `${s || "/"} → ${r.status()}`);
    assert(!(await sp.getByText("Application error").count()), `${s} con error`);
  }
  const funnelId = sql(`select id from "Funnel" where "storeId"='${demoId}' limit 1`);
  const r = await sp.goto(`${BASE}/panel/${demoId}/embudos/${funnelId}`);
  assert(r.status() === 200, "Constructor de embudo");
  await shot(sp, "11-embudo");
  for (const p of ["/panel/plan", "/panel/cuenta", "/app"]) {
    const x = await sp.goto(`${BASE}${p}`);
    assert(x.status() === 200, `${p} → ${x.status()}`);
  }
  await shot(sp, "12-app");
});

await step("Webhooks rechazan firmas inválidas", async () => {
  const stripeGw = sql(`select id from "PaymentGateway" where "storeId"='${demoId}' and provider='TRANSFER'`);
  const r1 = await buyer.request.post(`${BASE}/api/webhooks/stripe/${stripeGw}`, { data: {} });
  assert(r1.status() === 404, `gateway/proveedor cruzado → ${r1.status()}`);
  const r2 = await buyer.request.post(`${BASE}/api/webhooks/platform/stripe`, { data: {} });
  assert(r2.status() === 404 || r2.status() === 400, `plataforma → ${r2.status()}`);
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pasos OK`);
process.exit(failed.length ? 1 : 0);
