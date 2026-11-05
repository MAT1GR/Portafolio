"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAction } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { aiConfigured } from "@/lib/ai";
import { assertAiEbookQuota } from "@/lib/plans";
import { processAiJob } from "@/lib/ai-jobs";
import { LANGUAGES } from "@/lib/i18n";

/** Genera un ebook completo con IA (índice, capítulos, tapa y PDF). Descuenta de la cuota mensual del plan. */
export async function createAiEbookAction(storeId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const { user, store } = await requireStoreAction(storeId, "products");
    if (!aiConfigured()) throw new UserError("La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).");
    const owner = await db.user.findUniqueOrThrow({ where: { id: store.ownerId }, include: { plan: true } });
    await assertAiEbookQuota(owner.id, owner.plan);
    const productId = form.opt(fd, "productId");
    if (productId && !(await db.product.findFirst({ where: { id: productId, storeId } }))) throw new UserError("Producto no encontrado");
    const language = form.str(fd, "language");
    const job = await db.aiJob.create({
      data: {
        userId: owner.id,
        storeId,
        productId,
        kind: "EBOOK",
        countsQuota: true,
        input: {
          storeId,
          productId,
          topic: form.req(fd, "topic", "el tema del ebook", 2000),
          audience: form.str(fd, "audience", 500),
          tone: form.str(fd, "tone", 200),
          language: language in LANGUAGES ? language : store.language,
          chapters: Math.min(12, Math.max(2, form.int(fd, "chapters", 6))),
          wordsPerChapter: Math.min(2500, Math.max(300, form.int(fd, "words", 900))),
          price: form.numOrNull(fd, "price"),
          requestedBy: user.id,
        },
      },
    });
    after(() => processAiJob(job.id));
    revalidatePath(`/panel/${storeId}/ebooks`);
    return { ok: true, message: "La IA empezó a escribir el ebook. Tarda unos minutos; podés seguir trabajando." };
  });
}
