import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Vendora";

export const metadata: Metadata = {
  title: { default: `${brand} · Vendé productos digitales`, template: `%s · ${brand}` },
  description: "Tienda con IA, checkout de alta conversión, order bumps, upsells 1-click, entrega automática y métricas para vender ebooks, cursos y productos digitales.",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17142a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
