import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Vendora";
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="font-display text-2xl font-extrabold">
          {brand}
          <span className="text-brand">.</span>
        </Link>
        <div>
          <p className="max-w-md font-display text-4xl leading-tight font-bold">Vendé tus productos digitales con un checkout que convierte.</p>
          <p className="mt-4 max-w-md text-white/70">Tienda con IA, order bumps, upsells 1-click, entrega automática y métricas por campaña en un solo lugar.</p>
        </div>
        <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-brand/80 blur-2xl" />
        <p className="relative text-sm text-white/50">Mercado Pago · Stripe · PayPal · Whop · Transferencia</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 block font-display text-2xl font-extrabold lg:hidden">
            {brand}
            <span className="text-brand">.</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
