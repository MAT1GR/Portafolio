import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { storeContext } from "@/lib/store-page";
import { getBuyer } from "@/lib/buyer";
import { embedUrl } from "@/lib/blocks";
import { fill } from "@/lib/i18n";
import { Paragraphs, StoreFooter, StoreHeader } from "@/components/store/chrome";

type Props = { params: Promise<{ store: string; productId: string }>; searchParams: Promise<Record<string, string | undefined>> };

/** Contenido de una compra: descargas y, si es curso, módulos y lecciones con progreso. */
export default async function PurchaseContentPage({ params, searchParams }: Props) {
  const { store: storeParam, productId } = await params;
  const sp = await searchParams;
  const { store, base, d } = await storeContext(storeParam);
  const buyer = await getBuyer(store.id);
  if (!buyer) redirect(`${base}/mis-compras`);
  const grant = await db.accessGrant.findFirst({
    where: { customerId: buyer.id, productId, revokedAt: null },
    include: {
      product: { include: { files: { orderBy: { sortOrder: "asc" } }, modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } } } },
      downloads: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!grant) notFound();
  const product = grant.product;
  const done = new Set((await db.lessonProgress.findMany({ where: { customerId: buyer.id, lesson: { module: { productId } } } })).map((p) => p.lessonId));
  const lessons = product.modules.flatMap((m) => m.lessons);
  const lesson = lessons.find((l) => l.id === sp.leccion) ?? lessons[0];
  const media = lesson?.videoUrl ? embedUrl(lesson.videoUrl) : null;
  const customerId = buyer.id;

  async function complete(formData: FormData) {
    "use server";
    const lessonId = String(formData.get("lessonId"));
    const ok = await db.courseLesson.findFirst({ where: { id: lessonId, module: { productId } } });
    if (ok) {
      await db.lessonProgress.upsert({ where: { customerId_lessonId: { customerId, lessonId } }, create: { customerId, lessonId }, update: {} });
    }
    revalidatePath(`/t/${storeParam}/mis-compras/${productId}`);
  }

  return (
    <>
      <StoreHeader store={store} base={base} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link href={`${base}/mis-compras`} className="text-sm text-black/55">
          ← {d.myPurchases}
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">{product.name}</h1>

        {product.files.length > 0 && (
          <section className="mb-8 rounded-3xl bg-white p-5 shadow-sm">
            <ul className="divide-y divide-black/5">
              {product.files.map((f) => {
                const dl = grant.downloads.find((x) => x.fileId === f.id);
                const left = dl?.maxDownloads != null ? Math.max(0, dl.maxDownloads - dl.count) : null;
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-medium">{f.name}</div>
                      {left !== null && <div className="text-xs text-black/50">{fill(d.downloadsLeft, { n: left })}</div>}
                    </div>
                    {f.kind === "LINK" ? (
                      <a href={f.url!} target="_blank" rel="noreferrer" className="rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold">
                        {d.open} ↗
                      </a>
                    ) : left === 0 ? (
                      <span className="text-sm text-black/45">{d.linkExpired}</span>
                    ) : (
                      <a href={`${base}/mis-compras/descargar/${dl?.id ?? `f-${f.id}`}`} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: store.primaryColor }}>
                        ⬇ {d.download}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {lessons.length > 0 && lesson && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            <article className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
              {media && (
                <div className="mb-5 aspect-video overflow-hidden rounded-2xl bg-black">
                  {media.kind === "video" ? <video src={media.src} controls className="h-full w-full" /> : <iframe src={media.src} className="h-full w-full" allowFullScreen />}
                </div>
              )}
              <h2 className="text-xl font-bold">{lesson.title}</h2>
              <Paragraphs text={lesson.content} className="mt-3 text-black/75" />
              {lesson.fileUrl && (
                <a href={lesson.fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-xl border border-black/15 px-4 py-2 text-sm font-semibold">
                  ⬇ {d.download}
                </a>
              )}
              <form action={complete} className="mt-6">
                <input type="hidden" name="lessonId" value={lesson.id} />
                <button disabled={done.has(lesson.id)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: store.primaryColor }}>
                  {done.has(lesson.id) ? `✓ ${d.completed}` : d.markComplete}
                </button>
              </form>
            </article>
            <aside className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="mb-2 text-sm font-semibold">
                {d.lessons} · {done.size}/{lessons.length}
              </div>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                <div className="h-full" style={{ width: `${(done.size / lessons.length) * 100}%`, background: store.primaryColor }} />
              </div>
              {product.modules.map((m) => (
                <div key={m.id} className="mb-3">
                  <div className="mb-1 text-xs font-semibold tracking-wide text-black/45 uppercase">{m.title}</div>
                  <ul>
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`${base}/mis-compras/${productId}?leccion=${l.id}`}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${l.id === lesson.id ? "bg-black/5 font-semibold" : "hover:bg-black/[0.03]"}`}
                        >
                          <span className={done.has(l.id) ? "text-green-600" : "text-black/30"}>{done.has(l.id) ? "✓" : "○"}</span>
                          {l.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </aside>
          </div>
        )}
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
