"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword, clientIpFrom } from "@/lib/auth";
import { form, run, UserError, type ActionResult } from "@/lib/actions";
import { ensurePlans, ensureRates } from "@/lib/bootstrap";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { renderEmail, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

async function limit(action: string, max: number) {
  const ip = clientIpFrom(await headers()) || "0";
  if (!rateLimit(`${action}:${ip}`, max, 15 * 60_000)) throw new UserError("Demasiados intentos. Esperá unos minutos.");
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/panel";
}

export async function loginAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await limit("login", 10);
    const email = form.email(fd, "email");
    const password = form.str(fd, "password", 200);
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new UserError("Email o contraseña incorrectos");
    if (user.status !== "ACTIVE") throw new UserError("Tu cuenta está suspendida. Escribí a soporte.");
    await createSession(user.id);
    return { ok: true, redirect: safeNext(form.opt(fd, "next")) };
  });
  return result;
}

export async function registerAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await limit("register", 5);
    await ensurePlans();
    await ensureRates();
    const name = form.req(fd, "name", "tu nombre", 80);
    const email = form.email(fd, "email");
    const password = form.str(fd, "password", 200);
    if (password.length < 8) throw new UserError("La contraseña debe tener al menos 8 caracteres");
    if (await db.user.findUnique({ where: { email } })) throw new UserError("Ya hay una cuenta con ese email. Ingresá o recuperá tu contraseña.");
    const free = await db.plan.findUniqueOrThrow({ where: { key: "free" } });
    const isFirst = (await db.user.count()) === 0;
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        planId: free.id,
        platformRole: isFirst || (env.adminEmail && env.adminEmail === email) ? "SUPERADMIN" : "USER",
        nextBillingAt: new Date(Date.now() + 30 * 86400_000),
      },
    });
    await createSession(user.id);
    await sendEmail({
      to: email,
      subject: `Bienvenido a ${env.brand}`,
      html: renderEmail({
        brandName: env.brand,
        title: `¡Hola ${name.split(" ")[0]}!`,
        paragraphs: ["Tu cuenta está lista. Creá tu primera tienda (a mano o con IA), cargá tu producto y conectá un medio de pago para empezar a vender."],
        cta: { text: "Ir a mi panel", url: `${env.appUrl}/panel` },
      }),
      kind: "welcome",
    });
    const invite = form.opt(fd, "invite");
    return { ok: true, redirect: invite ? `/invitacion/${invite}` : "/panel/nueva" };
  });
}

export async function requestResetAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await limit("reset", 5);
    const email = form.email(fd, "email");
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const token = randomToken(32);
      await db.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
      await sendEmail({
        to: email,
        subject: `${env.brand}: restablecé tu contraseña`,
        html: renderEmail({
          brandName: env.brand,
          title: "Restablecé tu contraseña",
          paragraphs: ["Recibimos un pedido para cambiar tu contraseña. El enlace vence en 1 hora. Si no fuiste vos, ignorá este email."],
          cta: { text: "Elegir una contraseña nueva", url: `${env.appUrl}/restablecer/${token}` },
        }),
        kind: "password-reset",
      });
    }
    return { ok: true, message: "Si el email tiene una cuenta, te enviamos un enlace para restablecer la contraseña." };
  });
}

export async function resetPasswordAction(token: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const password = form.str(fd, "password", 200);
    if (password.length < 8) throw new UserError("La contraseña debe tener al menos 8 caracteres");
    const row = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new UserError("El enlace venció. Pedí uno nuevo.");
    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
      db.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      db.session.deleteMany({ where: { userId: row.userId } }),
    ]);
    await createSession(row.userId);
    return { ok: true, redirect: "/panel" };
  });
}

export async function acceptInviteAction(token: string): Promise<ActionResult> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserError("Ingresá o creá tu cuenta para aceptar la invitación");
    const inv = await db.storeInvitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new UserError("La invitación venció o ya fue usada");
    if (inv.email !== user.email) throw new UserError(`Esta invitación es para ${inv.email}. Ingresá con ese email.`);
    await db.storeMember.upsert({
      where: { storeId_userId: { storeId: inv.storeId, userId: user.id } },
      create: { storeId: inv.storeId, userId: user.id, role: inv.role },
      update: { role: inv.role },
    });
    await db.storeInvitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return { ok: true, redirect: `/panel/${inv.storeId}` };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
