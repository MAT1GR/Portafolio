import { readLocal } from "@/lib/storage";

/** Archivos públicos (imágenes de tiendas y productos) con el driver local. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const path = `public/${key.map(decodeURIComponent).join("/")}`;
  if (path.includes("..")) return new Response("No encontrado", { status: 404 });
  try {
    const file = await readLocal(path);
    if (!file) return new Response("No encontrado", { status: 404 });
    return new Response(file.stream, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src * data:; media-src *; sandbox",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
