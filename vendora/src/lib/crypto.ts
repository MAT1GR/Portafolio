import crypto from "node:crypto";

function key() {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("Falta ENCRYPTION_KEY en las variables de entorno");
  return crypto.createHash("sha256").update(k).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Dato cifrado inválido");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown) {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(payload: string | null | undefined, fallback: T): T {
  if (!payload) return fallback;
  try {
    return JSON.parse(decrypt(payload)) as T;
  } catch {
    return fallback;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmacHex(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Secreto de firma de sesiones y enlaces. En producción es obligatorio (sin él cualquiera podría falsificar sesiones). */
export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta AUTH_SECRET (mínimo 16 caracteres) en las variables de entorno");
  return "dev-secret-change-me";
}

/** Firma corta para enlaces (ej. aceptar una oferta). */
export function signValue(value: string) {
  const secret = authSecret();
  return crypto.createHmac("sha256", secret).update(value).digest("base64url").slice(0, 24);
}

export function verifySigned(value: string, sig: string | null | undefined) {
  return !!sig && safeEqual(signValue(value), sig);
}
