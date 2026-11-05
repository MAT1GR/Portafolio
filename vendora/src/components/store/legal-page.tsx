import { storeContext } from "@/lib/store-page";
import { customLegalText, legalSections, type LegalKind } from "@/lib/legal";
import { Paragraphs, StoreFooter, StoreHeader, Tracker } from "./chrome";

const TITLE_KEY = { terms: "terms", privacy: "privacy", refunds: "refunds" } as const;

export async function LegalPage({ storeParam, kind }: { storeParam: string; kind: LegalKind }) {
  const { store, base, d } = await storeContext(storeParam);
  const custom = customLegalText(store, kind);
  return (
    <>
      <StoreHeader store={store} base={base} />
      <Tracker storeId={store.id} type="PAGE_VIEW" pixelId={store.metaPixelId} ga4Id={store.ga4Id} tiktokId={store.tiktokPixelId} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
          <h1 className="mb-6 text-2xl font-bold sm:text-3xl">
            {d[TITLE_KEY[kind]]} · {store.name}
          </h1>
          {custom ? (
            <Paragraphs text={custom} className="text-black/75" />
          ) : (
            <div className="space-y-6">
              {legalSections(store, kind).map(([title, body]) => (
                <section key={title}>
                  <h2 className="mb-1.5 font-semibold">{title}</h2>
                  <p className="leading-relaxed text-black/70">{body}</p>
                </section>
              ))}
            </div>
          )}
        </article>
      </main>
      <StoreFooter store={store} base={base} />
    </>
  );
}
