/**
 * Which cache tags a Content Hub change drops — shared by /api/revalidate (Content Hub's
 * API-call action) and the "Refresh now" button of the Content Hub info panel.
 */

/** Content Hub definition (dotted, Edge type or prefix) → loader keys (see cachedByCulture keys).
 *  The picker's facets (ch-facets-edge from Edge, ch-facets from REST taxonomies) classify
 *  products, content, assets and campaigns, so those changes drop them too. */
const TAGS: Array<[RegExp, string[]]> = [
  [/^M[._]PCM[._]Product(Family)?$/i, ["portal-catalog", "portal-product", "portal-product-variants", "ch-entities", "ch-entity", "ch-localized", "ch-facets-edge", "ch-facets"]],
  [/^M[._]Content/i, ["portal-press", "portal-press-release", "portal-press-variants", "brand-data", "ch-entities", "ch-entity", "ch-localized", "ch-facets-edge", "ch-facets"]],
  [/^M[._]Asset$/i, ["portal-media", "portal-catalog", "portal-product", "portal-press", "portal-press-release", "brand-list", "brand-data", "brand-masters", "ch-entities", "ch-entity", "ch-facets-edge", "ch-facets", "ch-partners"]],
  [/^M[._]PublicLink$/i, ["portal-media", "portal-catalog", "portal-product", "portal-press", "portal-press-release", "brand-list", "brand-data", "brand-masters", "ch-entities", "ch-entity"]],
  [/^M[._]Brand$/i, ["brand-list", "brand-data", "brand-masters", "ch-entities", "ch-entity", "ch-facets-edge"]],
  [/^BrandSite[._]Config/i, ["brandsite-config", "brand-data"]],
  // a partner's record: its own documents leave the library and the picker (partner-assets.ts)
  [/^BrandSite[._]Partner$/i, ["ch-partners", "portal-media", "ch-entities", "asset-grant"]],
  [/^M[._]Collection$/i, ["portal-media", "ch-entities", "ch-entity", "ch-facets-edge", "ch-partners"]],
  [/^M[._]CMP[._]Campaign$/i, ["ch-entities", "ch-entity", "ch-localized", "ch-facets-edge"]],
];

/** SitecoreAI-side caches (settings, pages, profiles) — and every Content Hub loader filtered by
 *  the brand scope (Portal Settings), which carries this tag too. */
export const XMC_TAGS = ["xmc-site"];

/** The `ch:<key>` tags for a definition; every Content Hub cache ("ch") when it is unknown or empty. */
export function chTagsFor(definition: string): string[] {
  const match = definition ? TAGS.find(([re]) => re.test(definition.trim())) : undefined;
  return match ? match[1].map((k) => `ch:${k}`) : ["ch"];
}
