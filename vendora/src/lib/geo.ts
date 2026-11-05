import type { Market } from "@prisma/client";

const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-country-code", "x-appengine-country"];

export function countryFromHeaders(h: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const v = h.get(name);
    if (v && /^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  }
  return null;
}

/** Market del comprador: el elegido (si es válido) → el de su país → el predeterminado → ninguno. */
export function pickMarket<M extends Pick<Market, "id" | "countries" | "isDefault" | "active">>(
  markets: M[],
  country: string | null,
  requestedId?: string | null,
): M | null {
  const active = markets.filter((m) => m.active);
  if (requestedId) {
    const m = active.find((x) => x.id === requestedId);
    if (m) return m;
  }
  if (country) {
    const m = active.find((x) => x.countries.map((c) => c.toUpperCase()).includes(country));
    if (m) return m;
  }
  return active.find((m) => m.isDefault) ?? null;
}

export const COUNTRIES: [string, string][] = [
  ["AR", "Argentina"], ["UY", "Uruguay"], ["CL", "Chile"], ["PY", "Paraguay"], ["BO", "Bolivia"], ["PE", "Perú"], ["CO", "Colombia"],
  ["EC", "Ecuador"], ["VE", "Venezuela"], ["MX", "México"], ["GT", "Guatemala"], ["CR", "Costa Rica"], ["PA", "Panamá"], ["DO", "Rep. Dominicana"],
  ["PR", "Puerto Rico"], ["US", "Estados Unidos"], ["CA", "Canadá"], ["BR", "Brasil"], ["ES", "España"], ["PT", "Portugal"], ["IT", "Italia"],
  ["FR", "Francia"], ["DE", "Alemania"], ["AT", "Austria"], ["CH", "Suiza"], ["BE", "Bélgica"], ["NL", "Países Bajos"], ["LU", "Luxemburgo"],
  ["IE", "Irlanda"], ["GB", "Reino Unido"], ["MT", "Malta"], ["RO", "Rumania"], ["MD", "Moldavia"], ["CZ", "Chequia"], ["SK", "Eslovaquia"],
  ["HU", "Hungría"], ["PL", "Polonia"], ["HR", "Croacia"], ["SI", "Eslovenia"], ["BG", "Bulgaria"], ["GR", "Grecia"], ["CY", "Chipre"],
  ["SE", "Suecia"], ["NO", "Noruega"], ["DK", "Dinamarca"], ["FI", "Finlandia"], ["EE", "Estonia"], ["LV", "Letonia"], ["LT", "Lituania"],
  ["UA", "Ucrania"], ["TR", "Turquía"], ["IL", "Israel"], ["ZA", "Sudáfrica"], ["AU", "Australia"], ["NZ", "Nueva Zelanda"], ["IN", "India"],
  ["JP", "Japón"],
];
