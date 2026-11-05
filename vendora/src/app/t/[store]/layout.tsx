import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreByParam } from "@/lib/stores";
import { storeVars } from "@/components/store/chrome";
import { t } from "@/lib/i18n";

type Params = { params: Promise<{ store: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await getStoreByParam((await params).store);
  if (!store) return {};
  return {
    title: { absolute: store.metaTitle || store.name },
    description: store.metaDescription || store.description || undefined,
    robots: store.noindex ? { index: false, follow: false } : undefined,
    icons: store.logoUrl ? { icon: store.logoUrl } : undefined,
    manifest: null,
    openGraph: { title: store.metaTitle || store.name, description: store.metaDescription || store.description || undefined, images: store.bannerUrl ? [store.bannerUrl] : undefined },
  };
}

export default async function StoreLayout({ children, params }: Params & { children: React.ReactNode }) {
  const store = await getStoreByParam((await params).store);
  if (!store) notFound();
  return (
    <div lang={store.language} style={storeVars(store)} className="min-h-dvh bg-[#fbfaf8] font-sans text-[#1c1a22]">
      {store.testMode && <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">{t(store.language, "testModeBanner")}</div>}
      {children}
    </div>
  );
}
