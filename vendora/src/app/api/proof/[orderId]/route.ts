import { db } from "@/lib/db";
import { can, getCurrentUser, getStoreAccess } from "@/lib/auth";
import { isS3, readLocal, signedDownloadUrl } from "@/lib/storage";

/** Comprobante de transferencia (privado): solo para el equipo de la tienda con permiso de ventas. */
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const order = await db.order.findUnique({ where: { id: (await params).orderId } });
  if (!order?.transferProofUrl) return new Response("No encontrado", { status: 404 });
  const access = await getStoreAccess(order.storeId, user);
  if (!access || !can(access.role, "orders")) return new Response("Sin permiso", { status: 403 });
  if (isS3()) return Response.redirect(await signedDownloadUrl(order.transferProofUrl, `comprobante-${order.number}`), 302);
  const file = await readLocal(order.transferProofUrl);
  if (!file) return new Response("No encontrado", { status: 404 });
  return new Response(file.stream, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
}
