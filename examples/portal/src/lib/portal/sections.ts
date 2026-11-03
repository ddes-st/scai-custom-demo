/**
 * Client-safe helpers shared by the Portal components: hrefs of the sections and detail
 * pages (public paths, never the internal /[site]/[locale] form) and the brand slug.
 */
export const SECTION_PATH = { brands: "/brands", products: "/products", press: "/press", media: "/media", partners: "/partners", sales: "/sales", games: "/games", team: "/team", sponsors: "/sponsors", programs: "/programs", events: "/events", experts: "/experts" } as const;
export type SectionKey = keyof typeof SECTION_PATH;

export type DetailKind = "brand" | "product" | "press" | "partner" | "game" | "player" | "program";

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * A Content Hub identifier as one URL segment. Identifiers carry dots
 * ("db.demo.product.x"), and the Content SDK proxies treat a dotted path as a static file
 * and skip the site/locale rewrite — so dots are written as "~" ("~" itself as "~~").
 */
export function idParam(id: string): string {
  return encodeURIComponent(id.replace(/~/g, "~~").replace(/\./g, "~"));
}

/** The reverse of idParam for a route segment (Next already decodes params; a second decode
 *  only for a value that still carries escapes, and never a throw on a stray "%"). */
export function routeId(param: string): string {
  let v = param;
  if (/%[0-9a-f]{2}/i.test(v)) { try { v = decodeURIComponent(v); } catch { /* keep */ } }
  return v.replace(/~~|~/g, (m) => (m === "~~" ? "~" : "."));
}

export const productHref = (id: string) => `${SECTION_PATH.products}/${idParam(id)}`;
export const pressHref = (id: string) => `${SECTION_PATH.press}/${idParam(id)}`;
export const brandHref = (slug: string) => `${SECTION_PATH.brands}/${encodeURIComponent(slug)}`;
export const gameHref = (id: string) => `${SECTION_PATH.games}/${idParam(id)}`;
export const playerHref = (id: string) => `${SECTION_PATH.team}/${idParam(id)}`;
export const programHref = (id: string) => `${SECTION_PATH.programs}/${idParam(id)}`;

/** The value of a Sitecore text/checkbox field in layout data (fields.X.value). */
export function fieldValue(fields: Record<string, unknown> | undefined, name: string): string {
  const f = fields?.[name] as { value?: unknown } | undefined;
  const v = f?.value;
  return typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
}

export const fieldFlag = (fields: Record<string, unknown> | undefined, name: string): boolean => {
  const v = fieldValue(fields, name).toLowerCase();
  return v === "1" || v === "true";
};
