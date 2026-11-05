/* Página de venta por bloques: tipos, plantillas y saneamiento. */

export type Block =
  | { id: string; type: "hero"; title: string; subtitle?: string; image?: string; ctaText?: string; badge?: string }
  | { id: string; type: "text"; title?: string; body: string }
  | { id: string; type: "benefits"; title?: string; items: string[] }
  | { id: string; type: "features"; title?: string; items: { title: string; text: string }[] }
  | { id: string; type: "image"; url: string; caption?: string }
  | { id: string; type: "video"; url: string }
  | { id: string; type: "testimonials"; title?: string; items: { name: string; text: string; role?: string }[] }
  | { id: string; type: "bonuses"; title?: string }
  | { id: string; type: "offer"; title?: string; ctaText?: string; note?: string }
  | { id: string; type: "guarantee"; title?: string; body: string }
  | { id: string; type: "faq"; title?: string; items: { q: string; a: string }[] }
  | { id: string; type: "cta"; title?: string; ctaText?: string }
  | { id: string; type: "countdown"; title?: string; endsAt: string }
  | { id: string; type: "author"; name: string; bio: string; image?: string };

export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Portada",
  text: "Texto",
  benefits: "Beneficios (lista)",
  features: "Características",
  image: "Imagen",
  video: "Video",
  testimonials: "Testimonios reales",
  bonuses: "Bonos incluidos",
  offer: "Oferta con precio",
  guarantee: "Garantía",
  faq: "Preguntas frecuentes",
  cta: "Llamado a la acción",
  countdown: "Cuenta regresiva (fecha fija)",
  author: "Sobre el autor",
};

let counter = 0;
export function blockId() {
  counter = (counter + 1) % 1e6;
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyBlock(type: BlockType): Block {
  const id = blockId();
  switch (type) {
    case "hero":
      return { id, type, title: "", subtitle: "", ctaText: "" };
    case "text":
      return { id, type, title: "", body: "" };
    case "benefits":
      return { id, type, title: "", items: [] };
    case "features":
      return { id, type, title: "", items: [] };
    case "image":
      return { id, type, url: "", caption: "" };
    case "video":
      return { id, type, url: "" };
    case "testimonials":
      return { id, type, title: "", items: [] };
    case "bonuses":
      return { id, type, title: "" };
    case "offer":
      return { id, type, title: "", ctaText: "", note: "" };
    case "guarantee":
      return { id, type, title: "", body: "" };
    case "faq":
      return { id, type, title: "", items: [] };
    case "cta":
      return { id, type, title: "", ctaText: "" };
    case "countdown":
      return { id, type, title: "", endsAt: new Date(Date.now() + 3 * 86400_000).toISOString() };
    case "author":
      return { id, type, name: "", bio: "" };
  }
}

type TemplateInput = { productName: string; shortDescription?: string | null; imageUrl?: string | null; guaranteeDays: number; hasBonuses: boolean };

/** Plantillas de partida. Solo cargan textos verdaderos derivados del producto; el resto queda vacío para completar. */
export const TEMPLATES: { key: string; name: string; description: string; build: (i: TemplateInput) => Block[] }[] = [
  {
    key: "clasica",
    name: "Clásica",
    description: "Portada, beneficios, características, bonos, oferta, garantía y preguntas.",
    build: (i) => [
      { id: blockId(), type: "hero", title: i.productName, subtitle: i.shortDescription || "", image: i.imageUrl || undefined, ctaText: "" },
      { id: blockId(), type: "benefits", title: "", items: [] },
      { id: blockId(), type: "features", title: "", items: [] },
      ...(i.hasBonuses ? [{ id: blockId(), type: "bonuses" as const, title: "" }] : []),
      { id: blockId(), type: "offer", title: "", ctaText: "", note: "" },
      { id: blockId(), type: "guarantee", title: "", body: "" },
      { id: blockId(), type: "faq", title: "", items: [] },
      { id: blockId(), type: "cta", title: "", ctaText: "" },
    ],
  },
  {
    key: "corta",
    name: "Corta",
    description: "Para tráfico caliente: portada, beneficios, oferta y garantía.",
    build: (i) => [
      { id: blockId(), type: "hero", title: i.productName, subtitle: i.shortDescription || "", image: i.imageUrl || undefined, ctaText: "" },
      { id: blockId(), type: "benefits", title: "", items: [] },
      { id: blockId(), type: "offer", title: "", ctaText: "", note: "" },
      { id: blockId(), type: "guarantee", title: "", body: "" },
    ],
  },
  {
    key: "ebook",
    name: "Ebook",
    description: "Portada con tapa, qué vas a aprender, para quién es, bonos, oferta y preguntas.",
    build: (i) => [
      { id: blockId(), type: "hero", title: i.productName, subtitle: i.shortDescription || "", image: i.imageUrl || undefined, ctaText: "", badge: "" },
      { id: blockId(), type: "text", title: "", body: "" },
      { id: blockId(), type: "features", title: "", items: [] },
      { id: blockId(), type: "benefits", title: "", items: [] },
      ...(i.hasBonuses ? [{ id: blockId(), type: "bonuses" as const, title: "" }] : []),
      { id: blockId(), type: "offer", title: "", ctaText: "", note: "" },
      { id: blockId(), type: "author", name: "", bio: "" },
      { id: blockId(), type: "faq", title: "", items: [] },
    ],
  },
];

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
/** Solo URLs http(s) o rutas relativas del propio sitio (nada de javascript:, data:, etc.). */
const url = (v: unknown, max = 1000) => {
  const s = str(v, max).trim();
  return /^https?:\/\//i.test(s) || (s.startsWith("/") && !s.startsWith("//")) ? s : "";
};
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

/** Valida y limpia bloques que llegan del editor o de la IA. */
export function sanitizeBlocks(input: unknown): Block[] {
  const out: Block[] = [];
  for (const raw of arr(input).slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const id = str(b.id, 40) || blockId();
    switch (b.type) {
      case "hero":
        out.push({ id, type: "hero", title: str(b.title, 300), subtitle: str(b.subtitle, 600), image: url(b.image) || undefined, ctaText: str(b.ctaText, 80), badge: str(b.badge, 80) });
        break;
      case "text":
        out.push({ id, type: "text", title: str(b.title, 300), body: str(b.body, 8000) });
        break;
      case "benefits":
        out.push({ id, type: "benefits", title: str(b.title, 300), items: arr(b.items).map((x) => str(x, 400)).filter(Boolean).slice(0, 30) });
        break;
      case "features":
        out.push({
          id,
          type: "features",
          title: str(b.title, 300),
          items: arr(b.items)
            .map((x) => ({ title: str((x as Record<string, unknown>)?.title, 200), text: str((x as Record<string, unknown>)?.text, 800) }))
            .filter((x) => x.title || x.text)
            .slice(0, 24),
        });
        break;
      case "image":
        out.push({ id, type: "image", url: url(b.url), caption: str(b.caption, 300) });
        break;
      case "video":
        out.push({ id, type: "video", url: url(b.url) });
        break;
      case "testimonials":
        out.push({
          id,
          type: "testimonials",
          title: str(b.title, 300),
          items: arr(b.items)
            .map((x) => ({ name: str((x as Record<string, unknown>)?.name, 120), text: str((x as Record<string, unknown>)?.text, 1200), role: str((x as Record<string, unknown>)?.role, 120) }))
            .filter((x) => x.name && x.text)
            .slice(0, 20),
        });
        break;
      case "bonuses":
        out.push({ id, type: "bonuses", title: str(b.title, 300) });
        break;
      case "offer":
        out.push({ id, type: "offer", title: str(b.title, 300), ctaText: str(b.ctaText, 80), note: str(b.note, 400) });
        break;
      case "guarantee":
        out.push({ id, type: "guarantee", title: str(b.title, 300), body: str(b.body, 2000) });
        break;
      case "faq":
        out.push({
          id,
          type: "faq",
          title: str(b.title, 300),
          items: arr(b.items)
            .map((x) => ({ q: str((x as Record<string, unknown>)?.q, 300), a: str((x as Record<string, unknown>)?.a, 2000) }))
            .filter((x) => x.q && x.a)
            .slice(0, 30),
        });
        break;
      case "cta":
        out.push({ id, type: "cta", title: str(b.title, 300), ctaText: str(b.ctaText, 80) });
        break;
      case "countdown": {
        const endsAt = str(b.endsAt, 40);
        if (endsAt && !Number.isNaN(Date.parse(endsAt))) out.push({ id, type: "countdown", title: str(b.title, 300), endsAt });
        break;
      }
      case "author":
        out.push({ id, type: "author", name: str(b.name, 120), bio: str(b.bio, 2000), image: url(b.image) || undefined });
        break;
    }
  }
  return out;
}

/** Convierte URLs de YouTube/Vimeo en URL embebible. */
export function embedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: "iframe" as const, src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe" as const, src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/^https?:\/\//i.test(url) && /\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: "video" as const, src: url };
  if (/^https?:\/\//.test(url)) return { kind: "iframe" as const, src: url };
  return null;
}
