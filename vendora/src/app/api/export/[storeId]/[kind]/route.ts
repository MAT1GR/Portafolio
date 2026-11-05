import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { can, getCurrentUser, getStoreAccess } from "@/lib/auth";
import { asUtm } from "@/lib/tracking";

function csv(rows: (string | number | null | undefined)[][]) {
  return "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

/** Exportación CSV de ventas, clientes y carritos abandonados. */
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string; kind: string }> }) {
  const { storeId, kind } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const access = await getStoreAccess(storeId, user);
  if (!access || !can(access.role, "orders")) return new Response("Sin permiso", { status: 403 });
  const sp = new URL(req.url).searchParams;
  let body = "";
  if (kind === "ventas") {
    const where: Prisma.OrderWhereInput = { storeId, ...(sp.get("prueba") === "1" ? {} : { testMode: false }) };
    if (sp.get("estado")) where.status = sp.get("estado") as never;
    if (sp.get("pasarela")) where.provider = sp.get("pasarela") as never;
    const orders = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true }, take: 50000 });
    body = csv([
      ["pedido", "fecha", "email", "nombre", "telefono", "pais", "estado", "pasarela", "moneda", "total", "cobrado", "cupon", "productos", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "variante_ab"],
      ...orders.map((o) => {
        const u = asUtm(o.utm);
        return [o.number, o.createdAt.toISOString(), o.email, o.name, o.phone, o.country, o.status, o.provider, o.currency, o.total.toString(), o.paidTotal.toString(), o.couponCode, o.items.map((i) => `${i.kind}:${i.name}`).join(" | "), u.source, u.medium, u.campaign, u.content, u.term, o.abVariant];
      }),
    ]);
  } else if (kind === "clientes") {
    const customers = await db.customer.findMany({ where: { storeId }, include: { orders: { where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, testMode: false } } }, take: 100000 });
    body = csv([
      ["email", "nombre", "telefono", "pais", "compras", "total_cobrado", "moneda", "alta"],
      ...customers.map((c) => [c.email, c.name, c.phone, c.country, c.orders.length, c.orders.reduce((s, o) => s + Number(o.paidTotal), 0).toFixed(2), c.orders[0]?.currency ?? "", c.createdAt.toISOString()]),
    ]);
  } else if (kind === "carritos") {
    const checkouts = await db.checkout.findMany({ where: { storeId, email: { not: null }, status: { in: ["OPEN", "ABANDONED", "RECOVERED"] } }, orderBy: { createdAt: "desc" }, take: 50000 });
    body = csv([
      ["email", "nombre", "estado", "producto_id", "moneda", "total", "emails_enviados", "fecha", "utm_campaign"],
      ...checkouts.map((c) => [c.email, c.name, c.status, c.productId, c.currency, c.total.toString(), c.recoveryStep, c.createdAt.toISOString(), asUtm(c.utm).campaign]),
    ]);
  } else {
    return new Response("No encontrado", { status: 404 });
  }
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
