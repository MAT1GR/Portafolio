import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import { LimitError } from "./plans";
import { CheckoutError } from "./orders";
import { AiError } from "./ai";
import { GatewayError } from "./gateways/types";

export type ActionResult = { ok: boolean; message?: string; redirect?: string; data?: Record<string, unknown> } | null;

export class UserError extends Error {}

const KNOWN: (new (...args: never[]) => Error)[] = [AuthError, LimitError, CheckoutError, AiError, GatewayError, UserError];

export function friendlyError(e: unknown) {
  if (e instanceof ZodError) return e.issues[0]?.message || "Revisá los datos del formulario";
  if (KNOWN.some((K) => e instanceof K)) return (e as Error).message;
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return "Ya existe un registro con ese valor (debe ser único).";
  console.error(e);
  return "Ocurrió un error inesperado. Probá de nuevo.";
}

/** Envuelve una server action: errores conocidos → mensaje para el usuario. */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const r = await fn();
    return r ?? { ok: true, message: "Cambios guardados" };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, message: friendlyError(e) };
  }
}

/** Lectura tipada de FormData. */
export const form = {
  str(fd: FormData, key: string, max = 2000) {
    return String(fd.get(key) ?? "").trim().slice(0, max);
  },
  req(fd: FormData, key: string, label: string, max = 2000) {
    const v = String(fd.get(key) ?? "").trim().slice(0, max);
    if (!v) throw new UserError(`Completá ${label}`);
    return v;
  },
  opt(fd: FormData, key: string, max = 2000) {
    const v = String(fd.get(key) ?? "").trim().slice(0, max);
    return v || null;
  },
  num(fd: FormData, key: string, fallback = 0) {
    const raw = String(fd.get(key) ?? "").trim().replace(/\s/g, "");
    if (!raw) return fallback;
    const normalized = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw.replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  },
  numOrNull(fd: FormData, key: string) {
    const raw = String(fd.get(key) ?? "").trim();
    if (!raw) return null;
    const n = form.num(fd, key, NaN);
    return Number.isFinite(n) ? n : null;
  },
  int(fd: FormData, key: string, fallback = 0) {
    return Math.round(form.num(fd, key, fallback));
  },
  bool(fd: FormData, key: string) {
    const v = fd.get(key);
    return v === "on" || v === "true" || v === "1";
  },
  list(fd: FormData, key: string) {
    return fd.getAll(key).map((v) => String(v)).filter(Boolean);
  },
  email(fd: FormData, key: string) {
    const v = String(fd.get(key) ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) throw new UserError("Ingresá un email válido");
    return v;
  },
};
