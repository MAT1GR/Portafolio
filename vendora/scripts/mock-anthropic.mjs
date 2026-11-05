/**
 * Servidor que imita la API de Messages de Anthropic (streaming SSE) para probar las funciones de IA sin clave real.
 * Uso: node scripts/mock-anthropic.mjs 4010  → ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=test
 * Responde JSON válido contra el json_schema pedido, o un capítulo en markdown si no hay esquema.
 */
import http from "node:http";

const port = Number(process.argv[2] || 4010);
let calls = 0;

function sample(schema, key = "") {
  if (!schema || typeof schema !== "object") return null;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties || {})) out[k] = sample(v, k);
      return out;
    }
    case "array": {
      const n = key === "chapters" || key === "ebookOutline" ? 3 : key === "bonuses" ? 2 : 3;
      return Array.from({ length: n }, (_, i) => {
        const v = sample(schema.items, key);
        if (typeof v === "string") return `${v} ${i + 1}`;
        if (v && typeof v === "object" && "title" in v) v.title = `${v.title} ${i + 1}`;
        return v;
      });
    }
    case "number":
    case "integer":
      if (/compare/i.test(key)) return 24.99;
      if (/price/i.test(key)) return 12.99;
      return 3;
    case "string":
      if (/color|background|foreground|accent/i.test(key)) return { primaryColor: "#E4572E", accentColor: "#1D3557", background: "#1D3557", foreground: "#FFFFFF", accent: "#E4572E" }[key] || "#E4572E";
      if (key === "storeName") return "Tienda Demo IA";
      if (key === "name") return "Guía práctica de prueba";
      if (key === "title") return "Título generado por la IA de prueba";
      if (key === "badge") return "Guía práctica";
      return `Texto de prueba (${key})`;
    case "boolean":
      return true;
    default:
      return null;
  }
}

function sse(res, text) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", { type: "message_start", message: { id: `msg_mock_${++calls}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 50, output_tokens: 0 } } });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  for (let i = 0; i < text.length; i += 400) send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + 400) } });
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: Math.ceil(text.length / 4) } });
  send("message_stop", { type: "message_stop" });
  res.end();
}

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (!req.url.startsWith("/v1/messages")) {
        res.writeHead(404).end();
        return;
      }
      let json = {};
      try {
        json = JSON.parse(body || "{}");
      } catch {
        json = {};
      }
      const schema = json.output_config?.format?.schema;
      const text = schema
        ? JSON.stringify(sample(schema))
        : "Este capítulo fue escrito por el servidor de prueba.\n\n## Primer paso\nHacé una lista de lo que necesitás.\n\n- Punto uno\n- Punto dos con **negrita**\n\n> Una cita para cerrar.\n\n## Ejercicio\n1. Anotá tu objetivo.\n2. Revisalo mañana.";
      if (json.stream) sse(res, text);
      else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: `msg_mock_${++calls}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 50, output_tokens: 100 } }));
      }
    });
  })
  .listen(port, () => console.log(`mock anthropic en :${port}`));
