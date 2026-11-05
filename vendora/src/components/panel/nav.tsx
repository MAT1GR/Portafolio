"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, BookOpen, CreditCard, FileText, FlaskConical, GitBranch, Globe, Image as ImageIcon, LayoutGrid, LogOut, Menu, Package, Receipt,
  Settings, Shield, ShoppingBag, ShoppingCart, Smartphone, Tag, Target, User, Users, UsersRound, Wallet, X, Store as StoreIcon, Plus,
} from "lucide-react";

type StoreLink = { id: string; name: string; slug: string; role: string; perms: string[] };

const SECTIONS: { title: string; items: { href: string; label: string; icon: React.ElementType; perm: string }[] }[] = [
  {
    title: "General",
    items: [
      { href: "", label: "Inicio", icon: BarChart3, perm: "metrics" },
      { href: "/ventas", label: "Ventas", icon: Receipt, perm: "orders" },
      { href: "/clientes", label: "Clientes", icon: Users, perm: "orders" },
      { href: "/carritos", label: "Carritos abandonados", icon: ShoppingCart, perm: "orders" },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/productos", label: "Productos", icon: Package, perm: "products" },
      { href: "/ebooks", label: "Ebooks con IA", icon: BookOpen, perm: "products" },
    ],
  },
  {
    title: "Conversión",
    items: [
      { href: "/checkout", label: "Checkout y bumps", icon: ShoppingBag, perm: "marketing" },
      { href: "/embudos", label: "Embudos post-compra", icon: GitBranch, perm: "marketing" },
      { href: "/marketing/ab", label: "Tests A/B", icon: FlaskConical, perm: "marketing" },
      { href: "/marketing/cupones", label: "Cupones", icon: Tag, perm: "marketing" },
      { href: "/marketing/pixel", label: "Píxel y tracking", icon: Target, perm: "marketing" },
    ],
  },
  {
    title: "Tienda",
    items: [
      { href: "/contenido", label: "Contenido", icon: FileText, perm: "content" },
      { href: "/recursos", label: "Recursos", icon: ImageIcon, perm: "content" },
      { href: "/markets", label: "Markets y monedas", icon: Globe, perm: "settings" },
      { href: "/pagos", label: "Medios de pago", icon: CreditCard, perm: "payments" },
    ],
  },
  {
    title: "Ajustes",
    items: [
      { href: "/equipo", label: "Equipo", icon: UsersRound, perm: "team" },
      { href: "/configuracion", label: "Configuración", icon: Settings, perm: "settings" },
    ],
  },
];

export function PanelNav({ stores, user, brand, isAdmin }: { stores: StoreLink[]; user: { name: string; email: string; plan: string }; brand: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const match = pathname.match(/^\/panel\/([^/]+)/);
  const currentId = match && !["nueva", "cuenta", "plan"].includes(match[1]) ? match[1] : null;
  const current = stores.find((s) => s.id === currentId) ?? null;

  const link = (href: string, label: string, Icon: React.ElementType, exact = false) => {
    const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-ink text-white" : "text-ink/75 hover:bg-black/5 hover:text-ink"}`}
      >
        <Icon size={16} strokeWidth={2} />
        {label}
      </Link>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link href="/panel" className="font-display text-xl font-extrabold tracking-tight">
          {brand}
          <span className="text-brand">.</span>
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
          <X size={20} />
        </button>
      </div>
      <div className="px-3">
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-semibold">
            <span className="flex min-w-0 items-center gap-2">
              <StoreIcon size={16} />
              <span className="truncate">{current ? current.name : "Mis tiendas"}</span>
            </span>
            <span className="text-muted">▾</span>
          </summary>
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white p-1 shadow-lg">
            {stores.map((s) => (
              <Link key={s.id} href={`/panel/${s.id}`} className="block truncate rounded-lg px-3 py-2 text-sm hover:bg-black/5">
                {s.name}
                {s.role !== "OWNER" && <span className="ml-1 text-xs text-muted">({s.role.toLowerCase()})</span>}
              </Link>
            ))}
            <Link href="/panel" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-black/5">
              Ver todas
            </Link>
            <Link href="/panel/nueva" className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-black/5">
              <Plus size={14} /> Nueva tienda
            </Link>
          </div>
        </details>
      </div>
      <nav className="mt-3 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {current ? (
          SECTIONS.map((sec) => {
            const items = sec.items.filter((i) => current.perms.includes(i.perm));
            if (!items.length) return null;
            return (
              <div key={sec.title}>
                <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">{sec.title}</div>
                <div className="space-y-0.5">{items.map((i) => link(`/panel/${current.id}${i.href}`, i.label, i.icon, i.href === ""))}</div>
              </div>
            );
          })
        ) : (
          <div className="space-y-0.5">{link("/panel", "Mis tiendas", LayoutGrid, true)}</div>
        )}
        <div>
          <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Cuenta</div>
          <div className="space-y-0.5">
            {link("/panel/plan", "Plan y facturación", Wallet)}
            {link("/panel/cuenta", "Mi cuenta", User)}
            {link("/app", "App móvil", Smartphone)}
            {isAdmin && link("/admin", "Administración", Shield)}
          </div>
        </div>
      </nav>
      <div className="border-t border-line px-4 py-3">
        <div className="truncate text-sm font-semibold">{user.name}</div>
        <div className="truncate text-xs text-muted">
          {user.email} · {user.plan}
        </div>
        <form action="/api/auth/logout" method="post" className="mt-2">
          <button className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <LogOut size={13} /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="flex items-center gap-2 text-sm font-semibold">
          <Menu size={20} /> {current?.name ?? brand}
        </button>
      </div>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-paper lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-paper shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}
