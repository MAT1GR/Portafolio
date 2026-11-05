import { NextResponse } from "next/server";
import { getStoreByParam, storeBasePath } from "@/lib/stores";
import { BUYER_COOKIE } from "@/lib/buyer";

export async function GET(req: Request, { params }: { params: Promise<{ store: string }> }) {
  const store = await getStoreByParam((await params).store);
  const base = store ? await storeBasePath(store.slug) : "";
  const res = NextResponse.redirect(new URL(`${base}/mis-compras`, req.url), 303);
  res.cookies.delete(BUYER_COOKIE.name);
  return res;
}
