import Link from "next/link";
import type { Store } from "@prisma/client";
import { dict, fill } from "@/lib/i18n";
import { trackerScript, type TrackerConfig } from "@/lib/tracker";

export function storeVars(store: Pick<Store, "primaryColor" | "accentColor">) {
  return { "--sp": store.primaryColor, "--sa": store.accentColor } as React.CSSProperties;
}

export function StoreHeader({ store, base, minimal }: { store: Store; base: string; minimal?: boolean }) {
  const d = dict(store.language);
  return (
    <header className="border-b border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={base || "/"} className="flex min-w-0 items-center gap-2.5">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} className="h-9 max-w-[160px] object-contain" />
          ) : (
            <span className="truncate font-display text-lg font-bold" style={{ color: store.accentColor }}>
              {store.name}
            </span>
          )}
        </Link>
        {!minimal && (
          <Link href={`${base}/mis-compras`} className="text-sm font-medium text-black/60 hover:text-black">
            {d.myPurchases}
          </Link>
        )}
      </div>
    </header>
  );
}

export function StoreFooter({ store, base }: { store: Store; base: string }) {
  const d = dict(store.language);
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Vendora";
  return (
    <footer className="mt-16 border-t border-black/5 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-black/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-black/80">{store.legalName || store.name}</div>
          {store.supportEmail && (
            <a className="hover:text-black" href={`mailto:${store.supportEmail}`}>
              {store.supportEmail}
            </a>
          )}
          {store.supportWhatsapp && (
            <a className="ml-3 hover:text-black" href={`https://wa.me/${store.supportWhatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={`${base}/terminos`} className="hover:text-black">
            {d.terms}
          </Link>
          <Link href={`${base}/privacidad`} className="hover:text-black">
            {d.privacy}
          </Link>
          <Link href={`${base}/reembolsos`} className="hover:text-black">
            {d.refunds}
          </Link>
          <Link href={`${base}/mis-compras`} className="hover:text-black">
            {d.myPurchases}
          </Link>
        </nav>
      </div>
      <div className="pb-6 text-center text-xs text-black/35">{fill(d.poweredBy, { brand })}</div>
    </footer>
  );
}

/** Script de seguimiento + píxeles (Meta, GA4, TikTok). */
export function Tracker(props: TrackerConfig) {
  return <script dangerouslySetInnerHTML={{ __html: trackerScript(props) }} />;
}

export function Unavailable({ store }: { store: Store }) {
  const d = dict(store.language);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{store.name}</h1>
      <p className="mt-2 text-black/60">{d.storeUnavailable}</p>
    </div>
  );
}

export function Paragraphs({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <div className={className}>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="mb-3 leading-relaxed whitespace-pre-line last:mb-0">
            {p.trim()}
          </p>
        ))}
    </div>
  );
}
