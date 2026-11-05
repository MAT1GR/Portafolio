import { db } from "@/lib/db";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { dict } from "@/lib/i18n";
import { serveProductFile, simpleHtmlPage } from "@/lib/store-page";

/** Descarga con el link del email: valida vencimiento, tope de descargas y que el acceso siga activo. */
export async function GET(_req: Request, { params }: { params: Promise<{ store: string; token: string }> }) {
  const { store: storeParam, token } = await params;
  const store = await getStoreByParam(storeParam);
  if (!store) return new Response("No encontrado", { status: 404 });
  const d = dict(store.language);
  const base = await storeBasePath(store.slug);
  const dl = await db.download.findUnique({ where: { token }, include: { file: true, grant: { include: { order: true } } } });
  const invalid =
    !dl ||
    dl.grant.order.storeId !== store.id ||
    dl.grant.revokedAt !== null ||
    (dl.expiresAt !== null && dl.expiresAt < new Date()) ||
    (dl.maxDownloads !== null && dl.count >= dl.maxDownloads);
  if (invalid) return simpleHtmlPage(d.linkExpired, d.requestNewLink, { href: `${base}/mis-compras`, text: d.myPurchases });
  await db.download.update({ where: { id: dl.id }, data: { count: { increment: 1 }, lastAt: new Date() } });
  return serveProductFile(dl.file);
}
