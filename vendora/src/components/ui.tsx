import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex text-sm text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, children, actions, className }: { title?: ReactNode; description?: ReactNode; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("card p-5 sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

const TONES = {
  neutral: "bg-black/5 text-ink",
  brand: "bg-brand-soft text-brand-dark",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  mint: "bg-mint-soft text-mint",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cn("badge", TONES[tone])}>{children}</span>;
}

export function Notice({ children, tone = "neutral", title }: { children: ReactNode; tone?: keyof typeof TONES; title?: ReactNode }) {
  return (
    <div className={cn("rounded-xl px-4 py-3 text-sm", TONES[tone])}>
      {title && <div className="mb-0.5 font-semibold">{title}</div>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 h-10 w-10 rounded-full bg-brand-soft" />
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "up" | "down" | null }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className={cn("mt-1 text-xs", tone === "up" ? "text-ok" : tone === "down" ? "text-bad" : "text-muted")}>{sub}</div>}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: ReactNode; key: string }[]; active: string }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
            i.key === active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })} %`;
}

export function fmtDate(d: Date | string | null | undefined, tz?: string, withTime = true) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(d));
}

export const ORDER_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  PENDING: { label: "Pendiente", tone: "warn" },
  PAID: { label: "Pagado", tone: "ok" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", tone: "warn" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  FAILED: { label: "Rechazado", tone: "bad" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  PENDING: { label: "Pendiente", tone: "warn" },
  APPROVED: { label: "Aprobado", tone: "ok" },
  REJECTED: { label: "Rechazado", tone: "bad" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

export const PROVIDER_LABEL: Record<string, string> = {
  MERCADOPAGO: "Mercado Pago",
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  WHOP: "Whop",
  TRANSFER: "Transferencia",
  TEST: "Prueba",
};
