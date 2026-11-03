import "server-only";
import { unstable_cache } from "next/cache";
import { activeCulture, DEFAULT_CULTURE } from "./culture";
import { env } from "./env";
import { queryEntities } from "./rest";

/**
 * Localized VARIANTS the Content Hub way: a German product, press release or campaign is a
 * separate entity of the same definition, child of its master through the self-relation
 * (ProductToProductVariant / ContentToContentLocalization / CampaignToCampaignLocalization)
 * and linked to `M.Localization.<culture>` through LocalizationTo<X>. Its property values may
 * well be stored under en-US — the ENTITY carries the language — so the page in that
 * language shows the variant's values in place of the master's, under the master's URL.
 *
 * The variant's culture is read, in this order, from the Edge relation (`localizationToX.id`,
 * once M.Localization is published to Edge), the identifier (`….de-DE`, the demo builder's
 * provenance ids), and a REST census per definition and culture (Parent("LocalizationToX")
 * = the culture's M.Localization id; cached 10 minutes), which also covers variants made in
 * the Content Hub UI with random identifiers. The master is the variant's parent relation when
 * Edge publishes it, else the master whose title the variant's title extends ("Name - DE").
 */

const SUFFIX_ID = /[._-]([a-z]{2})-([A-Z]{2})$/;
const SUFFIX_TITLE = /\s+[-–]\s+([A-Z]{2}(?:-[A-Z]{2})?)$/;

/** The culture a localization id or value stands for ("M.Localization.de-DE" → "de-DE", "en" → "en"). */
export const cultureOfLocalization = (id: string) => id.replace(/^M\.Localization\./, "").trim();

/** Same culture, or the same language when no exact match is asked for. */
export function cultureMatches(code: string, culture: string): boolean {
  const a = code.toLowerCase(), b = culture.toLowerCase();
  return !!a && (a === b || a.split(/[-_]/)[0] === b.split(/[-_]/)[0]);
}

export const isDefaultCulture = (culture = activeCulture()) => cultureMatches(DEFAULT_CULTURE, culture);

/** Edge field names of the entity's localization links (`localizationToProduct`, …). */
export const localizationFields = (fields: Array<{ name: string; kind: string }>) => fields.filter((f) => f.kind === "OBJECT" && /^localizationTo/.test(f.name)).map((f) => f.name);

/** REST: identifiers of a definition's variants in a culture (the census), cached 10 minutes. */
async function censusUncached(definition: string, relation: string, culture: string): Promise<string[]> {
  if (!env.chHost || !env.chUser) return [];
  const locs = await queryEntities(`Definition.Name=="M.Localization"`);
  const loc = locs.find((l: any) => cultureMatches(String(l?.properties?.ValueName ?? ""), culture) && String(l?.properties?.ValueName ?? "").toLowerCase() === culture.toLowerCase())
    ?? locs.find((l: any) => cultureMatches(String(l?.properties?.ValueName ?? ""), culture));
  if (!loc?.id) return [];
  const items = await queryEntities(`Definition.Name=="${definition}" AND Parent("${relation}").id==${loc.id}`);
  return items.map((i: any) => String(i.identifier ?? "")).filter(Boolean);
}
const census = (definition: string, relation: string, culture: string) =>
  unstable_cache(() => censusUncached(definition, relation, culture), ["ch-localization-census", definition, relation, culture], { revalidate: 600, tags: ["ch", "ch:ch-entities"] })();

export interface VariantMatch<T> { master: T; variant: T }

/**
 * Splits a definition's Edge entities into masters and the variants of the active culture,
 * mapped to their masters. `isCopy` tells a copy from a master (Edge markers), `parentId`
 * reads the published parent relation, `titleOf` the display title for the name fallback.
 */
export async function pairLocalizedVariants<T extends { id: string }>(items: T[], opts: {
  definition: string;            // dotted Content Hub definition, e.g. M.PCM.Product
  relation: string;              // REST relation to M.Localization, e.g. LocalizationToProduct
  localizationField?: string;    // Edge field, e.g. localizationToProduct ("" when not published)
  isCopy: (e: T) => boolean;
  parentId: (e: T) => string;
  titleOf: (e: T) => string;
  culture?: string;
}): Promise<{ masters: T[]; byMaster: Map<string, T> }> {
  const culture = opts.culture ?? activeCulture();
  const copies = items.filter((e) => opts.isCopy(e) || SUFFIX_ID.test(String(e.id)));
  const masters = items.filter((e) => !copies.includes(e));
  const byMaster = new Map<string, T>();
  if (isDefaultCulture(culture) || !copies.length) return { masters, byMaster };
  let censusIds: Set<string> | null = null;
  const cultureOf = async (e: T): Promise<string> => {
    const link = opts.localizationField ? (e as any)[opts.localizationField]?.id : "";
    if (link) return cultureOfLocalization(String(link));
    const m = SUFFIX_ID.exec(String(e.id));
    if (m) return `${m[1]}-${m[2]}`;
    // a failed census throws: the calling loader (inside unstable_cache) must not cache master texts as this culture's
    if (!censusIds) censusIds = new Set(await census(opts.definition, opts.relation, culture));
    return censusIds.has(String(e.id)) ? culture : "";
  };
  const byTitle = new Map(masters.map((m) => [opts.titleOf(m).trim().toLowerCase(), m]));
  for (const v of copies) {
    const code = await cultureOf(v);
    if (!code || !cultureMatches(code, culture)) continue;
    const pid = opts.parentId(v);
    const master = (pid && masters.find((m) => String(m.id) === pid)) || byTitle.get(opts.titleOf(v).replace(SUFFIX_TITLE, "").trim().toLowerCase());
    if (!master) continue;
    const prev = byMaster.get(String(master.id));
    // an exact culture beats a same-language one
    if (!prev || code.toLowerCase() === culture.toLowerCase()) byMaster.set(String(master.id), v);
  }
  return { masters, byMaster };
}

/** The master with the variant's non-empty values on top (only the listed keys; relations stay the master's unless the variant has its own). */
export function overlay<T extends Record<string, any>>(master: T, variant: T | undefined, keys: string[]): T {
  if (!variant) return master;
  const out: Record<string, any> = { ...master };
  for (const k of keys) {
    const v = variant[k];
    const filled = v != null && (typeof v !== "string" || v.trim()) && (typeof v !== "object" || (Array.isArray(v) ? v.length : Array.isArray((v as any).results) ? (v as any).results.length : Object.values(v).some((x) => typeof x === "string" && x.trim())));
    if (filled) out[k] = v;
  }
  return out as T;
}

/** Drops the ` - DE` style suffix a copied variant carries in its title. */
export const stripVariantSuffix = (title: string) => title.replace(SUFFIX_TITLE, "").trim();
