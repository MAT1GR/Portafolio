import nodemailer from "nodemailer";
import { db } from "./db";
import { env } from "./env";

let transporter: nodemailer.Transporter | null = null;

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  kind: string;
  storeId?: string | null;
  fromName?: string;
  replyTo?: string | null;
};

/** Envía por SMTP si está configurado; siempre deja registro (sin SMTP queda visible en /admin/correos). */
export async function sendEmail(input: SendEmailInput) {
  const msg = await db.emailMessage.create({
    data: {
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? htmlToText(input.html),
      kind: input.kind,
      storeId: input.storeId ?? null,
    },
  });
  const transport = getTransport();
  if (!transport) {
    await db.emailMessage.update({ where: { id: msg.id }, data: { status: "LOGGED" } });
    return msg.id;
  }
  try {
    const from = process.env.SMTP_FROM || `${env.brand} <no-reply@localhost>`;
    const fromAddress = from.match(/<(.+)>/)?.[1] ?? from;
    await transport.sendMail({
      from: input.fromName ? `"${input.fromName.replace(/"/g, "")}" <${fromAddress}>` : from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? htmlToText(input.html),
      replyTo: input.replyTo || undefined,
    });
    await db.emailMessage.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: new Date() } });
  } catch (e) {
    await db.emailMessage.update({ where: { id: msg.id }, data: { status: "FAILED", error: String(e).slice(0, 500) } });
  }
  return msg.id;
}

export function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type EmailLayout = {
  brandName: string;
  color?: string;
  logoUrl?: string | null;
  title: string;
  paragraphs?: string[]; // texto plano (se escapa)
  htmlBlocks?: string[]; // HTML ya seguro
  cta?: { text: string; url: string } | null;
  footer?: string;
};

/** Plantilla de email simple, compatible con clientes de correo. */
export function renderEmail(l: EmailLayout) {
  const color = l.color || "#FF5B2E";
  const header = l.logoUrl
    ? `<img src="${esc(l.logoUrl)}" alt="${esc(l.brandName)}" style="max-height:44px;max-width:200px">`
    : `<div style="font-size:20px;font-weight:700;color:#17142A">${esc(l.brandName)}</div>`;
  const paragraphs = (l.paragraphs ?? []).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p)}</p>`).join("");
  const blocks = (l.htmlBlocks ?? []).join("");
  const cta = l.cta
    ? `<p style="margin:22px 0"><a href="${esc(l.cta.url)}" style="background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${esc(l.cta.text)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f4f0;font-family:Helvetica,Arial,sans-serif;color:#17142A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="padding-bottom:18px;border-bottom:3px solid ${color}">${header}</td></tr>
<tr><td style="padding-top:22px;font-size:15px">
<h1 style="font-size:22px;margin:0 0 16px">${esc(l.title)}</h1>
${paragraphs}${blocks}${cta}
</td></tr></table>
<p style="font-size:12px;color:#7a7488;max-width:560px;margin:14px auto 0;line-height:1.5">${esc(l.footer ?? "")}</p>
</td></tr></table></body></html>`;
}

/** Fila de link para listas de accesos en emails. */
export function emailLinkRow(label: string, url: string, linkText: string) {
  return `<div style="border:1px solid #ece8e1;border-radius:12px;padding:12px 14px;margin:0 0 10px"><div style="font-weight:600;margin-bottom:6px">${esc(label)}</div><a href="${esc(url)}" style="color:#17142A;font-weight:600">${esc(linkText)} →</a></div>`;
}
