import { db } from "@/lib/db";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { getBuyer } from "@/lib/buyer";
import { dict } from "@/lib/i18n";
import { randomToken } from "@/lib/crypto";
import { getDeliverySettings } from "@/lib/store-settings";
import { serveProductFile, simpleHtmlPage } from "@/lib/store-page";

/** Descarga desde el área de miembros: requiere sesión del comprador y respeta el tope de descargas. */
export async function GET(_req: Request, { params }: { params: Promise<{ store: string; downloadId: string }> }) {
  const { store: storeParam, downloadId } = await params;
  const store = await getStoreByParam(storeParam);
  if (!store) return new Response("No encontrado", { status: 404 });
  const d = dict(store.language);
  const base = await storeBasePath(store.slug);
  const buyer = await getBuyer(store.id);
  if (!buyer) return Response.redirect(new URL(`${base}/mis-compras`, _req.url), 303);

  let dl = downloadId.startsWith("f-")
    ? null
    : await db.download.findFirst({ where: { id: downloadId, grant: { customerId: buyer.id, revokedAt: null } }, include: { file: true } });
  if (!dl && downloadId.startsWith("f-")) {
    // Archivo agregado al producto después de la compra: se crea el acceso en el momento.
    const fileId = downloadId.slice(2);
    const file = await db.productFile.findUnique({ where: { id: fileId } });
    const grant = file ? await db.accessGrant.findFirst({ where: { customerId: buyer.id, productId: file.productId, revokedAt: null } }) : null;
    if (file && grant) {
      dl = await db.download.create({
        data: { grantId: grant.id, fileId: file.id, token: randomToken(24), maxDownloads: getDeliverySettings(store).maxDownloads },
        include: { file: true },
      });
    }
  }
  if (!dl || (dl.maxDownloads !== null && dl.count >= dl.maxDownloads)) {
    return simpleHtmlPage(d.linkExpired, store.supportEmail ? `${d.contact}: ${store.supportEmail}` : d.requestNewLink, { href: `${base}/mis-compras`, text: d.myPurchases });
  }
  await db.download.update({ where: { id: dl.id }, data: { count: { increment: 1 }, lastAt: new Date() } });
  return serveProductFile(dl.file);
}
