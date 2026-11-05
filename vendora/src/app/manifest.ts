import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Vendora";
  return {
    name: `${brand} — Ventas`,
    short_name: brand,
    description: "Tus ventas en vivo, con aviso por cada venta.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#fbf8f3",
    theme_color: "#17142a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
