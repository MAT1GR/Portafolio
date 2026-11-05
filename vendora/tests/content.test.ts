import { describe, expect, it } from "vitest";
import type { Market, Store } from "@prisma/client";
import { legalSections } from "@/lib/legal";
import { pickMarket, countryFromHeaders } from "@/lib/geo";
import { coverSvg, fitText, measureText } from "@/lib/cover";

describe("textos legales", () => {
  const store = { name: "Guías Prácticas", legalName: "Guías SRL", legalTaxId: "30-1", legalAddress: "Córdoba", supportEmail: "hola@guias.com", guaranteeDays: 7 } as Store;
  it.each(["es", "en", "pt", "it", "fr", "de", "ro", "cs", "hu", "pl"])("idioma %s: tres documentos completos y sin variables sin reemplazar", (language) => {
    for (const kind of ["terms", "privacy", "refunds"] as const) {
      const sections = legalSections({ ...store, language }, kind);
      expect(sections.length).toBeGreaterThan(2);
      const text = sections.map(([t, b]) => `${t} ${b}`).join(" ");
      expect(text).not.toMatch(/\{\w+\}/);
    }
    const refunds = legalSections({ ...store, language }, "refunds").map(([, b]) => b).join(" ");
    expect(refunds).toContain("7");
    expect(refunds).toContain("hola@guias.com");
  });
});

describe("market del comprador", () => {
  const m = (id: string, countries: string[], isDefault = false, active = true) => ({ id, countries, isDefault, active }) as Pick<Market, "id" | "countries" | "isDefault" | "active">;
  const markets = [m("int", [], true), m("ar", ["AR"]), m("eu", ["ES", "IT"]), m("off", ["MX"], false, false)];
  it("elige por país, por selección o el predeterminado", () => {
    expect(pickMarket(markets, "AR")?.id).toBe("ar");
    expect(pickMarket(markets, "IT")?.id).toBe("eu");
    expect(pickMarket(markets, "US")?.id).toBe("int");
    expect(pickMarket(markets, "MX")?.id).toBe("int");
    expect(pickMarket(markets, "AR", "eu")?.id).toBe("eu");
    expect(pickMarket(markets, "AR", "off")?.id).toBe("ar");
  });
  it("lee el país de los headers del proveedor", () => {
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "ar" }))).toBe("AR");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX1" }))).toBeNull();
  });
});

describe("tapas de ebook", () => {
  it("ninguna línea del título se sale de la tapa", () => {
    const opts = { maxWidth: 1000, size: 120, minSize: 60, maxLines: 5, family: "DejaVu Sans", bold: true };
    for (const title of ["INVERTIR DESDE CERO", "ELECTROENCEFALOGRAFÍA PRÁCTICA PARA PRINCIPIANTES ABSOLUTOS", "SUPERCALIFRAGILISTICOESPIALIDOSO EXTRA"]) {
      const r = fitText(title, opts);
      expect(r.lines.length).toBeLessThanOrEqual(5);
      for (const l of r.lines) expect(measureText(l, r.size, "DejaVu Sans", true)).toBeLessThanOrEqual(1000);
    }
  });
  it("genera un SVG con el texto escapado", () => {
    const svg = coverSvg({ title: "A & B <c>", background: "#000000", foreground: "#FFFFFF", accent: "#FF0000", style: "minimal", motif: "waves" });
    expect(svg).toContain("A &amp; B &lt;c&gt;");
    expect(svg.startsWith("<svg")).toBe(true);
  });
});
