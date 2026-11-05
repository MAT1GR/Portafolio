import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, CreditCard, GitBranch, Globe, Mail, ShoppingBag, Smartphone, Sparkles, Target, Users } from "lucide-react";
import { db } from "@/lib/db";
import { DEFAULT_PLANS } from "@/lib/bootstrap";
import { planFeatures } from "@/lib/plans";
import { num } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth";
import type { Plan } from "@prisma/client";

const FEATURES = [
  { icon: Sparkles, title: "Tienda y producto con IA", text: "Contale tu idea y la IA arma la tienda, el ebook en PDF, la página de venta, los bonos, el order bump y el upsell. Vos revisás y publicás." },
  { icon: ShoppingBag, title: "Checkout que convierte", text: "Una sola página, solo el email obligatorio, order bumps con un clic, cupones, garantía y precio en la moneda del comprador." },
  { icon: GitBranch, title: "Upsells 1-click post-compra", text: "Embudos de upsell y downsell con ramas, reserva con timer, HTML propio y tests A/B. Con Stripe se cobra sin volver a pedir la tarjeta." },
  { icon: CreditCard, title: "Cobrás con lo que quieras", text: "Mercado Pago, Stripe, PayPal, Whop (USD sin LLC) y transferencia. El dinero entra directo a tu cuenta." },
  { icon: Mail, title: "Entrega automática", text: "Apenas se acredita el pago, el comprador recibe sus links por email (con vencimiento y tope de descargas) y un área de miembros para cursos." },
  { icon: Target, title: "Píxel + API de Conversiones", text: "Meta Pixel y CAPI con deduplicación, GA4 y TikTok. Los UTM viajan hasta el checkout y quedan en cada venta." },
  { icon: BarChart3, title: "Métricas que importan", text: "Ingresos, ventas, ticket promedio, conversión, embudo visitas → compra y campañas UTM, en la moneda que elijas." },
  { icon: Globe, title: "Multi-tienda y multi-país", text: "Markets por país con su moneda y precios propios, 10 idiomas, dominio propio y duplicado de tiendas para lanzar en otro mercado." },
  { icon: BookOpen, title: "Carritos recuperados", text: "Secuencia de emails para quienes dejaron el email y no pagaron, con cupón opcional y link al checkout precargado." },
  { icon: Users, title: "Tu equipo adentro", text: "Invitá a tu equipo con roles: administrador, editor, soporte o analista." },
  { icon: Smartphone, title: "App con aviso de cada venta", text: "Instalala en el celular y recibí una notificación por cada venta, con el feed en vivo y las métricas del día." },
];

const FAQ = [
  ["¿Necesito saber programar?", "No. Creás la tienda desde el panel (o con IA), subís tu archivo, ponés el precio y conectás un medio de pago. Si querés, podés pegar tu propio HTML en la landing y en las ofertas."],
  ["¿Cuánto cuesta?", "Podés empezar gratis, sin tarjeta. Los planes pagos tienen prueba gratis y una comisión por venta más baja. PayPal y transferencia no pagan comisión."],
  ["¿Dónde recibo el dinero?", "En tu propia cuenta de Mercado Pago, Stripe, PayPal o Whop. La plataforma no retiene tus cobros: la comisión se factura una vez por mes."],
  ["¿Puedo vender en otros países?", "Sí. Creás markets por país con su moneda (EUR, RON, CZK, HUF, MXN…), la tienda en su idioma y cobrás con Stripe, PayPal o Whop."],
  ["¿Qué pasa si el comprador pierde el link?", "Entra a Mis compras con su email y recibe un enlace de acceso. Desde el panel también podés reenviarle los accesos o restablecer sus descargas."],
];

export default async function Home() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Vendora";
  const user = await getCurrentUser();
  let plans: Pick<Plan, "key" | "name" | "description" | "priceUsd" | "commissionBps" | "maxStores" | "aiEbooksPerMonth" | "maxBonusesPerStore" | "maxUpsellsPerStore" | "cartRecovery" | "teamRoles" | "trialDays">[] = [];
  try {
    plans = await db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  } catch {
    plans = [];
  }
  if (!plans.length) plans = DEFAULT_PLANS as never;

  return (
    <div className="bg-paper">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-display text-xl font-extrabold">
            {brand}
            <span className="text-brand">.</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a href="#funciones" className="hidden px-3 py-2 font-medium text-muted hover:text-ink sm:inline">
              Funciones
            </a>
            <a href="#precios" className="hidden px-3 py-2 font-medium text-muted hover:text-ink sm:inline">
              Precios
            </a>
            {user ? (
              <Link href="/panel" className="btn btn-primary btn-sm">
                Ir al panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  Ingresar
                </Link>
                <Link href="/registro" className="btn btn-brand btn-sm">
                  Empezar gratis
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute top-40 -left-40 h-[420px] w-[420px] rounded-full bg-mint/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ring-line">
            <Sparkles size={14} className="text-brand" /> Ebooks, cursos, plantillas y productos digitales
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
            Vendé tus productos digitales con un checkout que <span className="text-brand">sube el ticket</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Tienda con IA, checkout de alta conversión, order bumps, upsells 1-click, entrega automática y métricas por campaña. Cobrás con Mercado Pago, Stripe, PayPal, Whop o transferencia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className="btn btn-brand px-6 py-3.5 text-base">
              Crear mi tienda gratis <ArrowRight size={18} />
            </Link>
            <a href="#precios" className="btn btn-secondary px-6 py-3.5 text-base">
              Ver planes
            </a>
          </div>
          <p className="mt-4 text-sm text-muted">Sin tarjeta para empezar · Cancelás cuando quieras</p>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-5">
          {["Mercado Pago", "Stripe", "PayPal", "Whop", "Transferencia"].map((g) => (
            <div key={g} className="font-display text-lg font-bold text-ink/60">
              {g}
            </div>
          ))}
        </div>
      </section>

      <section id="funciones" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl text-3xl font-extrabold sm:text-4xl">Todo lo que necesitás para vender, en un solo lugar.</h2>
        <p className="mt-3 max-w-2xl text-muted">Pensado para quienes venden productos digitales de bajo ticket con tráfico pago, en uno o muchos países.</p>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-dark">
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 px-4 py-20 md:grid-cols-3">
          {[
            ["1", "Creá tu tienda", "A mano o con IA. Elegís idioma, moneda y markets."],
            ["2", "Cargá y conectá", "Subís el PDF o el curso, armás bumps y upsells, y conectás tu medio de pago."],
            ["3", "Publicá y medí", "Pegás el píxel, lanzás los anuncios y mirás ventas, conversión y campañas en vivo."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <div className="font-display text-5xl font-extrabold text-brand">{n}</div>
              <h3 className="mt-3 text-xl font-bold">{t}</h3>
              <p className="mt-1 text-white/70">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="precios" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold sm:text-4xl">Planes</h2>
        <p className="mt-2 text-muted">Empezá gratis. Cuando vendas más, bajá la comisión.</p>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p, i) => {
            const price = num(p.priceUsd as never);
            const featured = i === 2;
            return (
              <div key={p.key} className={`flex flex-col rounded-3xl p-6 ${featured ? "bg-ink text-white" : "card"}`}>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-2 font-display text-4xl font-extrabold">
                  {price ? `US$ ${price}` : "Gratis"}
                  {price ? <span className={`text-sm font-normal ${featured ? "text-white/60" : "text-muted"}`}>/mes</span> : null}
                </div>
                <p className={`mt-1 text-sm ${featured ? "text-white/70" : "text-muted"}`}>{p.description}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {planFeatures(p as Plan).map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/registro" className={`btn mt-6 w-full ${featured ? "btn-brand" : "btn-primary"}`}>
                  {price && p.trialDays ? `Probar ${p.trialDays} días gratis` : "Empezar"}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="mb-6 text-3xl font-extrabold">Preguntas frecuentes</h2>
        <div className="space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="card p-5">
              <summary className="cursor-pointer list-none font-semibold">{q}</summary>
              <p className="mt-2 leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Tu próxima venta puede ser hoy.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">Creá tu tienda en minutos y probá el flujo completo con la pasarela de prueba antes de publicitar.</p>
          <Link href="/registro" className="btn mt-7 bg-white px-6 py-3.5 text-base text-ink hover:bg-white/90">
            Crear mi tienda gratis <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
          <span>
            © {new Date().getFullYear()} {brand}
          </span>
          <span className="flex gap-4">
            <Link href="/login">Ingresar</Link>
            <Link href="/registro">Crear cuenta</Link>
            <Link href="/app">App</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
