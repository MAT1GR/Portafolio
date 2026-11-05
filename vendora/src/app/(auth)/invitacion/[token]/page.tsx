import Link from "next/link";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getCurrentUser, ROLE_LABELS } from "@/lib/auth";
import { acceptInviteAction } from "@/app/actions/auth";
import { ActionButton } from "@/components/client";

export const metadata = { title: "Invitación" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.storeInvitation.findUnique({ where: { tokenHash: sha256(token) }, include: { store: true, invitedBy: true } });
  const user = await getCurrentUser();
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <>
        <h1 className="text-2xl font-bold">Invitación no válida</h1>
        <p className="mt-2 text-sm text-muted">Venció o ya fue usada. Pedile al dueño de la tienda que te invite de nuevo.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Te invitaron a {inv.store.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {inv.invitedBy.name} te invitó como <b>{ROLE_LABELS[inv.role]}</b> ({inv.email}).
      </p>
      <div className="mt-6">
        {user ? (
          <ActionButton action={acceptInviteAction.bind(null, token)} className="btn btn-brand w-full">
            Aceptar invitación
          </ActionButton>
        ) : (
          <div className="space-y-3">
            <Link href={`/registro?invite=${token}&email=${encodeURIComponent(inv.email)}`} className="btn btn-brand w-full">
              Crear cuenta y aceptar
            </Link>
            <Link href={`/login?next=/invitacion/${token}`} className="btn btn-secondary w-full">
              Ya tengo cuenta
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
