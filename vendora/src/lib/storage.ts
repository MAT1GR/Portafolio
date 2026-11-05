import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { randomToken } from "./crypto";

/**
 * Archivos de la plataforma.
 * - "public/..." : imágenes de tiendas y productos (se sirven sin autenticación).
 * - "private/...": archivos de productos (solo se descargan con un token de entrega).
 * Driver local (disco) o S3-compatible (AWS S3, Cloudflare R2, MinIO, Supabase Storage).
 */

const driver = () => (process.env.STORAGE_DRIVER === "s3" ? "s3" : "local");
const localDir = () => path.resolve(process.env.LOCAL_STORAGE_DIR || "./storage");

let s3: S3Client | null = null;
function s3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return s3;
}
const bucket = () => process.env.S3_BUCKET || "";

export function isS3() {
  return driver() === "s3";
}

export function safeName(name: string) {
  const base = name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(-80);
  return base || "archivo";
}

export function makeKey(visibility: "public" | "private", scope: string, filename: string) {
  return `${visibility}/${scope}/${Date.now().toString(36)}-${randomToken(6)}-${safeName(filename)}`;
}

function assertKey(key: string) {
  if (!/^(public|private)\/[\w\-./]+$/.test(key) || key.includes("..")) throw new Error("Clave de archivo inválida");
}

export function publicUrl(key: string) {
  assertKey(key);
  if (isS3() && process.env.S3_PUBLIC_URL) return `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return `${env.appUrl}/media/${key.replace(/^public\//, "")}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  assertKey(key);
  if (isS3()) {
    await s3Client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const file = path.join(localDir(), key);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, body);
  await fs.promises.writeFile(`${file}.meta`, JSON.stringify({ contentType }));
}

export async function copyObject(fromKey: string, toKey: string) {
  assertKey(fromKey);
  assertKey(toKey);
  if (isS3()) {
    await s3Client().send(new CopyObjectCommand({ Bucket: bucket(), Key: toKey, CopySource: `${bucket()}/${fromKey}` }));
    return;
  }
  const from = path.join(localDir(), fromKey);
  const to = path.join(localDir(), toKey);
  await fs.promises.mkdir(path.dirname(to), { recursive: true });
  await fs.promises.copyFile(from, to);
  if (fs.existsSync(`${from}.meta`)) await fs.promises.copyFile(`${from}.meta`, `${to}.meta`);
}

export async function deleteObject(key: string) {
  assertKey(key);
  if (isS3()) {
    await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return;
  }
  const file = path.join(localDir(), key);
  await fs.promises.rm(file, { force: true });
  await fs.promises.rm(`${file}.meta`, { force: true });
}

export async function readLocal(key: string): Promise<{ stream: ReadableStream; size: number; contentType: string } | null> {
  assertKey(key);
  const file = path.join(localDir(), key);
  if (!fs.existsSync(file)) return null;
  const stat = await fs.promises.stat(file);
  let contentType = "application/octet-stream";
  try {
    contentType = JSON.parse(await fs.promises.readFile(`${file}.meta`, "utf8")).contentType || contentType;
  } catch {
    /* sin metadatos */
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as unknown as ReadableStream;
  return { stream, size: stat.size, contentType };
}

export async function readBuffer(key: string): Promise<Buffer | null> {
  assertKey(key);
  if (isS3()) {
    const res = await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  }
  const file = path.join(localDir(), key);
  return fs.existsSync(file) ? fs.promises.readFile(file) : null;
}

/** URL firmada de descarga (S3) para archivos privados. */
export async function signedDownloadUrl(key: string, filename: string, seconds = 300) {
  assertKey(key);
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: `attachment; filename="${safeName(filename)}"` }),
    { expiresIn: seconds },
  );
}

/** URL firmada de subida directa al bucket (evita el límite de tamaño de las funciones serverless). */
export async function signedUploadUrl(key: string, contentType: string) {
  assertKey(key);
  return getSignedUrl(s3Client(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn: 900 });
}

/** Guarda en disco un cuerpo en streaming (subidas grandes con el driver local). Devuelve los bytes escritos. */
export async function putLocalStream(key: string, body: ReadableStream<Uint8Array>, contentType: string, maxBytes: number) {
  assertKey(key);
  const file = path.join(localDir(), key);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const out = fs.createWriteStream(file);
  let written = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      written += value.byteLength;
      if (written > maxBytes) throw new Error("El archivo supera el tamaño máximo permitido");
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (e) {
    out.destroy();
    await fs.promises.rm(file, { force: true });
    throw e;
  }
  await fs.promises.writeFile(`${file}.meta`, JSON.stringify({ contentType }));
  return written;
}

export async function objectExists(key: string) {
  assertKey(key);
  if (isS3()) {
    try {
      await s3Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: "bytes=0-0" }));
      return true;
    } catch {
      return false;
    }
  }
  return fs.existsSync(path.join(localDir(), key));
}
