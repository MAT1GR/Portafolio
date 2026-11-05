import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { authSecret, sha256 } from "./crypto";
import { env } from "./env";

const COOKIE = "vd_buyer";

function secret() {
  return new TextEncoder().encode(`${authSecret()}:buyer`);
}

/** Consume el enlace mágico y devuelve el email (o null si venció). */
export async function consumeBuyerToken(storeId: string, token: string) {
  const row = await db.buyerLoginToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.storeId !== storeId || row.expiresAt < new Date()) return null;
  await db.buyerLoginToken.update({ where: { id: row.id }, data: { usedAt: row.usedAt ?? new Date() } });
  return row.email;
}

export async function buyerCookieValue(storeId: string, email: string) {
  return new SignJWT({ s: storeId, e: email }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret());
}

export const BUYER_COOKIE = { name: COOKIE, maxAge: 30 * 86400, secure: () => env.secure };

/** Comprador logueado en el área de miembros de esta tienda. */
export async function getBuyer(storeId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.s !== storeId || typeof payload.e !== "string") return null;
    const customer = await db.customer.findUnique({ where: { storeId_email: { storeId, email: payload.e } } });
    return customer;
  } catch {
    return null;
  }
}
