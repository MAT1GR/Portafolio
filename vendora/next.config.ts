import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  // Fuentes TTF para generar PDFs y tapas (se leen del disco en tiempo de ejecución)
  outputFileTracingIncludes: {
    "/**": ["./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif.ttf", "./node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf"],
  },
  serverExternalPackages: ["pdfkit", "@resvg/resvg-js", "web-push", "nodemailer", "stripe"],
  poweredByHeader: false,
  // El tipado se valida con `npm run typecheck`; evita que tome la config ESLint del repo padre.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
