import Link from "next/link";
import { requestResetAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";

export const metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Recuperá tu contraseña</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Te enviamos un enlace para elegir una nueva.</p>
      <ActionForm action={requestResetAction} className="space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required className="input" />
        </label>
        <SubmitButton className="btn btn-primary w-full" pending="Enviando…">
          Enviar enlace
        </SubmitButton>
      </ActionForm>
      <Link href="/login" className="mt-4 block text-sm text-muted hover:text-ink">
        ← Volver a ingresar
      </Link>
    </>
  );
}
