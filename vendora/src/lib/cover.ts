import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

export const FONT_DIR = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf");
export const FONTS = {
  sans: path.join(FONT_DIR, "DejaVuSans.ttf"),
  sansBold: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"),
  serif: path.join(FONT_DIR, "DejaVuSerif.ttf"),
  serifBold: path.join(FONT_DIR, "DejaVuSerif-Bold.ttf"),
};

export type CoverSpec = {
  title: string;
  subtitle?: string;
  author?: string;
  badge?: string;
  background: string;
  foreground: string;
  accent: string;
  style: "minimal" | "bold" | "elegant" | "playful";
  motif: "circles" | "waves" | "grid" | "stripes" | "blob";
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Recorta en el último espacio antes del límite y agrega "…" si hizo falta cortar. */
function clip(text: string | undefined, max: number) {
  if (text === undefined) return undefined;
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

export function normalizeSpec(s: Partial<CoverSpec> & { title: string }): CoverSpec {
  return {
    title: clip(s.title, 120)!,
    subtitle: clip(s.subtitle, 160),
    author: clip(s.author, 60),
    badge: clip(s.badge, 40),
    background: HEX.test(s.background || "") ? s.background! : "#17142A",
    foreground: HEX.test(s.foreground || "") ? s.foreground! : "#FFFFFF",
    accent: HEX.test(s.accent || "") ? s.accent! : "#FF5B2E",
    style: (["minimal", "bold", "elegant", "playful"] as const).includes(s.style as never) ? s.style! : "bold",
    motif: (["circles", "waves", "grid", "stripes", "blob"] as const).includes(s.motif as never) ? s.motif! : "circles",
  };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

const FONT_OPTS = { fontFiles: Object.values(FONTS), loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" };
const widthCache = new Map<string, number>();

/** Ancho real (px) de una línea, medido con las mismas fuentes con las que se renderiza la tapa. */
export function measureText(text: string, size: number, family: string, bold: boolean) {
  const key = `${family}|${bold ? 1 : 0}|${size}|${text}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="${size * 3}"><text x="0" y="${size * 2}" font-family="${family}" font-weight="${bold ? 700 : 400}" font-size="${size}">${esc(text)}</text></svg>`;
    w = new Resvg(svg, { font: FONT_OPTS }).getBBox()?.width ?? 0;
    if (widthCache.size > 5000) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}

/** Parte una palabra que no entra sola en el ancho disponible. */
function splitWord(word: string, maxWidth: number, size: number, family: string, bold: boolean) {
  const parts: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && measureText(cur + ch, size, family, bold) > maxWidth) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Corta el texto en líneas que entran en maxWidth. strict: si una palabra sola no entra devuelve null (hay que achicar la letra). */
function wrapToWidth(text: string, maxWidth: number, size: number, family: string, bold: boolean, strict: boolean): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const pieces = measureText(word, size, family, bold) > maxWidth ? (strict ? null : splitWord(word, maxWidth, size, family, bold)) : [word];
    if (!pieces) return null;
    for (const w of pieces) {
      const next = line ? `${line} ${w}` : w;
      if (line && measureText(next, size, family, bold) > maxWidth) {
        lines.push(line);
        line = w;
      } else line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Elige el tamaño de letra más grande (de size a minSize) con el que el texto entra en maxLines líneas. */
export function fitText(text: string, opts: { maxWidth: number; size: number; minSize: number; maxLines: number; family: string; bold: boolean }) {
  const { maxWidth, minSize, maxLines, family, bold } = opts;
  for (let size = opts.size; size >= minSize; size -= 4) {
    const lines = wrapToWidth(text, maxWidth, size, family, bold, true);
    if (lines && lines.length <= maxLines) return { lines, size };
  }
  const lines = wrapToWidth(text, maxWidth, minSize, family, bold, false) ?? [];
  if (lines.length <= maxLines) return { lines, size: minSize };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1].replace(/[.,;:]?$/, "");
  while (last && measureText(`${last}…`, minSize, family, bold) > maxWidth) last = last.slice(0, -1).trimEnd();
  kept[maxLines - 1] = `${last}…`;
  return { lines: kept, size: minSize };
}

function motifSvg(spec: CoverSpec) {
  const a = spec.accent;
  switch (spec.motif) {
    case "circles":
      return `<circle cx="1120" cy="260" r="330" fill="${a}" opacity="0.9"/><circle cx="1180" cy="1700" r="420" fill="${a}" opacity="0.35"/><circle cx="160" cy="1500" r="120" fill="${spec.foreground}" opacity="0.08"/>`;
    case "waves":
      return `<path d="M0 1500 C 300 1380, 600 1640, 1200 1460 L1200 2000 L0 2000 Z" fill="${a}" opacity="0.85"/><path d="M0 1650 C 400 1540, 700 1780, 1200 1600 L1200 2000 L0 2000 Z" fill="${spec.foreground}" opacity="0.12"/>`;
    case "grid": {
      let g = "";
      for (let x = 60; x < 1200; x += 120) g += `<line x1="${x}" y1="0" x2="${x}" y2="2000" stroke="${spec.foreground}" stroke-opacity="0.07" stroke-width="2"/>`;
      for (let y = 60; y < 2000; y += 120) g += `<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="${spec.foreground}" stroke-opacity="0.07" stroke-width="2"/>`;
      return `${g}<rect x="0" y="1560" width="1200" height="440" fill="${a}"/>`;
    }
    case "stripes":
      return `<g transform="rotate(-18 600 1000)">${[0, 1, 2, 3].map((i) => `<rect x="-400" y="${1250 + i * 120}" width="2000" height="58" fill="${a}" opacity="${0.9 - i * 0.2}"/>`).join("")}</g>`;
    case "blob":
      return `<path d="M940 40 C1150 40 1250 230 1180 400 C1110 570 930 540 840 420 C750 300 760 40 940 40 Z" fill="${a}"/><path d="M200 1500 C420 1420 620 1600 560 1780 C500 1960 180 1960 120 1780 C60 1600 80 1540 200 1500 Z" fill="${a}" opacity="0.4"/>`;
  }
}

/** Tapa de ebook 1200×2000 (SVG). Los textos se miden con las fuentes reales para que nunca se salgan de la tapa. */
export function coverSvg(input: CoverSpec) {
  const spec = normalizeSpec(input);
  const serif = spec.style === "elegant";
  const family = serif ? "DejaVu Serif" : "DejaVu Sans";
  const MAX_W = 1000; // margen de 100 px a cada lado
  const titleText = spec.style === "bold" ? spec.title.toUpperCase() : spec.title;
  const t = fitText(titleText, { maxWidth: MAX_W, size: spec.style === "bold" ? 120 : spec.style === "playful" ? 110 : 100, minSize: 60, maxLines: 5, family, bold: true });
  const lineH = t.size * 1.12;
  const titleY = 760 - (t.lines.length - 1) * (t.size * 0.55);
  const title = t.lines
    .map((l, i) => `<text x="100" y="${titleY + i * lineH}" font-family="${family}" font-weight="700" font-size="${t.size}" fill="${spec.foreground}">${esc(l)}</text>`)
    .join("");
  const sub = spec.subtitle ? fitText(spec.subtitle, { maxWidth: MAX_W, size: 48, minSize: 36, maxLines: 3, family, bold: false }) : { lines: [] as string[], size: 48 };
  const subY = titleY + t.lines.length * lineH + 70;
  const subtitle = sub.lines
    .map((l, i) => `<text x="100" y="${subY + i * sub.size * 1.3}" font-family="${family}" font-size="${sub.size}" fill="${spec.foreground}" opacity="0.85">${esc(l)}</text>`)
    .join("");
  const bar = `<rect x="100" y="${titleY - t.size - 50}" width="180" height="16" rx="8" fill="${spec.accent}"/>`;
  let badge = "";
  if (spec.badge) {
    const b = fitText(spec.badge.toUpperCase(), { maxWidth: MAX_W - 80, size: 40, minSize: 26, maxLines: 1, family: "DejaVu Sans", bold: true });
    const w = Math.ceil(measureText(b.lines[0] ?? "", b.size, "DejaVu Sans", true)) + 80;
    badge = `<g><rect x="100" y="180" rx="40" width="${w}" height="80" fill="${spec.accent}"/><text x="140" y="${220 + b.size * 0.36}" font-family="DejaVu Sans" font-weight="700" font-size="${b.size}" fill="${spec.background}">${esc(b.lines[0] ?? "")}</text></g>`;
  }
  let author = "";
  if (spec.author) {
    // letter-spacing 4 px: se descuenta del ancho disponible.
    const text = spec.author.toUpperCase();
    const a = fitText(text, { maxWidth: MAX_W - 4 * text.length, size: 44, minSize: 28, maxLines: 1, family: "DejaVu Sans", bold: true });
    author = `<text x="100" y="1880" font-family="DejaVu Sans" font-weight="700" font-size="${a.size}" letter-spacing="4" fill="${spec.foreground}" opacity="0.9">${esc(a.lines[0] ?? "")}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2000" viewBox="0 0 1200 2000"><rect width="1200" height="2000" fill="${spec.background}"/>${motifSvg(spec)}${badge}${bar}${title}${subtitle}${author}</svg>`;
}

export function svgToPng(svg: string, width = 900) {
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: FONT_OPTS,
  });
  return Buffer.from(r.render().asPng());
}
