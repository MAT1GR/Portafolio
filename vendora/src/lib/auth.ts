import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { StoreRole } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { authSecret } from "./crypto";

const COOKIE = "vd_session";
const SESSION_DAYS = 30;

function secret() {
  return new TextEncoder().encode(authSecret());
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 11);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function clientIpFrom(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || null;
}

export async function createSession(userId: string) {
  const h = await headers();
  const session = await db.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
      ip: clientIpFrom(h),
    },
  });
  const token = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.secure,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      await db.session.deleteMany({ where: { id: String(payload.sid) } });
    } catch {
      /* token inválido: solo se borra la cookie */
    }
  }
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const session = await db.session.findUnique({
      where: { id: String(payload.sid) },
      include: { user: { include: { plan: true } } },
    });
    if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
    return session.user;
  } catch {
    return null;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadmin() {
  const user = await requireUser();
  if (user.platformRole !== "SUPERADMIN") redirect("/panel");
  return user;
}

// ───────────── Permisos por tienda ─────────────

export type Permission =
  | "view"
  | "metrics"
  | "orders"
  | "products"
  | "content"
  | "marketing"
  | "payments"
  | "settings"
  | "team"
  | "billing"
  | "danger";

const ALL: Permission[] = ["view", "metrics", "orders", "products", "content", "marketing", "payments", "settings", "team", "billing", "danger"];

export const ROLE_PERMISSIONS: Record<StoreRole, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== "billing" && p !== "danger"),
  EDITOR: ["view", "metrics", "products", "content", "marketing"],
  SUPPORT: ["view", "orders"],
  ANALYST: ["view", "metrics"],
};

export const ROLE_LABELS: Record<StoreRole, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  EDITOR: "Editor",
  SUPPORT: "Soporte",
  ANALYST: "Analista",
};

export function can(role: StoreRole, perm: Permission) {
  return ROLE_PERMISSIONS[role].includes(perm);
}

/** Tiendas a las que el usuario tiene acceso, con su rol. */
export async function getUserStores(userId: string) {
  const [owned, memberships] = await Promise.all([
    db.store.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    db.storeMember.findMany({
      where: { userId, role: { not: "OWNER" } },
      include: { store: { include: { owner: { include: { plan: true } } } } },
    }),
  ]);
  const shared = memberships
    .filter((m) => m.store.ownerId !== userId && m.store.owner.plan.teamRoles)
    .map((m) => ({ store: m.store, role: m.role }));
  return [...owned.map((s) => ({ store: s, role: "OWNER" as StoreRole })), ...shared.map((s) => ({ store: s.store, role: s.role }))];
}

export async function getStoreAccess(storeId: string, user: CurrentUser) {
  const store = await db.store.findUnique({ where: { id: storeId }, include: { owner: { include: { plan: true } } } });
  if (!store) return null;
  if (store.ownerId === user.id) return { store, role: "OWNER" as StoreRole };
  const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: user.id } } });
  if (member && store.owner.plan.teamRoles) return { store, role: member.role };
  if (user.platformRole === "SUPERADMIN") return { store, role: "ADMIN" as StoreRole };
  return null;
}

/** Para páginas: redirige si no hay acceso. */
export async function requireStorePage(storeId: string, perm: Permission = "view") {
  const user = await requireUser();
  const access = await getStoreAccess(storeId, user);
  if (!access) redirect("/panel");
  if (!can(access.role, perm)) redirect(`/panel/${storeId}`);
  return { user, ...access };
}

export class AuthError extends Error {}

/** Para server actions / APIs: lanza error si no hay acceso. */
export async function requireStoreAction(storeId: string, perm: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Tu sesión expiró. Volvé a ingresar.");
  const access = await getStoreAccess(storeId, user);
  if (!access || !can(access.role, perm)) throw new AuthError("No tenés permiso para hacer esto.");
  return { user, ...access };
}
