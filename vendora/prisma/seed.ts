/* Datos iniciales: planes, tipos de cambio, usuario administrador y una tienda demo lista para probar el flujo completo. */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PLANS } from "../src/lib/bootstrap";
import { DEFAULT_RATES } from "../src/lib/fx";
import { renderEbookPdf } from "../src/lib/pdf";
import { coverSvg, svgToPng } from "../src/lib/cover";
import { makeKey, publicUrl, putObject } from "../src/lib/storage";
import { TEMPLATES } from "../src/lib/blocks";
import { DEFAULT_CHECKOUT, DEFAULT_DELIVERY, DEFAULT_NOTIFY, DEFAULT_RECOVERY, DEFAULT_THANKYOU } from "../src/lib/store-settings";

const db = new PrismaClient();
type Json = Prisma.InputJsonValue;

async function main() {
  for (const p of DEFAULT_PLANS) {
    await db.plan.upsert({ where: { key: p.key }, create: p, update: {} });
  }
  for (const [currency, perUsd] of Object.entries(DEFAULT_RATES)) {
    await db.exchangeRate.upsert({ where: { currency }, create: { currency, perUsd, source: "default" }, update: {} });
  }

  const email = (process.env.ADMIN_EMAIL || "admin@vendora.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "vendora1234";
  const max = await db.plan.findUniqueOrThrow({ where: { key: "max" } });
  const admin = await db.user.upsert({
    where: { email },
    create: { email, name: "Administrador", passwordHash: await bcrypt.hash(password, 11), platformRole: "SUPERADMIN", planId: max.id, nextBillingAt: new Date(Date.now() + 30 * 86400_000) },
    update: { platformRole: "SUPERADMIN" },
  });

  if (process.env.SEED_DEMO === "false" || (await db.store.findUnique({ where: { slug: "demo" } }))) {
    console.log(`Listo. Admin: ${email} / ${password}`);
    return;
  }

  const store = await db.store.create({
    data: {
      ownerId: admin.id,
      name: "Guías Prácticas",
      slug: "demo",
      language: "es",
      baseCurrency: "USD",
      testMode: true,
      primaryColor: "#FF5B2E",
      accentColor: "#1F1B3A",
      headline: "Guías cortas que resuelven un problema concreto",
      description: "Ebooks prácticos en PDF, con acceso inmediato.",
      supportEmail: email,
      legalName: "Guías Prácticas (tienda demo)",
      guaranteeDays: 7,
      metaDescription: "Tienda de demostración para probar checkout, upsells y entrega automática.",
      aiContext: "Marca de guías prácticas en español rioplatense, tono claro y cercano, sin promesas exageradas.",
      checkoutSettings: DEFAULT_CHECKOUT as unknown as Json,
      deliverySettings: DEFAULT_DELIVERY as unknown as Json,
      thankYouSettings: DEFAULT_THANKYOU as unknown as Json,
      recoverySettings: { ...DEFAULT_RECOVERY, enabled: true } as unknown as Json,
      notifySettings: DEFAULT_NOTIFY as unknown as Json,
      gateways: { create: [{ provider: "TEST", enabled: true, sortOrder: 0 }, { provider: "TRANSFER", enabled: true, sortOrder: 5, settings: { instructions: "Banco Demo\nTitular: Guías Prácticas\nCBU: 0000000000000000000000\nAlias: GUIAS.DEMO", currencies: "" } }] },
      markets: {
        create: [
          { name: "Internacional", currency: "USD", countries: [], rate: 1, rounding: "99", isDefault: true },
          { name: "Argentina", currency: "ARS", countries: ["AR"], rate: 1450, rounding: "990" },
          { name: "Europa", currency: "EUR", countries: ["ES", "IT", "DE", "FR", "PT", "AT", "BE", "NL", "IE"], rate: 0.92, rounding: "99" },
        ],
      },
    },
  });

  async function product(name: string, data: Partial<Prisma.ProductUncheckedCreateInput>, chapters: { title: string; markdown: string }[], colors: [string, string]) {
    const slug = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const coverPng = svgToPng(coverSvg({ title: name, subtitle: data.shortDescription ?? undefined, author: store.name, background: colors[0], foreground: "#FFFFFF", accent: colors[1], style: "bold", motif: "circles" }), 900);
    const coverKey = makeKey("public", `stores/${store.id}/covers`, `${slug}.png`);
    await putObject(coverKey, coverPng, "image/png");
    await db.mediaAsset.create({ data: { storeId: store.id, name: `Tapa · ${name}`, storageKey: coverKey, url: publicUrl(coverKey), mimeType: "image/png", size: coverPng.length } });
    const p = await db.product.create({
      data: { storeId: store.id, name, slug, price: 0, status: "PUBLISHED", imageUrl: publicUrl(coverKey), ...data } as Prisma.ProductUncheckedCreateInput,
    });
    const pdf = await renderEbookPdf({ title: name, subtitle: data.shortDescription ?? undefined, author: store.name, language: "es", colors: { primary: colors[1], dark: colors[0] }, coverPng, chapters });
    const key = makeKey("private", `products/${p.id}`, `${slug}.pdf`);
    await putObject(key, pdf, "application/pdf");
    await db.productFile.create({ data: { productId: p.id, kind: "FILE", name: `${slug}.pdf`, storageKey: key, size: pdf.length, mimeType: "application/pdf" } });
    return p;
  }

  const main = await product(
    "Ordená tus finanzas en 7 días",
    {
      price: 12.99,
      compareAtPrice: 24.99,
      shortDescription: "Un plan simple, día por día, para saber en qué se va tu plata y armar tu primer fondo de emergencia.",
      description: "Una guía en PDF con un ejercicio por día durante una semana: registrar gastos, separar fijos y variables, recortar sin sufrir y automatizar el ahorro.",
      checkoutSubtitle: "Ebook digital en PDF",
      deliveryNotice: "Te llega el PDF a tu email apenas se acredita el pago.",
      sortOrder: 0,
    },
    [
      { title: "Día 1: anotá todo", markdown: "Durante 24 horas anotá **cada gasto**, por chico que sea.\n\n- Usá una nota del celular o una planilla.\n- Incluí suscripciones y débitos automáticos.\n\n> El objetivo no es juzgarte: es tener el mapa real." },
      { title: "Día 2: fijos y variables", markdown: "Separá lo que pagás todos los meses (alquiler, servicios) de lo que cambia.\n\n## Ejercicio\n1. Sumá tus gastos fijos.\n2. Calculá qué porcentaje de tus ingresos representan.\n3. Marcá con una estrella los variables que podrías reducir." },
    ],
    ["#1F1B3A", "#FF5B2E"],
  );
  const bonus = await product(
    "Planilla de presupuesto mensual",
    { price: 7, visibility: "HIDDEN", shortDescription: "La planilla que usás en la guía, lista para imprimir.", sortOrder: 5 },
    [{ title: "Cómo usar la planilla", markdown: "Completá una fila por gasto y revisala cada domingo.\n\n- Columna 1: fecha\n- Columna 2: concepto\n- Columna 3: monto" }],
    ["#0E5E57", "#F2C14E"],
  );
  const bump = await product(
    "Checklist anti-deudas",
    { price: 9.99, visibility: "HIDDEN", shortDescription: "15 pasos para salir de la tarjeta de crédito sin perder la calma.", sortOrder: 6 },
    [{ title: "Checklist", markdown: "- Listá todas tus deudas con su tasa.\n- Pagá primero la de mayor interés.\n- Pedí refinanciación por escrito." }],
    ["#5B2A86", "#FFB86B"],
  );
  const upsell = await product(
    "Invertir desde cero",
    { price: 19, compareAtPrice: 29, visibility: "POSTPURCHASE_ONLY", shortDescription: "Tus primeras inversiones, explicadas sin jerga.", sortOrder: 7 },
    [{ title: "Antes de invertir", markdown: "Armá primero tu fondo de emergencia de 3 a 6 meses de gastos.\n\n## Conceptos clave\n- Riesgo y plazo.\n- Diversificación." }],
    ["#123B5E", "#3CC6A8"],
  );

  await db.productBonus.create({ data: { productId: main.id, bonusProductId: bonus.id } });
  await db.orderBump.create({
    data: { storeId: store.id, mainProductId: main.id, offerProductId: bump.id, pricingMode: "DISCOUNT", discountPercent: 50, compareAgainst: "STORE_PRICE", headline: "Sumalo a tu pedido (solo acá):", description: "15 pasos concretos para ordenar tus deudas.", buttonText: "+ Sumar el checklist" },
  });
  const blocks = TEMPLATES[0].build({ productName: main.name, shortDescription: main.shortDescription, imageUrl: main.imageUrl, guaranteeDays: 7, hasBonuses: true }).map((b) => {
    if (b.type === "benefits") return { ...b, title: "En 7 días vas a tener", items: ["Tus gastos reales anotados y ordenados", "Un presupuesto que podés sostener", "Tu primer fondo de emergencia en marcha", "Un sistema de ahorro automático"] };
    if (b.type === "faq") return { ...b, title: "Preguntas frecuentes", items: [{ q: "¿Cómo lo recibo?", a: "Por email, en PDF, apenas se acredita el pago." }, { q: "¿Sirve si gano poco?", a: "Sí: el método trabaja con porcentajes de tus ingresos, no con montos fijos." }] };
    if (b.type === "guarantee") return { ...b, body: "Si no te sirve, escribinos dentro de los 7 días y te devolvemos el dinero." };
    return b;
  });
  await db.product.update({ where: { id: main.id }, data: { salesPage: blocks as unknown as Json } });

  const funnel = await db.funnel.create({ data: { storeId: store.id, name: "Post-compra principal", status: "ACTIVE", trigger: "ALWAYS", reservationMinutes: 10, onTimerExpire: "NEXT_OFFER" } });
  const down = await db.funnelNode.create({
    data: { funnelId: funnel.id, type: "DOWNSELL", label: "DownSell 1", productId: upsell.id, pricingMode: "DISCOUNT", discountPercent: 50, title: "Última oportunidad: un precio todavía más bajo", body: "Te lo dejamos a mitad de precio, solo en esta pantalla.", acceptText: "Sí, lo quiero por {price}", declineText: "No, gracias", timerText: "Oferta reservada para vos: {timer}" },
  });
  const up = await db.funnelNode.create({
    data: { funnelId: funnel.id, type: "UPSELL", label: "UpSell 1", productId: upsell.id, pricingMode: "DISCOUNT", discountPercent: 20, title: "¡Esperá! Tu pedido todavía no está completo", body: "Ya ordenaste tus gastos: el siguiente paso es hacer que tu ahorro crezca.", acceptText: "Sí, lo quiero por {price}", declineText: "No, gracias", timerText: "Oferta reservada para vos: {timer}", declineNextId: down.id },
  });
  await db.funnel.update({ where: { id: funnel.id }, data: { entryNodeId: up.id } });
  await db.coupon.create({ data: { storeId: store.id, code: "BIENVENIDA10", type: "PERCENT", value: 10, productIds: [] } });
  await db.store.update({ where: { id: store.id }, data: { mainProductId: main.id } });

  console.log(`Listo. Admin: ${email} / ${password} · Tienda demo: /t/demo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
