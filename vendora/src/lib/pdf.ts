import PDFDocument from "pdfkit";
import { FONTS } from "./cover";

export type EbookChapter = { title: string; markdown: string };
export type EbookDoc = {
  title: string;
  subtitle?: string;
  author?: string;
  language: string;
  colors: { primary: string; dark: string };
  coverPng?: Buffer | null;
  chapters: EbookChapter[];
  tocTitle?: string;
};

const TOC_TITLES: Record<string, string> = {
  es: "Contenido", en: "Contents", pt: "Sumário", it: "Indice", fr: "Sommaire", de: "Inhalt", ro: "Cuprins", cs: "Obsah", hu: "Tartalom", pl: "Spis treści",
};
const CHAPTER_WORD: Record<string, string> = {
  es: "Capítulo", en: "Chapter", pt: "Capítulo", it: "Capitolo", fr: "Chapitre", de: "Kapitel", ro: "Capitolul", cs: "Kapitola", hu: "Fejezet", pl: "Rozdział",
};

/** Escribe texto con **negritas** en línea (opcionalmente en una posición x,y). */
function richText(doc: PDFKit.PDFDocument, text: string, opts: PDFKit.Mixins.TextOptions & { size: number; color: string }, at?: { x: number; y: number }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length);
  parts.forEach((p, i) => {
    const bold = p.startsWith("**") && p.endsWith("**");
    const content = bold ? p.slice(2, -2) : p.replace(/\*([^*]+)\*/g, "$1");
    const o = { ...opts, continued: i < parts.length - 1 };
    doc.font(bold ? "Bold" : "Regular").fontSize(opts.size).fillColor(opts.color);
    if (i === 0 && at) doc.text(content, at.x, at.y, o);
    else doc.text(content, o);
  });
}

/** Genera el PDF del ebook (tapa, índice y capítulos) a partir de markdown simple. */
export function renderEbookPdf(ebook: EbookDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margins: { top: 56, bottom: 56, left: 50, right: 50 }, bufferPages: true, info: { Title: ebook.title, Author: ebook.author || "" } });
    doc.registerFont("Regular", FONTS.sans);
    doc.registerFont("Bold", FONTS.sansBold);
    doc.registerFont("Serif", FONTS.serifBold);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const text = "#2A2733";
    // Tapa
    if (ebook.coverPng) {
      doc.image(ebook.coverPng, 0, 0, { width: W, height: H });
    } else {
      doc.rect(0, 0, W, H).fill(ebook.colors.dark);
      doc.rect(50, 150, 70, 6).fill(ebook.colors.primary);
      doc.font("Serif").fontSize(28).fillColor("#FFFFFF").text(ebook.title, 50, 175, { width: W - 100 });
      if (ebook.subtitle) doc.moveDown(0.6).font("Regular").fontSize(13).fillColor("#FFFFFF").text(ebook.subtitle, { width: W - 100 });
      if (ebook.author) doc.font("Bold").fontSize(10).fillColor("#FFFFFF").text(ebook.author.toUpperCase(), 50, H - 90, { width: W - 100, characterSpacing: 2 });
    }

    // Índice
    doc.addPage();
    doc.font("Serif").fontSize(20).fillColor(ebook.colors.dark).text(ebook.tocTitle || TOC_TITLES[ebook.language] || "Contenido");
    doc.moveDown(1);
    ebook.chapters.forEach((c, i) => {
      doc.font("Bold").fontSize(10).fillColor(ebook.colors.primary).text(`${CHAPTER_WORD[ebook.language] || "Capítulo"} ${i + 1}`, { continued: false });
      doc.font("Regular").fontSize(12).fillColor(text).text(c.title);
      doc.moveDown(0.6);
    });

    // Capítulos
    ebook.chapters.forEach((c, i) => {
      doc.addPage();
      doc.font("Bold").fontSize(10).fillColor(ebook.colors.primary).text(`${(CHAPTER_WORD[ebook.language] || "Capítulo").toUpperCase()} ${i + 1}`, { characterSpacing: 1.5 });
      doc.moveDown(0.3);
      doc.font("Serif").fontSize(20).fillColor(ebook.colors.dark).text(c.title);
      doc.moveDown(0.8);
      const lines = c.markdown.replace(/\r/g, "").split("\n");
      let para: string[] = [];
      const flush = () => {
        if (!para.length) return;
        richText(doc, para.join(" "), { size: 10.5, color: text, align: "left", lineGap: 3 });
        doc.moveDown(0.7);
        para = [];
      };
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
          flush();
          continue;
        }
        if (/^#\s/.test(line) && line.replace(/^#\s+/, "").trim().toLowerCase() === c.title.toLowerCase()) continue;
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
          flush();
          doc.moveDown(0.3);
          doc.font("Bold").fontSize(h[1].length <= 2 ? 13.5 : 12).fillColor(ebook.colors.dark).text(h[2].replace(/\*\*/g, ""));
          doc.moveDown(0.4);
          continue;
        }
        const li = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
        if (li) {
          flush();
          const bullet = /^\d/.test(line) ? `${line.match(/^\d+/)![0]}.` : "•";
          const left = doc.page.margins.left;
          const y = doc.y;
          doc.font("Bold").fontSize(10.5).fillColor(ebook.colors.primary).text(bullet, left, y, { width: 16, lineBreak: false });
          richText(doc, li[1], { size: 10.5, color: text, lineGap: 2, width: W - left - doc.page.margins.right - 18 }, { x: left + 18, y });
          doc.x = left;
          doc.moveDown(0.35);
          continue;
        }
        if (/^>\s?/.test(line)) {
          flush();
          const y = doc.y;
          richText(doc, line.replace(/^>\s?/, ""), { size: 11, color: ebook.colors.dark, lineGap: 3 });
          doc.rect(42, y, 3, doc.y - y).fill(ebook.colors.primary);
          doc.moveDown(0.6);
          continue;
        }
        para.push(line);
      }
      flush();
    });

    // Números de página (desde el índice)
    const range = doc.bufferedPageRange();
    for (let p = range.start + 1; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Regular").fontSize(8).fillColor("#9A95A6").text(String(p), 0, H - 34, { width: W, align: "center", lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
