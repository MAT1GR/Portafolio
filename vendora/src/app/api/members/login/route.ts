import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buyerLoginUrl } from "@/lib/delivery";
import { dict, fill } from "@/lib/i18n";
import { renderEmail, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/auth";

const Body = z.object({ storeId: z.string().min(1), email: z.string().email().max(200) });

/** Envía el enlace mágico de acceso al área de miembros (si el email tiene compras). */
export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers) || "0";
  if (!rateLimit(`members:${ip}`, 8, 10 * 60_000)) return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const store = await db.store.findUnique({ where: { id: parsed.data.storeId } });
  if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  const hasAccess = await db.accessGrant.findFirst({ where: { revokedAt: null, customer: { storeId: store.id, email } } });
  if (hasAccess) {
    const d = dict(store.language);
    const url = await buyerLoginUrl(store, email, 30);
    await sendEmail({
      to: email,
      subject: fill(d.emailLoginSubject, { store: store.name }),
      html: renderEmail({
        brandName: store.name,
        color: store.primaryColor,
        logoUrl: store.logoUrl,
        title: d.myPurchases,
        paragraphs: [d.emailLoginIntro],
        cta: { text: d.emailLoginCta, url },
        footer: fill(d.emailFooter, { store: store.name }),
      }),
      kind: "buyer-login",
      storeId: store.id,
      fromName: store.name,
    });
  }
  return NextResponse.json({ ok: true });
}
