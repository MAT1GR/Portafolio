import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, PageHeader, fmtDate } from "@/components/ui";

export default async function AdminEmails({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const emails = await db.emailMessage.findMany({ where: q ? { to: { contains: q, mode: "insensitive" } } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Correos" description={process.env.SMTP_HOST ? "Registro de todos los correos enviados." : "No hay SMTP configurado: los correos quedan acá (LOGGED) y no salen. Configurá SMTP_HOST para enviarlos."} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Filtrar por destinatario" className="input max-w-sm" />
        <button className="btn btn-primary">Filtrar</button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Para</th>
              <th>Asunto</th>
              <th>Tipo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id}>
                <td className="text-xs whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                <td className="text-xs">{e.to}</td>
                <td>
                  <Link href={`/admin/correos/${e.id}`} className="hover:underline">
                    {e.subject}
                  </Link>
                </td>
                <td className="text-xs">{e.kind}</td>
                <td>
                  <Badge tone={e.status === "SENT" ? "ok" : e.status === "FAILED" ? "bad" : "neutral"}>{e.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
