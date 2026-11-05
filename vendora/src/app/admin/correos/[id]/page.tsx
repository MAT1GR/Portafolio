import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, fmtDate } from "@/components/ui";

export default async function AdminEmail({ params }: { params: Promise<{ id: string }> }) {
  const email = await db.emailMessage.findUnique({ where: { id: (await params).id } });
  if (!email) notFound();
  return (
    <>
      <PageHeader title={email.subject} description={`${email.to} · ${fmtDate(email.createdAt)} · ${email.status}${email.error ? ` · ${email.error}` : ""}`} back={{ href: "/admin/correos", label: "Correos" }} />
      <iframe title="Vista del email" sandbox="" srcDoc={email.html} className="h-[75vh] w-full rounded-2xl border border-line bg-white" />
    </>
  );
}
