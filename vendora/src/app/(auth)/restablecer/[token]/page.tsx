import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/client";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-bold">Elegí una contraseña nueva</h1>
      <ActionForm action={resetPasswordAction.bind(null, token)} className="mt-6 space-y-4">
        <label className="block">
          <span className="label">Contraseña nueva</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </label>
        <SubmitButton className="btn btn-primary w-full">Guardar y entrar</SubmitButton>
      </ActionForm>
    </>
  );
}
