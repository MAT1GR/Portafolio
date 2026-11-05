import { requireUser } from "@/lib/auth";
import { changePasswordAction, updateProfileAction } from "../actions/account";
import { ActionForm, SubmitButton, Toggle } from "@/components/client";
import { Card, Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Mi cuenta" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Datos">
          <ActionForm action={updateProfileAction} className="grid gap-4">
            <Field label="Nombre">
              <input name="name" defaultValue={user.name} className="input" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={user.email} className="input" />
            </Field>
            <Toggle name="notifyEmailOnSale" defaultChecked={user.notifyEmailOnSale} label="Recibir un email por cada venta" />
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Contraseña">
          <ActionForm action={changePasswordAction} className="grid gap-4" reset>
            <Field label="Contraseña actual">
              <input name="current" type="password" required autoComplete="current-password" className="input" />
            </Field>
            <Field label="Contraseña nueva">
              <input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" />
            </Field>
            <SubmitButton>Cambiar contraseña</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
