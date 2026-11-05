import type { AiJob, Prisma } from "@prisma/client";
import { db } from "./db";
import { aiChapter, aiCover, aiOutline, aiSalesPage, aiStore, AiError, salesPageToBlocks, type OutlineAi } from "./ai";
import { coverSvg, normalizeSpec, svgToPng } from "./cover";
import { renderEbookPdf } from "./pdf";
import { makeKey, publicUrl, putObject } from "./storage";
import { slugify, uniqueProductSlug, uniqueStoreSlug } from "./stores";
import { convert } from "./fx";
import { applyRounding, formatMoney } from "./money";
import { sanitizeBlocks } from "./blocks";
import { assertAiEbookQuota } from "./plans";

type StoreJobInput = { idea: string; audience: string; tone: string; language: string; baseCurrency: string; type: "STORE" | "CHECKOUT"; withEbook: boolean };
type EbookJobInput = {
  storeId: string;
  productId?: string | null;
  topic: string;
  audience: string;
  tone: string;
  language: string;
  chapters: number;
  wordsPerChapter: number;
  outline?: OutlineAi | null;
  price?: number | null;
};

async function setProgress(jobId: string, progress: number, message: string) {
  await db.aiJob.update({ where: { id: jobId }, data: { progress: Math.min(99, Math.round(progress)), message } });
}

async function saveCoverPng(storeId: string, png: Buffer, name: string) {
  const key = makeKey("public", `stores/${storeId}/covers`, `${slugify(name) || "tapa"}.png`);
  await putObject(key, png, "image/png");
  const url = publicUrl(key);
  await db.mediaAsset.create({ data: { storeId, name: `Tapa · ${name}`.slice(0, 120), storageKey: key, url, mimeType: "image/png", size: png.length } });
  return url;
}

export async function generateCoverFor(productId: string) {
  const product = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { store: true } });
  const spec = await aiCover({
    title: product.name,
    subtitle: product.shortDescription,
    language: product.store.language,
    context: product.store.aiContext,
    brandColors: { primary: product.store.primaryColor, accent: product.store.accentColor },
  });
  const svg = coverSvg(normalizeSpec({ ...spec, title: spec.title || product.name, author: product.store.name }));
  const png = svgToPng(svg, 900);
  const url = await saveCoverPng(product.storeId, png, product.name);
  await db.product.update({ where: { id: productId }, data: { imageUrl: url } });
  return { url, png };
}

async function priceIn(usd: number, currency: string) {
  const value = await convert(Math.max(0, usd), "USD", currency);
  return applyRounding(value, currency === "USD" ? "99" : "integer", currency);
}

async function runStore(job: AiJob) {
  const input = job.input as unknown as StoreJobInput;
  await setProgress(job.id, 5, "Pensando la tienda y la oferta…");
  const user = await db.user.findUniqueOrThrow({ where: { id: job.userId }, include: { plan: true } });
  const ai = await aiStore(input);
  await setProgress(job.id, 45, "Creando la tienda y los productos…");
  const currency = input.baseCurrency || "USD";
  const slug = await uniqueStoreSlug(ai.storeName);
  const store = await db.store.create({
    data: {
      ownerId: job.userId,
      name: ai.storeName.slice(0, 80),
      slug,
      type: input.type,
      language: input.language,
      baseCurrency: currency,
      primaryColor: /^#[0-9a-f]{6}$/i.test(ai.primaryColor) ? ai.primaryColor : "#FF5B2E",
      accentColor: /^#[0-9a-f]{6}$/i.test(ai.accentColor) ? ai.accentColor : "#17142A",
      headline: ai.tagline,
      description: ai.description,
      metaTitle: ai.storeName,
      metaDescription: ai.description.slice(0, 300),
      aiContext: ai.aiContext,
      supportEmail: user.email,
      testMode: true,
    },
  });
  await db.paymentGateway.create({ data: { storeId: store.id, provider: "TEST", enabled: true } });

  const mk = async (name: string, data: Partial<Prisma.ProductUncheckedCreateInput>) =>
    db.product.create({
      data: {
        storeId: store.id,
        name: name.slice(0, 160),
        slug: await uniqueProductSlug(store.id, name),
        price: data.price ?? 0,
        aiGenerated: true,
        ...data,
      } as Prisma.ProductUncheckedCreateInput,
    });

  const mainPrice = await priceIn(ai.product.priceUsd, currency);
  const cmp = ai.product.compareAtPriceUsd > ai.product.priceUsd ? await priceIn(ai.product.compareAtPriceUsd, currency) : null;
  const main = await mk(ai.product.name, {
    type: ai.product.type,
    status: "DRAFT",
    visibility: "PUBLIC",
    shortDescription: ai.product.shortDescription || ai.product.subtitle,
    description: ai.product.description,
    price: mainPrice,
    compareAtPrice: cmp,
    deliveryNotice: ai.product.deliveryNotice,
    checkoutSubtitle: ai.product.checkoutSubtitle,
  });

  const bonusLimit = user.plan.maxBonusesPerStore;
  const bonuses = ai.bonuses.slice(0, Math.max(0, bonusLimit));
  for (const [i, b] of bonuses.entries()) {
    const bp = await mk(b.name, { type: "EBOOK", status: "DRAFT", visibility: "HIDDEN", shortDescription: b.description, description: b.description, price: 0 });
    await db.productBonus.create({ data: { productId: main.id, bonusProductId: bp.id, sortOrder: i } });
  }
  const blocks = sanitizeBlocks(salesPageToBlocks(ai.salesPage, { hasBonuses: bonuses.length > 0 }));
  await db.product.update({ where: { id: main.id }, data: { salesPage: blocks as unknown as Prisma.InputJsonValue } });

  const bumpPrice = await priceIn(ai.orderBump.priceUsd, currency);
  const bumpProduct = await mk(ai.orderBump.name, { type: "EBOOK", status: "DRAFT", visibility: "HIDDEN", shortDescription: ai.orderBump.description, description: ai.orderBump.description, price: bumpPrice });
  await db.orderBump.create({
    data: {
      storeId: store.id,
      mainProductId: main.id,
      offerProductId: bumpProduct.id,
      pricingMode: "FIXED",
      fixedPrice: bumpPrice,
      headline: ai.orderBump.headline,
      description: ai.orderBump.description,
      buttonText: ai.orderBump.buttonText,
    },
  });

  if (user.plan.maxUpsellsPerStore > 0) {
    const upPrice = await priceIn(ai.upsell.priceUsd, currency);
    const upsell = await mk(ai.upsell.name, {
      type: "EBOOK",
      status: "DRAFT",
      visibility: "POSTPURCHASE_ONLY",
      shortDescription: ai.upsell.description,
      description: ai.upsell.description,
      price: upPrice,
    });
    const funnel = await db.funnel.create({ data: { storeId: store.id, name: "Embudo post-compra", status: "PAUSED", trigger: "ALWAYS", reservationMinutes: 10 } });
    const node = await db.funnelNode.create({
      data: {
        funnelId: funnel.id,
        type: "UPSELL",
        label: "UpSell 1",
        productId: upsell.id,
        pricingMode: "DISCOUNT",
        discountPercent: 0,
        title: ai.upsell.title,
        body: ai.upsell.body,
        acceptText: "",
        declineText: "",
      },
    });
    await db.funnel.update({ where: { id: funnel.id }, data: { entryNodeId: node.id } });
  }
  await db.store.update({ where: { id: store.id }, data: { mainProductId: main.id } });

  await setProgress(job.id, 70, "Diseñando la tapa…");
  try {
    await generateCoverFor(main.id);
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
  }

  let ebookJobId: string | null = null;
  if (input.withEbook && ai.product.type === "EBOOK") {
    try {
      await assertAiEbookQuota(job.userId, user.plan);
      const ebookJob = await db.aiJob.create({
        data: {
          userId: job.userId,
          storeId: store.id,
          productId: main.id,
          kind: "EBOOK",
          countsQuota: true,
          input: {
            storeId: store.id,
            productId: main.id,
            topic: `${ai.product.name}. ${ai.product.description}`,
            audience: input.audience,
            tone: input.tone,
            language: input.language,
            chapters: Math.min(10, Math.max(3, ai.ebookOutline.length || 6)),
            wordsPerChapter: 900,
            outline: {
              title: ai.product.name,
              subtitle: ai.product.subtitle,
              description: ai.product.shortDescription,
              chapters: ai.ebookOutline.map((c) => ({ title: c.title, summary: c.summary, keyPoints: [] })),
            },
          } as unknown as Prisma.InputJsonValue,
        },
      });
      ebookJobId = ebookJob.id;
    } catch {
      ebookJobId = null;
    }
  }
  return { storeId: store.id, productId: main.id, ebookJobId };
}

async function runEbook(job: AiJob) {
  const input = job.input as unknown as EbookJobInput;
  const store = await db.store.findUniqueOrThrow({ where: { id: input.storeId } });
  await setProgress(job.id, 3, "Armando el índice…");
  const chapters = Math.min(12, Math.max(2, input.chapters || 6));
  const outline =
    input.outline && input.outline.chapters?.length
      ? input.outline
      : await aiOutline({ topic: input.topic, audience: input.audience, tone: input.tone, chapters, language: input.language, context: store.aiContext });

  let product = input.productId ? await db.product.findUnique({ where: { id: input.productId } }) : null;
  if (!product) {
    const price = input.price && input.price > 0 ? input.price : await priceIn(9.99, store.baseCurrency);
    product = await db.product.create({
      data: {
        storeId: store.id,
        name: outline.title.slice(0, 160),
        slug: await uniqueProductSlug(store.id, outline.title),
        type: "EBOOK",
        status: "DRAFT",
        shortDescription: outline.subtitle,
        description: outline.description,
        price,
        checkoutSubtitle: "Ebook digital en PDF",
        aiGenerated: true,
      },
    });
    await db.aiJob.update({ where: { id: job.id }, data: { productId: product.id } });
  }

  const texts: string[] = new Array(outline.chapters.length).fill("");
  let done = 0;
  const queue = outline.chapters.map((_, i) => i);
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
      texts[i] = await aiChapter({
        outline,
        index: i,
        audience: input.audience,
        tone: input.tone,
        language: input.language,
        wordsPerChapter: input.wordsPerChapter || 900,
        context: store.aiContext,
      });
      done++;
      await setProgress(job.id, 5 + (done / outline.chapters.length) * 80, `Escribiendo capítulos (${done}/${outline.chapters.length})…`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  await setProgress(job.id, 88, "Diseñando la tapa y maquetando el PDF…");
  let coverPng: Buffer | null = null;
  try {
    const spec = await aiCover({ title: outline.title, subtitle: outline.subtitle, language: input.language, context: store.aiContext, brandColors: { primary: store.primaryColor, accent: store.accentColor } });
    coverPng = svgToPng(coverSvg(normalizeSpec({ ...spec, title: spec.title || outline.title, author: store.name })), 1200);
    if (!product.imageUrl) {
      const url = await saveCoverPng(store.id, svgToPng(coverSvg(normalizeSpec({ ...spec, title: spec.title || outline.title, author: store.name })), 900), outline.title);
      await db.product.update({ where: { id: product.id }, data: { imageUrl: url } });
    }
  } catch (e) {
    if (!(e instanceof AiError)) throw e;
  }
  const pdf = await renderEbookPdf({
    title: outline.title,
    subtitle: outline.subtitle,
    author: store.name,
    language: input.language,
    colors: { primary: store.primaryColor, dark: store.accentColor },
    coverPng,
    chapters: outline.chapters.map((c, i) => ({ title: c.title, markdown: texts[i] })),
  });
  const filename = `${slugify(outline.title) || "ebook"}.pdf`;
  const key = makeKey("private", `products/${product.id}`, filename);
  await putObject(key, pdf, "application/pdf");
  const file = await db.productFile.create({
    data: { productId: product.id, kind: "FILE", name: filename, storageKey: key, size: pdf.length, mimeType: "application/pdf", aiGenerated: true },
  });
  return { productId: product.id, fileId: file.id, bytes: pdf.length, chapters: outline.chapters.length };
}

async function runSalesPage(job: AiJob) {
  const { productId } = job.input as { productId: string };
  const product = await db.product.findUniqueOrThrow({
    where: { id: productId },
    include: { store: true, bonuses: { include: { bonusProduct: true } } },
  });
  await setProgress(job.id, 10, "Escribiendo la página de venta…");
  const sp = await aiSalesPage({
    productName: product.name,
    description: [product.shortDescription, product.description].filter(Boolean).join("\n\n"),
    price: formatMoney(product.price, product.store.baseCurrency, product.store.language),
    bonuses: product.bonuses.map((b) => b.bonusProduct.name),
    guaranteeDays: product.store.guaranteeDays,
    language: product.store.language,
    context: product.store.aiContext,
  });
  const blocks = sanitizeBlocks(salesPageToBlocks(sp, { image: product.imageUrl, hasBonuses: product.bonuses.length > 0 }));
  await db.product.update({ where: { id: productId }, data: { salesPage: blocks as unknown as Prisma.InputJsonValue, salesPageMode: "BLOCKS" } });
  return { productId, blocks: blocks.length };
}

async function runCover(job: AiJob) {
  const { productId } = job.input as { productId: string };
  await setProgress(job.id, 20, "Diseñando la tapa…");
  const { url } = await generateCoverFor(productId);
  return { productId, url };
}

/** Ejecuta un trabajo de IA (lo toma de forma atómica para que no se procese dos veces). */
export async function processAiJob(jobId: string) {
  const claimed = await db.aiJob.updateMany({ where: { id: jobId, status: "QUEUED" }, data: { status: "RUNNING", startedAt: new Date(), progress: 1 } });
  if (claimed.count === 0) return;
  const job = await db.aiJob.findUniqueOrThrow({ where: { id: jobId } });
  try {
    let output: Record<string, unknown>;
    if (job.kind === "STORE") output = await runStore(job);
    else if (job.kind === "EBOOK") output = await runEbook(job);
    else if (job.kind === "SALES_PAGE") output = await runSalesPage(job);
    else output = await runCover(job);
    await db.aiJob.update({ where: { id: jobId }, data: { status: "DONE", progress: 100, message: "Listo", output: output as Prisma.InputJsonValue, finishedAt: new Date() } });
    if (job.kind === "STORE" && typeof output.ebookJobId === "string") await processAiJob(output.ebookJobId);
  } catch (e) {
    const message = e instanceof AiError ? e.message : `Error inesperado: ${(e as Error).message}`;
    await db.aiJob.update({ where: { id: jobId }, data: { status: "FAILED", error: message.slice(0, 1000), finishedAt: new Date() } });
  }
}

/** Respaldo del cron: procesa trabajos en cola que quedaron sin ejecutar y libera los colgados. */
export async function processQueuedAiJobs() {
  const stale = new Date(Date.now() - 20 * 60_000);
  await db.aiJob.updateMany({ where: { status: "RUNNING", startedAt: { lt: stale } }, data: { status: "FAILED", error: "El trabajo tardó demasiado y se canceló. Probá de nuevo." } });
  const queued = await db.aiJob.findMany({ where: { status: "QUEUED", createdAt: { lt: new Date(Date.now() - 60_000) } }, take: 3, orderBy: { createdAt: "asc" } });
  for (const j of queued) await processAiJob(j.id);
  return queued.length;
}
