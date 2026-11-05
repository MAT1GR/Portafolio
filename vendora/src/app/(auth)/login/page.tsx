import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/panel");
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Ingresá a tu cuenta</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="link">
          Creala gratis
        </Link>
      </p>
      <ActionForm action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        <SubmitButton className="btn btn-primary w-full" pending="Ingresando…">
          Ingresar
        </SubmitButton>
      </ActionForm>
      <Link href="/recuperar" className="mt-4 block text-sm text-muted hover:text-ink">
        Olvidé mi contraseña
      </Link>
    </>
  );
}
