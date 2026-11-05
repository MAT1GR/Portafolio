import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, getStoreAccess, can } from "@/lib/auth";
import { isS3, makeKey, objectExists, publicUrl, signedUploadUrl } from "@/lib/storage";
import { signValue } from "@/lib/crypto";
import { getBuyerOrder } from "@/lib/orders";
import { renderEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

const Body = z.object({
  step: z.enum(["init", "complete"]),
  storeId: z.string().min(1),
  purpose: z.enum(["product-file", "media", "image", "transfer-proof"]),
  productId: z.string().optional(),
  orderId: z.string().optional(),
  accessKey: z.string().optional(),
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
  type: z.string().max(120),
  key: z.string().optional(),
});

const LIMITS: Record<string, number> = {
  "product-file": 2 * 1024 ** 3,
  media: 200 * 1024 ** 2,
  image: 15 * 1024 ** 2,
  "transfer-proof": 15 * 1024 ** 2,
};

function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Solicitud inválida");
  const b = parsed.data;

  // Autorización
  if (b.purpose === "transfer-proof") {
    const order = b.orderId ? await getBuyerOrder(b.orderId, b.accessKey) : null;
    if (!order || order.storeId !== b.storeId) return err("Pedido no encontrado", 404);
    if (!/^(image\/|application\/pdf)/.test(b.type)) return err("Subí una imagen o un PDF");
  } else {
    const user = await getCurrentUser();
    if (!user) return err("Sesión vencida", 401);
    const access = await getStoreAccess(b.storeId, user);
    const perm = b.purpose === "product-file" ? "products" : "content";
    if (!access || !(can(access.role, perm) || can(access.role, "products"))) return err("Sin permiso", 403);
    if (b.purpose === "product-file") {
      const product = b.productId ? await db.product.findFirst({ where: { id: b.productId, storeId: b.storeId } }) : null;
      if (!product) return err("Producto no encontrado", 404);
    }
    if (b.purpose === "image" && !b.type.startsWith("image/")) return err("Elegí una imagen");
  }
  if (b.size > LIMITS[b.purpose]) return err("El archivo es demasiado grande");

  const isPrivate = b.purpose === "product-file" || b.purpose === "transfer-proof";
  const scope = b.purpose === "product-file" ? `products/${b.productId}` : b.purpose === "transfer-proof" ? `proofs/${b.orderId}` : `stores/${b.storeId}/media`;

  if (b.step === "init") {
    const key = makeKey(isPrivate ? "private" : "public", scope, b.name);
    const exp = String(Date.now() + 60 * 60_000);
    const sig = signValue(`${key}|${exp}|${b.size}`);
    if (isS3()) {
      return NextResponse.json({ key, uploadUrl: await signedUploadUrl(key, b.type), method: "PUT", headers: { "Content-Type": b.type } });
    }
    const qs = new URLSearchParams({ key, exp, max: String(b.size), sig, type: b.type });
    return NextResponse.json({ key, uploadUrl: `/api/upload/local?${qs}`, method: "PUT", headers: { "Content-Type": b.type } });
  }

  // complete
  if (!b.key || !b.key.startsWith(`${isPrivate ? "private" : "public"}/${scope}/`)) return err("Archivo inválido");
  if (!(await objectExists(b.key))) return err("El archivo no llegó a guardarse. Probá de nuevo.");

  if (b.purpose === "product-file") {
    const count = await db.productFile.count({ where: { productId: b.productId! } });
    const file = await db.productFile.create({
      data: { productId: b.productId!, kind: "FILE", name: b.name.slice(0, 200), storageKey: b.key, size: b.size, mimeType: b.type, sortOrder: count },
    });
    return NextResponse.json({ id: file.id, key: b.key, url: null, name: file.name, size: b.size, mimeType: b.type });
  }
  if (b.purpose === "transfer-proof") {
    const order = await db.order.update({ where: { id: b.orderId! }, data: { transferProofUrl: b.key }, include: { store: { include: { owner: true } } } });
    await sendEmail({
      to: order.store.supportEmail || order.store.owner.email,
      subject: `Comprobante de transferencia · pedido #${order.number}`,
      html: renderEmail({
        brandName: env.brand,
        title: "Te subieron un comprobante de transferencia",
        paragraphs: [`Pedido #${order.number} de ${order.email}.`, "Revisalo y aprobá el pago para que se entregue el producto."],
        cta: { text: "Ver pedido", url: `${env.appUrl}/panel/${order.storeId}/ventas/${order.id}` },
      }),
      kind: "seller-transfer-proof",
      storeId: order.storeId,
    });
    return NextResponse.json({ key: b.key, url: null, name: b.name, size: b.size, mimeType: b.type });
  }
  const url = publicUrl(b.key);
  const asset = await db.mediaAsset.create({ data: { storeId: b.storeId, name: b.name.slice(0, 200), storageKey: b.key, url, mimeType: b.type, size: b.size } });
  return NextResponse.json({ id: asset.id, key: b.key, url, name: asset.name, size: b.size, mimeType: b.type });
}
