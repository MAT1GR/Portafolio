import { NextResponse } from "next/server";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { BUYER_COOKIE, buyerCookieValue, consumeBuyerToken } from "@/lib/buyer";
import { dict } from "@/lib/i18n";
import { simpleHtmlPage } from "@/lib/store-page";

/** Consume el enlace mágico y abre la sesión del comprador en esta tienda. */
export async function GET(req: Request, { params }: { params: Promise<{ store: string }> }) {
  const store = await getStoreByParam((await params).store);
  if (!store) return new Response("No encontrado", { status: 404 });
  const base = await storeBasePath(store.slug);
  const token = new URL(req.url).searchParams.get("token") || "";
  const email = token ? await consumeBuyerToken(store.id, token) : null;
  if (!email) {
    const d = dict(store.language);
    return simpleHtmlPage(d.linkExpired, d.loginHint, { href: `${base}/mis-compras`, text: d.sendLink });
  }
  const res = NextResponse.redirect(new URL(`${base}/mis-compras`, req.url), 303);
  res.cookies.set(BUYER_COOKIE.name, await buyerCookieValue(store.id, email), { httpOnly: true, sameSite: "lax", secure: BUYER_COOKIE.secure(), path: "/", maxAge: BUYER_COOKIE.maxAge });
  return res;
}
