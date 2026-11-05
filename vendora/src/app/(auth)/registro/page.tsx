import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";

export const metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invite?: string; email?: string }> }) {
  if (await getCurrentUser()) redirect("/panel");
  const { invite, email } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Creá tu tienda gratis</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Sin tarjeta. ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="link">
          Ingresá
        </Link>
      </p>
      <ActionForm action={registerAction} className="space-y-4">
        <input type="hidden" name="invite" value={invite ?? ""} />
        <label className="block">
          <span className="label">Nombre</span>
          <input name="name" required autoComplete="name" className="input" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          <span className="hint block">Mínimo 8 caracteres.</span>
        </label>
        <SubmitButton className="btn btn-brand w-full" pending="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-xs text-muted">Al crear tu cuenta aceptás los términos del servicio y la política de privacidad.</p>
    </>
  );
}
