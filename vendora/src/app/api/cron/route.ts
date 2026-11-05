import { NextResponse } from "next/server";
import { runCron } from "@/lib/cron";
import { safeEqual } from "@/lib/crypto";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const query = new URL(req.url).searchParams.get("secret") || "";
  return (header && safeEqual(header, secret)) || (query && safeEqual(query, secret));
}

/** Tareas periódicas: carritos abandonados, facturación, trabajos de IA, tipos de cambio y limpieza. */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await runCron());
}

export const POST = GET;
