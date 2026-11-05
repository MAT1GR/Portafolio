import { NextResponse } from "next/server";
import { verifySigned } from "@/lib/crypto";
import { putLocalStream } from "@/lib/storage";

/** Recibe la subida directa (driver local). La URL viene firmada desde /api/upload. */
export async function PUT(req: Request) {
  const u = new URL(req.url);
  const key = u.searchParams.get("key") || "";
  const exp = u.searchParams.get("exp") || "0";
  const max = u.searchParams.get("max") || "0";
  const type = u.searchParams.get("type") || "application/octet-stream";
  if (!verifySigned(`${key}|${exp}|${max}`, u.searchParams.get("sig"))) return NextResponse.json({ error: "Firma inválida" }, { status: 403 });
  if (Number(exp) < Date.now()) return NextResponse.json({ error: "La subida venció" }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: "Archivo vacío" }, { status: 400 });
  try {
    const bytes = await putLocalStream(key, req.body, type, Number(max) + 1024);
    return NextResponse.json({ ok: true, bytes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
