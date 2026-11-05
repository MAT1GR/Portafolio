"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma, ProductType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { uniqueProductSlug, slugify } from "@/lib/stores";
import { sanitizeBlocks, TEMPLATES } from "@/lib/blocks";
import { assertBonusLimit } from "@/lib/plans";
import { copyProduct } from "@/lib/duplicate";
import { deleteObject } from "@/lib/storage";
import { aiConfigured } from "@/lib/ai";
import { processAiJob } from "@/lib/ai-jobs";

type Json = Prisma.InputJsonValue;
const TYPES: ProductType[] = ["EBOOK", "COURSE", "TEMPLATE", "AUDIO", "VIDEO", "SOFTWARE", "PACK", "LINK"];

async function productOf(storeId: string, productId: string) {
  const p = await db.product.findFirst({ where: { id: productId, storeId } });
  if (!p) throw new UserError("Producto no encontrado");
  return p;
}

const refresh = (storeId: string, productId?: string) => {
  revalidatePath(`/panel/${storeId}/productos`);
  if (productId) revalidatePath(`/panel/${storeId}/productos/${productId}`);
};

export async function createProductAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "products");
    const name = form.req(fd, "name", "el nombre", 160);
    const type = TYPES.includes(form.str(fd, "type") as ProductType) ? (form.str(fd, "type") as ProductType) : "EBOOK";
    const price = form.num(fd, "price", 0);
    if (price < 0) throw new UserError("El precio no puede ser negativo");
    const compare = form.numOrNull(fd, "compareAtPrice");
    const template = TEMPLATES.find((t) => t.key === form.str(fd, "template"));
    const shortDescription = form.opt(fd, "shortDescription", 500);
    const product = await db.product.create({
      data: {
        storeId,
        name,
        slug: await uniqueProductSlug(storeId, name),
        type,
        price,
        compareAtPrice: compare && compare > price ? compare : null,
        shortDescription,
        checkoutSubtitle: form.opt(fd, "checkoutSubtitle", 200),
        status: "DRAFT",
        visibility: form.str(fd, "visibility") === "POSTPURCHASE_ONLY" ? "POSTPURCHASE_ONLY" : form.str(fd, "visibility") === "HIDDEN" ? "HIDDEN" : "PUBLIC",
        salesPage: (template ? template.build({ productName: name, shortDescription, guaranteeDays: store.guaranteeDays, hasBonuses: false }) : []) as unknown as Json,
      },
    });
    if (!store.mainProductId && product.visibility === "PUBLIC") await db.store.update({ where: { id: storeId }, data: { mainProductId: product.id } });
    refresh(storeId);
    return { ok: true, redirect: `/panel/${storeId}/productos/${product.id}` };
  });
}

export async function updateProductAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    const p = await productOf(storeId, productId);
    const slugInput = slugify(form.str(fd, "slug") || p.slug);
    const slug = slugInput === p.slug ? p.slug : await uniqueProductSlug(storeId, slugInput, productId);
    const status = form.str(fd, "status");
    const visibility = form.str(fd, "visibility");
    const type = form.str(fd, "type") as ProductType;
    await db.product.update({
      where: { id: productId },
      data: {
        name: form.req(fd, "name", "el nombre", 160),
        slug,
        type: TYPES.includes(type) ? type : p.type,
        status: status === "PUBLISHED" || status === "ARCHIVED" ? status : "DRAFT",
        visibility: visibility === "HIDDEN" || visibility === "POSTPURCHASE_ONLY" ? visibility : "PUBLIC",
        shortDescription: form.opt(fd, "shortDescription", 500),
        description: form.opt(fd, "description", 20000),
        imageUrl: form.opt(fd, "imageUrl", 1000),
        checkoutTitle: form.opt(fd, "checkoutTitle", 200),
        checkoutSubtitle: form.opt(fd, "checkoutSubtitle", 200),
        deliveryNotice: form.opt(fd, "deliveryNotice", 500),
        sortOrder: form.int(fd, "sortOrder", p.sortOrder),
      },
    });
    refresh(storeId, productId);
  });
}

export async function updatePricesAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const price = form.num(fd, "price", 0);
    if (price < 0) throw new UserError("El precio no puede ser negativo");
    const compare = form.numOrNull(fd, "compareAtPrice");
    await db.product.update({ where: { id: productId }, data: { price, compareAtPrice: compare && compare > price ? compare : null } });
    const markets = await db.market.findMany({ where: { storeId } });
    for (const m of markets) {
      const mp = form.numOrNull(fd, `m_${m.id}_price`);
      const mc = form.numOrNull(fd, `m_${m.id}_compare`);
      if (mp === null) {
        await db.productMarketPrice.deleteMany({ where: { productId, marketId: m.id } });
      } else {
        await db.productMarketPrice.upsert({
          where: { productId_marketId: { productId, marketId: m.id } },
          create: { productId, marketId: m.id, price: mp, compareAtPrice: mc && mc > mp ? mc : null },
          update: { price: mp, compareAtPrice: mc && mc > mp ? mc : null },
        });
      }
    }
    refresh(storeId, productId);
  });
}

export async function addLinkAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const url = form.req(fd, "url", "la URL", 2000);
    if (!/^https?:\/\//.test(url)) throw new UserError("La URL debe empezar con https://");
    const count = await db.productFile.count({ where: { productId } });
    await db.productFile.create({ data: { productId, kind: "LINK", name: form.str(fd, "name", 200) || "Acceso", url, sortOrder: count } });
    refresh(storeId, productId);
  });
}

export async function renameFileAction(storeId: string, productId: string, fileId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    await db.productFile.updateMany({ where: { id: fileId, productId }, data: { name: form.req(fd, "name", "el nombre", 200) } });
    refresh(storeId, productId);
  });
}

export async function deleteFileAction(storeId: string, productId: string, fileId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const file = await db.productFile.findFirst({ where: { id: fileId, productId } });
    if (!file) throw new UserError("Archivo no encontrado");
    await db.productFile.delete({ where: { id: file.id } });
    if (file.storageKey && (await db.productFile.count({ where: { storageKey: file.storageKey } })) === 0) {
      await deleteObject(file.storageKey).catch(() => undefined);
    }
    refresh(storeId, productId);
    return { ok: true, message: "Archivo eliminado" };
  });
}

export async function moveFileAction(storeId: string, productId: string, fileId: string, dir: number): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    const files = await db.productFile.findMany({ where: { productId, product: { storeId } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const i = files.findIndex((f) => f.id === fileId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= files.length) return { ok: true };
    [files[i], files[j]] = [files[j], files[i]];
    await db.$transaction(files.map((f, idx) => db.productFile.update({ where: { id: f.id }, data: { sortOrder: idx } })));
    refresh(storeId, productId);
    return { ok: true };
  });
}

// ───────────── Curso ─────────────

export async function addModuleAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const count = await db.courseModule.count({ where: { productId } });
    await db.courseModule.create({ data: { productId, title: form.req(fd, "title", "el título del módulo", 200), sortOrder: count } });
    refresh(storeId, productId);
  });
}

export async function deleteModuleAction(storeId: string, productId: string, moduleId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await db.courseModule.deleteMany({ where: { id: moduleId, productId, product: { storeId } } });
    refresh(storeId, productId);
    return { ok: true, message: "Módulo eliminado" };
  });
}

export async function saveLessonAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    const moduleId = form.str(fd, "moduleId");
    const mod = await db.courseModule.findFirst({ where: { id: moduleId, productId, product: { storeId } } });
    if (!mod) throw new UserError("Módulo no encontrado");
    const data = {
      title: form.req(fd, "title", "el título de la lección", 200),
      content: form.opt(fd, "content", 50000),
      videoUrl: form.opt(fd, "videoUrl", 1000),
      fileUrl: form.opt(fd, "fileUrl", 1000),
    };
    const lessonId = form.opt(fd, "lessonId");
    if (lessonId) await db.courseLesson.updateMany({ where: { id: lessonId, moduleId }, data });
    else await db.courseLesson.create({ data: { ...data, moduleId, sortOrder: await db.courseLesson.count({ where: { moduleId } }) } });
    if ((await db.product.findUnique({ where: { id: productId } }))?.type !== "COURSE") await db.product.update({ where: { id: productId }, data: { type: "COURSE" } });
    refresh(storeId, productId);
  });
}

export async function deleteLessonAction(storeId: string, productId: string, lessonId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await db.courseLesson.deleteMany({ where: { id: lessonId, module: { productId, product: { storeId } } } });
    refresh(storeId, productId);
    return { ok: true, message: "Lección eliminada" };
  });
}

// ───────────── Bonos ─────────────

export async function addBonusAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    await assertBonusLimit(storeId);
    let bonusId = form.opt(fd, "bonusProductId");
    const newName = form.opt(fd, "newName", 160);
    if (!bonusId && newName) {
      const created = await db.product.create({
        data: { storeId, name: newName, slug: await uniqueProductSlug(storeId, newName), type: "EBOOK", status: "PUBLISHED", visibility: "HIDDEN", price: form.num(fd, "newValue", 0) },
      });
      bonusId = created.id;
    }
    if (!bonusId) throw new UserError("Elegí un producto o escribí el nombre de un bono nuevo");
    if (bonusId === productId) throw new UserError("Un producto no puede ser bono de sí mismo");
    if (!(await db.product.findFirst({ where: { id: bonusId, storeId } }))) throw new UserError("Producto no encontrado");
    const count = await db.productBonus.count({ where: { productId } });
    await db.productBonus.create({ data: { productId, bonusProductId: bonusId, sortOrder: count } });
    refresh(storeId, productId);
    return { ok: true, message: "Bono agregado. Recordá cargarle el contenido (archivo o link)." };
  });
}

export async function removeBonusAction(storeId: string, productId: string, bonusId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await db.productBonus.deleteMany({ where: { id: bonusId, productId, product: { storeId } } });
    refresh(storeId, productId);
    return { ok: true, message: "Bono quitado" };
  });
}

// ───────────── Página de venta ─────────────

export async function saveSalesPageAction(storeId: string, productId: string, blocks: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    await productOf(storeId, productId);
    const clean = sanitizeBlocks(blocks);
    await db.product.update({ where: { id: productId }, data: { salesPage: clean as unknown as Json, salesPageMode: "BLOCKS" } });
    refresh(storeId, productId);
    return { ok: true, message: "Página guardada" };
  });
}

export async function saveSalesHtmlAction(storeId: string, productId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "content");
    await productOf(storeId, productId);
    const html = form.str(fd, "html", 2_000_000);
    const mode = form.str(fd, "mode") === "CUSTOM_HTML" ? "CUSTOM_HTML" : "BLOCKS";
    if (mode === "CUSTOM_HTML" && !html.trim()) throw new UserError("Pegá el HTML de la página");
    await db.product.update({ where: { id: productId }, data: { salesPageMode: mode, salesPageHtml: html || null } });
    refresh(storeId, productId);
    return { ok: true, message: "Guardado. Puede tardar hasta 30 segundos en verse publicado." };
  });
}

export async function applyTemplateAction(storeId: string, productId: string, templateKey: string): Promise<ActionResult> {
  return run(async () => {
    const { store } = await requireStoreAction(storeId, "content");
    const p = await productOf(storeId, productId);
    const t = TEMPLATES.find((x) => x.key === templateKey);
    if (!t) throw new UserError("Plantilla no encontrada");
    const hasBonuses = (await db.productBonus.count({ where: { productId } })) > 0;
    await db.product.update({
      where: { id: productId },
      data: { salesPage: t.build({ productName: p.name, shortDescription: p.shortDescription, imageUrl: p.imageUrl, guaranteeDays: store.guaranteeDays, hasBonuses }) as unknown as Json, salesPageMode: "BLOCKS" },
    });
    refresh(storeId, productId);
    return { ok: true, message: `Plantilla "${t.name}" aplicada` };
  });
}

async function queueAi(storeId: string, productId: string, kind: "SALES_PAGE" | "COVER") {
  const { user } = await requireStoreAction(storeId, "products");
  await productOf(storeId, productId);
  if (!aiConfigured()) throw new UserError("La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).");
  const job = await db.aiJob.create({ data: { userId: user.id, storeId, productId, kind, input: { productId } } });
  after(() => processAiJob(job.id));
  return job.id;
}

export async function aiSalesPageAction(storeId: string, productId: string): Promise<ActionResult> {
  return run(async () => {
    await queueAi(storeId, productId, "SALES_PAGE");
    return { ok: true, message: "La IA está escribiendo la página (tarda 1 a 2 minutos). Se actualiza sola." };
  });
}

export async function aiCoverAction(storeId: string, productId: string): Promise<ActionResult> {
  return run(async () => {
    await queueAi(storeId, productId, "COVER");
    return { ok: true, message: "La IA está diseñando la tapa. Se actualiza en unos segundos." };
  });
}

export async function duplicateProductAction(storeId: string, productId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const id = await copyProduct(productId, storeId);
    refresh(storeId);
    return { ok: true, redirect: `/panel/${storeId}/productos/${id}` };
  });
}

export async function deleteProductAction(storeId: string, productId: string): Promise<ActionResult> {
  return run(async () => {
    await requireStoreAction(storeId, "products");
    await productOf(storeId, productId);
    const sold = await db.orderItem.count({ where: { productId } });
    if (sold > 0) {
      await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } });
      refresh(storeId);
      return { ok: true, message: "El producto tiene ventas: se archivó (los compradores conservan el acceso).", redirect: `/panel/${storeId}/productos` };
    }
    const inFunnel = await db.funnelNode.count({ where: { productId } });
    if (inFunnel) throw new UserError("El producto se usa en un embudo post-compra. Quitalo del embudo primero.");
    await db.product.delete({ where: { id: productId } });
    await db.store.updateMany({ where: { id: storeId, mainProductId: productId }, data: { mainProductId: null } });
    refresh(storeId);
    return { ok: true, redirect: `/panel/${storeId}/productos` };
  });
}
