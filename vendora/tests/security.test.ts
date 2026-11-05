import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { Webhook } from "standardwebhooks";
import { decrypt, decryptJson, encrypt, encryptJson, signValue, verifySigned } from "@/lib/crypto";
import { verifySignature } from "@/lib/gateways/mercadopago";
import { eventToStatus, verifyAndParse } from "@/lib/gateways/whop";
import { sanitizeBlocks, embedUrl } from "@/lib/blocks";
import { trackerScript } from "@/lib/tracker";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789";
  process.env.AUTH_SECRET = "test-auth-secret-0123456789";
});

describe("cifrado de credenciales", () => {
  it("ida y vuelta, con IV distinto cada vez", () => {
    const a = encrypt("APP_USR-123");
    expect(a).not.toBe(encrypt("APP_USR-123"));
    expect(decrypt(a)).toBe("APP_USR-123");
    expect(decryptJson(encryptJson({ k: 1 }), {})).toEqual({ k: 1 });
  });
  it("detecta datos alterados", () => {
    const a = encrypt("secreto").split(":");
    a[3] = Buffer.from("otro").toString("base64url");
    expect(() => decrypt(a.join(":"))).toThrow();
    expect(decryptJson(a.join(":"), "fallback")).toBe("fallback");
  });
  it("firma de enlaces", () => {
    const s = signValue("order|node");
    expect(verifySigned("order|node", s)).toBe(true);
    expect(verifySigned("order|otro", s)).toBe(false);
    expect(verifySigned("order|node", null)).toBe(false);
  });
});

describe("webhook de Mercado Pago (x-signature)", () => {
  const secret = "mp-webhook-secret";
  const sign = (manifest: string) => crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  it("acepta una firma válida y rechaza una alterada", () => {
    const ts = "1730790000";
    const v1 = sign(`id:12345;request-id:req-1;ts:${ts};`);
    const ok = new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" });
    expect(verifySignature(secret, ok, "12345")).toBe(true);
    expect(verifySignature(secret, ok, "99999")).toBe(false);
    expect(verifySignature("otra-clave", ok, "12345")).toBe(false);
    expect(verifySignature(secret, new Headers(), "12345")).toBe(false);
  });
  it("omite request-id si no viene en la notificación y pasa el id a minúsculas", () => {
    const ts = "1730790000";
    const v1 = sign(`id:abc123;ts:${ts};`);
    expect(verifySignature(secret, new Headers({ "x-signature": `ts=${ts},v1=${v1}` }), "ABC123")).toBe(true);
  });
});

describe("webhook de Whop (Standard Webhooks)", () => {
  const raw = "ws_secreto_de_prueba";
  const body = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_1", status: "paid", metadata: { payment_id: "vd_pay_1" } } });
  it("verifica la firma y mapea el estado", () => {
    const wh = new Webhook(Buffer.from(raw).toString("base64"));
    const ts = new Date();
    const headers = new Headers({ "webhook-id": "msg_1", "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)), "webhook-signature": wh.sign("msg_1", ts, body) });
    const ev = verifyAndParse({ webhookSecret: raw }, body, headers);
    expect(eventToStatus(ev)).toMatchObject({ status: "APPROVED", paymentId: "vd_pay_1", providerPaymentId: "pay_1" });
  });
  it("rechaza un cuerpo alterado", () => {
    const wh = new Webhook(Buffer.from(raw).toString("base64"));
    const ts = new Date();
    const headers = new Headers({ "webhook-id": "msg_2", "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)), "webhook-signature": wh.sign("msg_2", ts, body) });
    expect(() => verifyAndParse({ webhookSecret: raw }, body.replace("pay_1", "pay_2"), headers)).toThrow();
  });
});

describe("contenido de la página de venta", () => {
  it("descarta bloques desconocidos y URLs peligrosas", () => {
    const blocks = sanitizeBlocks([
      { type: "hero", title: "Hola", image: "javascript:alert(1)" },
      { type: "image", url: "https://cdn.example.com/a.png" },
      { type: "video", url: "data:text/html;base64,AAAA" },
      { type: "script", body: "<script>" },
      { type: "countdown", endsAt: "no es fecha" },
      { type: "faq", items: [{ q: "¿?", a: "Sí" }, { q: "", a: "sin pregunta" }] },
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["hero", "image", "video", "faq"]);
    expect(blocks[0]).toMatchObject({ image: undefined });
    expect(blocks[1]).toMatchObject({ url: "https://cdn.example.com/a.png" });
    expect(blocks[2]).toMatchObject({ url: "" });
    expect((blocks[3] as { items: unknown[] }).items).toHaveLength(1);
  });
  it("embebe YouTube/Vimeo y solo acepta video por http(s)", () => {
    expect(embedUrl("https://youtu.be/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456");
    expect(embedUrl("javascript:alert(1)//a.mp4")).toBeNull();
  });
});

describe("script de seguimiento", () => {
  it("es JavaScript válido y no permite cerrar la etiqueta script", () => {
    const js = trackerScript({ storeId: "s1", type: "PRODUCT_VIEW", productId: "p1", contentName: "</script><script>alert(1)</script>", pixelId: "123456789012345", value: 12.99, currency: "USD" });
    expect(() => new Function(js)).not.toThrow();
    expect(js.toLowerCase()).not.toContain("</script");
  });
  it("ignora IDs de píxel inválidos", () => {
    const js = trackerScript({ storeId: "s1", type: "PAGE_VIEW", pixelId: "x');alert(1);//" });
    expect(js).toContain('"pixelId":null');
  });
});
