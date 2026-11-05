import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { Toaster } from "@/components/client";

export const metadata = { title: "Administración" };

const NAV = [
  ["/admin", "Resumen"],
  ["/admin/usuarios", "Usuarios"],
  ["/admin/tiendas", "Tiendas"],
  ["/admin/facturas", "Facturas"],
  ["/admin/planes", "Planes"],
  ["/admin/correos", "Correos"],
  ["/admin/tipos-de-cambio", "Tipos de cambio"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-display text-lg font-extrabold">
            {env.brand}
            <span className="text-brand">.</span> <span className="text-sm font-medium text-white/60">administración</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="rounded-lg px-2.5 py-1 text-white/80 hover:bg-white/10 hover:text-white">
                {label}
              </Link>
            ))}
            <Link href="/panel" className="rounded-lg px-2.5 py-1 text-white/80 hover:bg-white/10">
              ← Panel
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
