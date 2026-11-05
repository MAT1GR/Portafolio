import Anthropic from "@anthropic-ai/sdk";
import { LANGUAGES } from "./i18n";

/**
 * Integración con Claude (Anthropic). Modelo por defecto: claude-opus-5-5 (configurable con ANTHROPIC_MODEL).
 * - JSON con structured outputs (output_config.format json_schema).
 * - Streaming + finalMessage() para respuestas largas (capítulos de ebook).
 * - fallbacks "default": si el modelo rechaza un pedido por sus filtros de seguridad, la API reintenta con el modelo recomendado.
 */

export class AiError extends Error {}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let _client: Anthropic | null = null;
function client() {
  if (!aiConfigured()) throw new AiError("La IA no está configurada: falta ANTHROPIC_API_KEY en las variables de entorno.");
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || undefined,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
      timeout: 10 * 60 * 1000,
      maxRetries: 2,
    });
  }
  return _client;
}

const model = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const effort = () => {
  const e = process.env.AI_EFFORT;
  return e === "low" || e === "high" || e === "medium" ? e : "medium";
};

export const HONESTY_RULES = `Reglas obligatorias:
- No inventes testimonios, reseñas, cifras de clientes, puntajes, premios ni sellos.
- No prometas resultados garantizados ni hagas afirmaciones médicas, legales o financieras que no se puedan sostener.
- No uses urgencia falsa (contadores que se reinician, "últimas unidades" en un producto digital).
- Escribí en el idioma pedido, con un tono natural para ese país (no traducción literal).`;

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function checkStop(msg: Anthropic.Beta.BetaMessage) {
  if (msg.stop_reason === "refusal") throw new AiError("La IA no pudo generar este contenido. Probá reformulando la idea.");
  if (msg.stop_reason === "max_tokens") throw new AiError("La respuesta de la IA quedó incompleta. Probá con menos capítulos o un pedido más corto.");
}

function wrapError(e: unknown): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new AiError("La clave de la IA (ANTHROPIC_API_KEY) no es válida.");
  if (e instanceof Anthropic.RateLimitError) throw new AiError("La IA está saturada en este momento. Probá de nuevo en unos minutos.");
  if (e instanceof Anthropic.APIError) throw new AiError(`Error de la IA (${e.status ?? "red"}): ${e.message}`);
  throw new AiError(`Error de la IA: ${(e as Error)?.message || String(e)}`);
}

/** Pide JSON validado contra un JSON Schema (structured outputs). */
export async function generateJson<T>(opts: { system: string; prompt: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<T> {
  try {
    const stream = client().beta.messages.stream({
      model: model(),
      max_tokens: opts.maxTokens ?? 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: effort(), format: { type: "json_schema", schema: opts.schema } },
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const msg = await stream.finalMessage();
    checkStop(msg);
    return JSON.parse(textOf(msg)) as T;
  } catch (e) {
    if (e instanceof SyntaxError) throw new AiError("La IA devolvió un formato inválido. Probá de nuevo.");
    wrapError(e);
  }
}

/** Texto largo (markdown) con streaming. */
export async function generateText(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  try {
    const stream = client().beta.messages.stream({
      model: model(),
      max_tokens: opts.maxTokens ?? 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: effort() },
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
    });
    const msg = await stream.finalMessage();
    checkStop(msg);
    return textOf(msg).trim();
  } catch (e) {
    wrapError(e);
  }
}

// ───────────── Esquemas ─────────────

type Schema = Record<string, unknown>;
const S = {
  str: (description?: string): Schema => ({ type: "string", ...(description ? { description } : {}) }),
  num: (description?: string): Schema => ({ type: "number", ...(description ? { description } : {}) }),
  int: (description?: string): Schema => ({ type: "integer", ...(description ? { description } : {}) }),
  arr: (items: Schema, description?: string): Schema => ({ type: "array", items, ...(description ? { description } : {}) }),
  enm: (values: string[], description?: string): Schema => ({ type: "string", enum: values, ...(description ? { description } : {}) }),
  obj: (properties: Record<string, Schema>, description?: string): Schema => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...(description ? { description } : {}),
  }),
};

export const SALES_PAGE_SCHEMA = S.obj({
  hero: S.obj({ title: S.str("Titular principal, concreto, con el resultado que busca el comprador"), subtitle: S.str(), ctaText: S.str("Texto del botón") }),
  intro: S.obj({ title: S.str(), body: S.str("2-3 párrafos cortos separados por \\n\\n sobre el problema y la solución") }),
  benefits: S.obj({ title: S.str(), items: S.arr(S.str(), "5-7 beneficios concretos") }),
  features: S.obj({ title: S.str("Qué incluye / qué vas a aprender"), items: S.arr(S.obj({ title: S.str(), text: S.str() }), "4-8 ítems") }),
  forWho: S.obj({ title: S.str(), items: S.arr(S.str(), "3-5 perfiles de comprador") }),
  offer: S.obj({ title: S.str(), ctaText: S.str(), note: S.str("Frase corta sobre el acceso inmediato") }),
  guarantee: S.obj({ title: S.str(), body: S.str() }),
  faq: S.obj({ title: S.str(), items: S.arr(S.obj({ q: S.str(), a: S.str() }), "4-6 preguntas reales sobre formato, acceso, pago y garantía") }),
  cta: S.obj({ title: S.str(), ctaText: S.str() }),
});

export type SalesPageAi = {
  hero: { title: string; subtitle: string; ctaText: string };
  intro: { title: string; body: string };
  benefits: { title: string; items: string[] };
  features: { title: string; items: { title: string; text: string }[] };
  forWho: { title: string; items: string[] };
  offer: { title: string; ctaText: string; note: string };
  guarantee: { title: string; body: string };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; ctaText: string };
};

export const STORE_SCHEMA = S.obj({
  storeName: S.str("Nombre de marca corto y memorable"),
  tagline: S.str(),
  description: S.str("Descripción de la tienda en 1-2 frases"),
  primaryColor: S.str("Color principal en hex #RRGGBB"),
  accentColor: S.str("Color oscuro de contraste en hex #RRGGBB"),
  aiContext: S.str("Contexto de marca para futuras generaciones: público, tono, promesa, palabras a evitar"),
  product: S.obj({
    name: S.str(),
    subtitle: S.str(),
    shortDescription: S.str(),
    description: S.str("Descripción completa en 2-4 párrafos"),
    type: S.enm(["EBOOK", "COURSE", "TEMPLATE", "AUDIO", "VIDEO", "SOFTWARE", "PACK"]),
    priceUsd: S.num("Precio sugerido en USD para un producto digital de bajo ticket"),
    compareAtPriceUsd: S.num("Precio de referencia tachado en USD (mayor al precio) o 0 si no corresponde"),
    deliveryNotice: S.str("Qué recibe el comprador y por dónde, en una frase"),
    checkoutSubtitle: S.str("Subtítulo corto para el checkout, ej. 'Ebook digital en PDF'"),
  }),
  salesPage: SALES_PAGE_SCHEMA,
  bonuses: S.arr(S.obj({ name: S.str(), description: S.str() }), "0 a 3 bonos que complementan el producto principal"),
  orderBump: S.obj({ name: S.str(), description: S.str(), headline: S.str("Encabezado corto del order bump"), buttonText: S.str(), priceUsd: S.num() }),
  upsell: S.obj({ name: S.str(), description: S.str(), title: S.str("Titular de la oferta post-compra"), body: S.str(), priceUsd: S.num() }),
  ebookOutline: S.arr(S.obj({ title: S.str(), summary: S.str() }), "Índice sugerido del producto principal (5-8 capítulos)"),
});

export type StoreAi = {
  storeName: string;
  tagline: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  aiContext: string;
  product: {
    name: string;
    subtitle: string;
    shortDescription: string;
    description: string;
    type: "EBOOK" | "COURSE" | "TEMPLATE" | "AUDIO" | "VIDEO" | "SOFTWARE" | "PACK";
    priceUsd: number;
    compareAtPriceUsd: number;
    deliveryNotice: string;
    checkoutSubtitle: string;
  };
  salesPage: SalesPageAi;
  bonuses: { name: string; description: string }[];
  orderBump: { name: string; description: string; headline: string; buttonText: string; priceUsd: number };
  upsell: { name: string; description: string; title: string; body: string; priceUsd: number };
  ebookOutline: { title: string; summary: string }[];
};

export const OUTLINE_SCHEMA = S.obj({
  title: S.str(),
  subtitle: S.str(),
  description: S.str("Descripción comercial del ebook en 2-3 frases"),
  chapters: S.arr(S.obj({ title: S.str(), summary: S.str(), keyPoints: S.arr(S.str()) })),
});

export type OutlineAi = { title: string; subtitle: string; description: string; chapters: { title: string; summary: string; keyPoints: string[] }[] };

export const COVER_SCHEMA = S.obj({
  title: S.str("Título tal como va en la tapa (puede acortarse)"),
  subtitle: S.str(),
  badge: S.str("Etiqueta corta opcional (ej. 'Guía práctica') o vacío"),
  background: S.str("Color de fondo #RRGGBB"),
  foreground: S.str("Color del texto #RRGGBB con buen contraste"),
  accent: S.str("Color de acento #RRGGBB"),
  style: S.enm(["minimal", "bold", "elegant", "playful"]),
  motif: S.enm(["circles", "waves", "grid", "stripes", "blob"]),
});

export type CoverAi = {
  title: string;
  subtitle: string;
  badge: string;
  background: string;
  foreground: string;
  accent: string;
  style: "minimal" | "bold" | "elegant" | "playful";
  motif: "circles" | "waves" | "grid" | "stripes" | "blob";
};

export function languageName(code: string) {
  return LANGUAGES[code]?.label ?? "Español";
}

// ───────────── Generadores ─────────────

export async function aiStore(input: { idea: string; audience: string; tone: string; language: string; extra?: string }) {
  return generateJson<StoreAi>({
    system: `Sos un estratega de productos digitales de bajo ticket y redactor publicitario para tiendas online. ${HONESTY_RULES}`,
    prompt: `Armá una tienda de productos digitales completa a partir de esta idea.
Idea del producto: ${input.idea}
Público: ${input.audience || "a definir por vos según la idea"}
Tono: ${input.tone || "cercano y claro"}
Idioma de TODO el contenido: ${languageName(input.language)}
${input.extra ? `Notas del vendedor: ${input.extra}` : ""}
El producto principal se vende como producto digital (entrega inmediata por email). Los bonos son entregables complementarios incluidos sin costo. El order bump es un complemento barato que se suma en el checkout. El upsell es una oferta post-compra relacionada que se ofrece después de pagar.`,
    schema: STORE_SCHEMA,
  });
}

export async function aiSalesPage(input: { productName: string; description: string; price: string; bonuses: string[]; guaranteeDays: number; language: string; context?: string | null }) {
  return generateJson<SalesPageAi>({
    system: `Sos un redactor de páginas de venta de productos digitales. ${HONESTY_RULES}`,
    prompt: `Escribí la página de venta de este producto.
Producto: ${input.productName}
Descripción: ${input.description || "(sin descripción)"}
Precio: ${input.price}
Bonos incluidos: ${input.bonuses.length ? input.bonuses.join(", ") : "ninguno"}
Garantía: ${input.guaranteeDays} días
Idioma: ${languageName(input.language)}
${input.context ? `Contexto de la marca: ${input.context}` : ""}`,
    schema: SALES_PAGE_SCHEMA,
  });
}

export async function aiOutline(input: { topic: string; audience: string; tone: string; chapters: number; language: string; context?: string | null }) {
  return generateJson<OutlineAi>({
    system: `Sos un autor de ebooks prácticos y editor. ${HONESTY_RULES}`,
    prompt: `Diseñá el índice de un ebook práctico.
Tema: ${input.topic}
Público: ${input.audience || "general"}
Tono: ${input.tone || "claro y cercano"}
Cantidad de capítulos: exactamente ${input.chapters}
Idioma: ${languageName(input.language)}
${input.context ? `Contexto de la marca: ${input.context}` : ""}
Cada capítulo debe aportar algo accionable y no repetirse con los otros.`,
    schema: OUTLINE_SCHEMA,
  });
}

export async function aiChapter(input: {
  outline: OutlineAi;
  index: number;
  audience: string;
  tone: string;
  language: string;
  wordsPerChapter: number;
  context?: string | null;
}) {
  const ch = input.outline.chapters[input.index];
  const toc = input.outline.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n");
  return generateText({
    system: `Sos un autor de ebooks prácticos. Escribís en markdown simple: subtítulos con "## ", listas con "- ", negritas con **texto** y citas con "> ". ${HONESTY_RULES}
No incluyas el título del capítulo al principio (ya se agrega en la maqueta). No agregues texto fuera del capítulo.`,
    prompt: `Ebook: "${input.outline.title}" — ${input.outline.subtitle}
Público: ${input.audience || "general"} · Tono: ${input.tone || "claro y cercano"} · Idioma: ${languageName(input.language)}
${input.context ? `Contexto de la marca: ${input.context}\n` : ""}Índice completo:
${toc}

Escribí el capítulo ${input.index + 1}: "${ch.title}".
Resumen: ${ch.summary}
Puntos clave: ${ch.keyPoints.join("; ")}
Extensión aproximada: ${input.wordsPerChapter} palabras. Incluí ejemplos concretos y pasos accionables. Cerrá con un resumen breve o un ejercicio.`,
    maxTokens: 32000,
  });
}

export async function aiCover(input: { title: string; subtitle?: string | null; language: string; context?: string | null; brandColors?: { primary: string; accent: string } }) {
  return generateJson<CoverAi>({
    system: "Sos diseñador editorial. Elegís una paleta con buen contraste y un estilo coherente con el tema. Respondés solo con el JSON pedido.",
    prompt: `Diseñá la tapa de este ebook.
Título: ${input.title}
Subtítulo: ${input.subtitle || ""}
Idioma: ${languageName(input.language)}
${input.context ? `Contexto de la marca: ${input.context}` : ""}
${input.brandColors ? `Colores de marca: ${input.brandColors.primary} y ${input.brandColors.accent} (podés usarlos o derivar una paleta compatible).` : ""}`,
    schema: COVER_SCHEMA,
    maxTokens: 4000,
  });
}

/** Convierte la respuesta de página de venta en bloques del editor. */
export function salesPageToBlocks(sp: SalesPageAi, opts: { image?: string | null; hasBonuses: boolean }) {
  const id = () => Math.random().toString(36).slice(2, 10);
  return [
    { id: id(), type: "hero", title: sp.hero.title, subtitle: sp.hero.subtitle, ctaText: sp.hero.ctaText, image: opts.image || undefined },
    { id: id(), type: "text", title: sp.intro.title, body: sp.intro.body },
    { id: id(), type: "benefits", title: sp.benefits.title, items: sp.benefits.items },
    { id: id(), type: "features", title: sp.features.title, items: sp.features.items },
    { id: id(), type: "benefits", title: sp.forWho.title, items: sp.forWho.items },
    ...(opts.hasBonuses ? [{ id: id(), type: "bonuses", title: "" }] : []),
    { id: id(), type: "offer", title: sp.offer.title, ctaText: sp.offer.ctaText, note: sp.offer.note },
    { id: id(), type: "guarantee", title: sp.guarantee.title, body: sp.guarantee.body },
    { id: id(), type: "faq", title: sp.faq.title, items: sp.faq.items },
    { id: id(), type: "cta", title: sp.cta.title, ctaText: sp.cta.ctaText },
  ];
}
