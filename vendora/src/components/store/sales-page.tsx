import type { Block } from "@/lib/blocks";
import { embedUrl } from "@/lib/blocks";
import type { Dict } from "@/lib/i18n";
import { fill } from "@/lib/i18n";
import { Paragraphs } from "./chrome";
import { Countdown } from "./countdown";

type Props = {
  blocks: Block[];
  d: Dict;
  productName: string;
  imageUrl?: string | null;
  price: string;
  compareAt?: string | null;
  percentOff?: number;
  checkoutHref: string;
  guaranteeDays: number;
  bonuses: { name: string; imageUrl?: string | null; value?: string | null }[];
  color: string;
  dark: string;
};

function Cta({ href, text, color }: { href: string; text: string; color: string }) {
  return (
    <a href={href} className="inline-flex items-center justify-center rounded-2xl px-7 py-4 text-base font-bold text-white shadow-lg transition hover:brightness-110" style={{ background: color }}>
      {text}
    </a>
  );
}

function Section({ children, alt, dark }: { children: React.ReactNode; alt?: boolean; dark?: string }) {
  return (
    <section className={alt ? "bg-black/[0.025]" : ""} style={dark ? { background: dark, color: "white" } : undefined}>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">{children}</div>
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return children ? <h2 className="mb-6 text-center text-2xl font-bold sm:text-3xl">{children}</h2> : null;
}

/** Página de venta por bloques. Los bloques vacíos no se muestran. */
export function SalesPage(p: Props) {
  const buy = p.d.buyNow;
  return (
    <div>
      {p.blocks.map((b, i) => {
        switch (b.type) {
          case "hero":
            return (
              <section key={b.id} className="overflow-hidden">
                <div className="mx-auto grid grid-cols-1 max-w-5xl items-center gap-8 px-4 py-12 sm:py-16 md:grid-cols-2">
                  <div>
                    {b.badge && (
                      <span className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide text-white uppercase" style={{ background: p.color }}>
                        {b.badge}
                      </span>
                    )}
                    <h1 className="text-3xl leading-tight font-extrabold sm:text-5xl" style={{ color: p.dark }}>
                      {b.title || p.productName}
                    </h1>
                    {b.subtitle && <p className="mt-4 text-lg text-black/70">{b.subtitle}</p>}
                    <div className="mt-7 flex flex-wrap items-center gap-4">
                      <Cta href={p.checkoutHref} text={b.ctaText || buy} color={p.color} />
                      <span className="text-sm text-black/60">
                        {p.compareAt && <s className="mr-2">{p.compareAt}</s>}
                        <b className="text-lg text-black">{p.price}</b>
                      </span>
                    </div>
                  </div>
                  {(b.image || p.imageUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image || p.imageUrl!} alt={p.productName} className="mx-auto max-h-[460px] w-auto rounded-2xl shadow-2xl" />
                  )}
                </div>
              </section>
            );
          case "text":
            if (!b.body && !b.title) return null;
            return (
              <Section key={b.id} alt={i % 2 === 1}>
                <H2>{b.title}</H2>
                <Paragraphs text={b.body} className="text-lg text-black/75" />
              </Section>
            );
          case "benefits":
            if (!b.items.length) return null;
            return (
              <Section key={b.id} alt={i % 2 === 1}>
                <H2>{b.title}</H2>
                <ul className="space-y-3">
                  {b.items.map((it, j) => (
                    <li key={j} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: p.color }}>
                        ✓
                      </span>
                      <span className="text-black/80">{it}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          case "features":
            if (!b.items.length) return null;
            return (
              <Section key={b.id} alt={i % 2 === 1}>
                <H2>{b.title}</H2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {b.items.map((it, j) => (
                    <div key={j} className="rounded-2xl border border-black/5 bg-white p-5">
                      <div className="mb-1 text-sm font-bold" style={{ color: p.color }}>
                        {String(j + 1).padStart(2, "0")}
                      </div>
                      <div className="font-semibold">{it.title}</div>
                      {it.text && <p className="mt-1 text-sm text-black/65">{it.text}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            );
          case "image":
            if (!b.url) return null;
            return (
              <Section key={b.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.caption || ""} className="mx-auto rounded-2xl" />
                {b.caption && <p className="mt-2 text-center text-sm text-black/55">{b.caption}</p>}
              </Section>
            );
          case "video": {
            const e = b.url ? embedUrl(b.url) : null;
            if (!e) return null;
            return (
              <Section key={b.id}>
                <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-xl">
                  {e.kind === "video" ? (
                    <video src={e.src} controls className="h-full w-full" />
                  ) : (
                    <iframe src={e.src} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  )}
                </div>
              </Section>
            );
          }
          case "testimonials":
            if (!b.items.length) return null;
            return (
              <Section key={b.id} alt>
                <H2>{b.title}</H2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {b.items.map((t, j) => (
                    <figure key={j} className="rounded-2xl bg-white p-5 shadow-sm">
                      <blockquote className="text-black/80">“{t.text}”</blockquote>
                      <figcaption className="mt-3 text-sm font-semibold">
                        {t.name}
                        {t.role && <span className="font-normal text-black/50"> · {t.role}</span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Section>
            );
          case "bonuses":
            if (!p.bonuses.length) return null;
            return (
              <Section key={b.id} alt>
                <H2>{b.title || p.d.bonusesIncluded}</H2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {p.bonuses.map((bo, j) => (
                    <div key={j} className="rounded-2xl bg-white p-4 text-center shadow-sm">
                      {bo.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bo.imageUrl} alt="" className="mx-auto mb-3 h-36 rounded-lg object-contain" />
                      )}
                      <div className="font-semibold">{bo.name}</div>
                      <div className="mt-1 text-sm">
                        {bo.value && <s className="mr-1 text-black/45">{bo.value}</s>}
                        <b style={{ color: p.color }}>{p.d.free}</b>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            );
          case "offer":
            return (
              <Section key={b.id}>
                <div className="rounded-3xl border-2 bg-white p-6 text-center shadow-xl sm:p-10" style={{ borderColor: p.color }}>
                  {b.title && <h2 className="text-2xl font-bold sm:text-3xl">{b.title}</h2>}
                  <div className="mt-4 flex items-baseline justify-center gap-3">
                    {p.compareAt && <s className="text-lg text-black/45">{p.compareAt}</s>}
                    <span className="text-4xl font-extrabold sm:text-5xl" style={{ color: p.dark }}>
                      {p.price}
                    </span>
                    {p.percentOff ? (
                      <span className="rounded-full px-2 py-0.5 text-sm font-bold text-white" style={{ background: p.color }}>
                        -{p.percentOff}%
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-6">
                    <Cta href={p.checkoutHref} text={b.ctaText || buy} color={p.color} />
                  </div>
                  <p className="mt-4 text-sm text-black/55">{b.note || p.d.instantAccess}</p>
                </div>
              </Section>
            );
          case "guarantee":
            return (
              <Section key={b.id} dark={p.dark}>
                <div className="text-center">
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-2xl font-black" style={{ background: p.color }}>
                    {p.guaranteeDays}
                  </div>
                  <h2 className="text-2xl font-bold">{b.title || fill(p.d.guarantee, { days: p.guaranteeDays })}</h2>
                  <Paragraphs text={b.body} className="mx-auto mt-3 max-w-xl text-white/80" />
                </div>
              </Section>
            );
          case "faq":
            if (!b.items.length) return null;
            return (
              <Section key={b.id}>
                <H2>{b.title}</H2>
                <div className="space-y-3">
                  {b.items.map((f, j) => (
                    <details key={j} className="group rounded-2xl border border-black/10 bg-white p-4">
                      <summary className="cursor-pointer list-none font-semibold">
                        <span className="mr-2" style={{ color: p.color }}>
                          +
                        </span>
                        {f.q}
                      </summary>
                      <p className="mt-2 leading-relaxed whitespace-pre-line text-black/70">{f.a}</p>
                    </details>
                  ))}
                </div>
              </Section>
            );
          case "cta":
            return (
              <Section key={b.id} alt>
                <div className="text-center">
                  {b.title && <h2 className="mb-5 text-2xl font-bold sm:text-3xl">{b.title}</h2>}
                  <Cta href={p.checkoutHref} text={b.ctaText || buy} color={p.color} />
                </div>
              </Section>
            );
          case "countdown": {
            const end = Date.parse(b.endsAt);
            if (!end || end < Date.now()) return null;
            return (
              <Section key={b.id}>
                <div className="rounded-2xl px-4 py-5 text-center text-white" style={{ background: p.dark }}>
                  {b.title && <div className="mb-1 text-sm font-semibold tracking-wide uppercase opacity-80">{b.title}</div>}
                  <Countdown endsAt={end} className="text-3xl" />
                </div>
              </Section>
            );
          }
          case "author":
            if (!b.name && !b.bio) return null;
            return (
              <Section key={b.id} alt>
                <div className="flex flex-col items-center gap-5 sm:flex-row">
                  {b.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image} alt={b.name} className="h-28 w-28 rounded-full object-cover" />
                  )}
                  <div>
                    <div className="text-xl font-bold">{b.name}</div>
                    <Paragraphs text={b.bio} className="mt-2 text-black/70" />
                  </div>
                </div>
              </Section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
