import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { pushEnabled, pushToUsers } from "@/lib/push";

const Sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(200) }) });

export async function GET() {
  return NextResponse.json({ enabled: pushEnabled(), publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

/** Alta de un dispositivo para recibir un aviso por cada venta. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.test) {
    const sent = await pushToUsers([user.id], { title: "Notificaciones activadas", body: "Te vamos a avisar acá cada vez que vendas.", url: "/app" });
    return NextResponse.json({ ok: true, sent });
  }
  const parsed = Sub.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  await db.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: { userId: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 200) },
    update: { userId: user.id, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión vencida" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
