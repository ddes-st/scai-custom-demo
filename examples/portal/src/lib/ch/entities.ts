import "server-only";
/**
 * Generic Content Hub entities: any definition Experience Edge publishes (`all<Type>` query)
 * can be listed, searched, picked in the Page builder and rendered as cards.
 *
 * An *entity profile* says how a definition renders: which properties are the title, subtitle
 * and summary, which relations carry the image, which fields the detail page hides, and where
 * its detail page lives. Profiles come from three places, later ones overriding earlier ones:
 *   1. derived automatically from the Edge schema (introspection + naming heuristics),
 *   2. the built-in profiles below (products, press releases, brands, assets, families),
 *   3. `Portal CH Profile` items under `<site>/Data/Content Hub Profiles` in SitecoreAI.
 *
 * Definitions are named by their Edge type (`M_PCM_Product`); Content Hub's dotted names
 * (`M.PCM.Product`) are accepted everywhere and normalised.
 */
import { currentSite } from "../portal/sites";
import { unstable_cache } from "next/cache";
import scConfig from "sitecore.config";
import { cachedByCulture, SCOPED } from "./culture";
import { withLastGood } from "./last-good";
import { mapPool } from "./rest";
import { isDefaultCulture, localizationFields, overlay, pairLocalizedVariants, stripVariantSuffix } from "./localized";
import { edgeRequest } from "./edge";
import { listBrands, slugify } from "./data";
import { getBrandVisibilityMap } from "./siteConfig";
import type { ImageLink } from "./image-links";
import { ASSET_SELECTION, EDGE_LIST_MAX, edgeAll, edgeTypeFields, fieldLabel, hasField, inScope, loc, toPortalAsset, type EdgeField, type PortalAsset } from "./portalEdge";
import { brandScope } from "../portal/scope";
import { partnerOnlyAssets } from "./partner-assets";
import { brandHref, idParam } from "../portal/sections";
import { siteRootPath } from "../portal/settings";
import { loadSectionPagesStrict } from "../portal/site-pages";
import { xmcQuery } from "../portal/xmc-graphql";

export interface EntityProfile {
  /** Edge type name, e.g. "M_PCM_Product". */
  definition: string;
  label: string;
  labelPlural: string;
  /** Property names tried in order for the card title / subtitle / summary. */
  title: string[];
  subtitle: string[];
  summary: string[];
  /** Asset relations tried in order for the card image; "self" = the entity is an asset. */
  image: string[];
  /** Regex source: detail fields never shown. */
  hidden: string;
  /** Public section of the detail pages ("/products" → /products/<id>); "" = no detail page. */
  detailPath: string;
  /** Offered in the picker. */
  pickable: boolean;
  order: number;
  /** A relation whose entities are listed under each picked item (a family's products). */
  expand: string;
  /** Relations shown on the detail page; empty = every list relation to a pickable type. */
  detailRelations: string[];
  source: "auto" | "builtin" | "sitecoreai";
}

export interface EntityCard {
  id: string;
  definition: string;
  title: string;
  subtitle: string;
  summary: string;
  image: string;
  /** The image's public links with sizes, for the best fit per box (ChImage). */
  imageLinks?: ImageLink[];
  /** Detail URL, "" when the definition has no detail page. */
  href: string;
  /** Last modified in Content Hub (ISO), when Edge publishes it — the picker's date sort. */
  modified?: string;
  /** A small version of `image` for tiles (thumbnail rendition), when there is one. */
  thumb?: string;
}

export interface EntityRelation { name: string; label: string; definition: string; items: EntityCard[] }

export interface EntityDetail extends EntityCard {
  label: string;
  html: string;
  fields: Array<{ label: string; value: string }>;
  images: PortalAsset[];
  files: PortalAsset[];
  relations: EntityRelation[];
}

/** The most a search returns (the picker's limit). */
export const MAX_LIST = 600;
const SCALARS = new Set(["String", "Int", "Float", "Boolean", "Long", "Decimal", "DateTime", "DateTimeOffset", "Json", "ID"]);
const HIDDEN_DEFAULT = "^(id|createdBy|createdOn|modifiedBy|modifiedOn|publishedToEdgeOn|preventPublish|deletedOn|.*Status(Details)?|.*_Is(Draft|Variant)|.*Completeness.*|entity_Visualization)$";
const HIDDEN_ASSET = "^(id|createdBy|createdOn|modifiedBy|modifiedOn|publishedToEdgeOn|renditions|urls|mainFile|fileProperties|structure|digest|extraRenditions|focalPoint.*|templateProperties|aI_.*|fS.*|sOLV.*|sitecoreMLStatus|is(CheckedOut|CheckingIn|Discarding|Draft)|checkedOutIn|renditions.*|.*Status|.*Date|.*By|chiliType|hasDuplicate|imageSimilarityTags|vision.*|sC_Asset_C2PA_Summary|extraInfo|virusScanResult|subtitleLanguage|videoAI_Language|fileChecks.*|asset_.*|averageRating|reasonFor.*)$";

/** "M.PCM.Product" → "M_PCM_Product". */
export const edgeType = (definition: string) => definition.trim().replace(/\./g, "_");
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Demo_ConferenceSpeaker" → "Conference speaker". */
export function humanize(definition: string): string {
  const last = definition.split("_").filter(Boolean).pop() ?? definition;
  const words = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(/\s+/);
  return words.map((w, i) => (i === 0 || /^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
}
const pluralize = (s: string) => (/[^s]s$/i.test(s) ? s : /[sxz]$|ch$|sh$/i.test(s) ? `${s}es` : /[^aeiou]y$/i.test(s) ? `${s.slice(0, -1)}ies` : `${s}s`);

const BUILTIN: Record<string, Partial<EntityProfile>> = {
  M_PCM_Product: { label: "Product", labelPlural: "Products", title: ["productName", "productLabel"], subtitle: ["productNumber"], summary: ["productShortDescription"], image: ["pCMProductToMasterAsset", "pCMProductToAsset"], detailPath: "/products", order: 10,
    hidden: `${HIDDEN_DEFAULT.slice(0, -2)}|productName|productLabel|productNumber|productShortDescription|productLongDescription|productData(Diagrams|Publications|Versions|Sheet)|packagingLabel)$` },
  M_PCM_ProductFamily: { label: "Product family", labelPlural: "Product families", title: ["productFamilyLabel", "productFamilyName"], summary: ["productFamilyShortDescription"], image: ["pCMProductFamilyToMasterAsset", "pCMProductFamilyToAsset"], expand: "pCMProductFamilyToProduct", order: 11 },
  M_Content_PressRelease: { label: "Press release", labelPlural: "Press releases", title: ["pressRelease_Title", "content_Name"], subtitle: ["content_PublicationDate"], summary: ["pressRelease_Lead"], image: ["cmpContentToMasterLinkedAsset", "cmpContentToLinkedAsset"], detailPath: "/press", order: 20 },
  M_Content: { label: "Content item", labelPlural: "Content items", title: ["content_Name"], subtitle: ["content_PublicationDate"], image: ["cmpContentToMasterLinkedAsset", "cmpContentToLinkedAsset"], order: 25 },
  M_Brand: { label: "Brand", labelPlural: "Brands", title: ["brandLabel", "brandName"], summary: ["brandDescription"], image: ["pCMBrandToMasterAsset", "pCMBrandToAsset"], detailPath: "/brands", order: 30 },
  M_Asset: { label: "Image or file", labelPlural: "Images and files", title: ["title", "fileName"], subtitle: [], summary: ["description"], image: ["self"], hidden: HIDDEN_ASSET, order: 40 },
  M_Collection: { label: "Collection", labelPlural: "Collections", title: ["collectionName"], summary: ["description"], expand: "collectionToAsset", order: 45 },
};

/** Definitions that are never offered: system, status and automation types. */
const NOT_PICKABLE = /^(M_Content_[0-9a-f]{4,}|M_(PublicLink|Localization|WatermarkType|ContentType|DeliverableType|Channel|ChannelAccount|CMP_(CampaignType|Region))|SC_Automation_.*|EntitySubmittable|BrandSite_.*|.*_(Status|FileCheck|BrandReview|SubmitStatus|StateFlowActivity|Image_Style|AssetAIIndex|DocInsight|FacePerson|DataSheetLayout)|.*Campaign_(Status|Topic|Year))$/;

// ---------- the Edge schema ----------

let queryFieldsCache: { at: number; names: string[] } | null = null;

/** The `all<Type>` list queries Edge offers (cached 5 minutes). */
export async function edgeListQueries(): Promise<string[]> {
  if (queryFieldsCache && Date.now() - queryFieldsCache.at < 5 * 60 * 1000) return queryFieldsCache.names;
  const data = await edgeRequest(`query { __type(name: "Query") { fields { name } } }`);
  const names: string[] = (data?.__type?.fields ?? []).map((f: any) => String(f.name)).filter((n: string) => /^all[A-Z]/.test(n));
  queryFieldsCache = { at: Date.now(), names };
  return names;
}

const isList = (f: EdgeField) => f.kind === "OBJECT" && /List$/.test(f.typeName);
const target = (f: EdgeField) => f.typeName.replace(/List$/, "");
const isAssetRel = (f: EdgeField) => f.kind === "OBJECT" && target(f) === "M_Asset" && !/Self|Draft|Localization|Subtitle|LinkedAsset_(Children|Parents)/.test(f.name);
const isBrandRel = (f: EdgeField) => f.kind === "OBJECT" && target(f) === "M_Brand" && !/Self/.test(f.name);
const textKind = (f: EdgeField) => f.kind === "SCALAR" && (f.typeName === "String" || f.typeName === "Json");

/** A profile derived from the schema alone. */
function autoProfile(definition: string, fields: EdgeField[]): EntityProfile {
  const text = fields.filter(textKind).map((f) => f.name);
  const pick = (res: RegExp[]) => res.flatMap((re) => text.filter((n) => re.test(n)));
  const uniq = (a: string[]) => [...new Set(a)];
  const title = uniq(pick([/(^|_)(name|title)$/i, /name$/i, /title$/i, /label$/i]));
  const subtitle = uniq([...pick([/number$/i, /code$/i, /type$/i]), ...fields.filter((f) => f.kind === "SCALAR" && f.typeName === "DateTime" && /publication|release|start|event|date$/i.test(f.name) && !/created|modified|published|approv|archiv|expir/i.test(f.name)).map((f) => f.name)]);
  const summary = uniq(pick([/short/i, /(^|_)(lead|summary|teaser|tagline)$/i, /description$/i, /(^|_)(bio|body|text)$/i]));
  const assets = fields.filter(isAssetRel).map((f) => f.name);
  const image = definition === "M_Asset" ? ["self"] : [...assets.filter((n) => /Master/i.test(n)), ...assets.filter((n) => !/Master/i.test(n))];
  const label = humanize(definition);
  return { definition, label, labelPlural: pluralize(label), title, subtitle, summary, image, hidden: definition === "M_Asset" ? HIDDEN_ASSET : HIDDEN_DEFAULT, detailPath: "", pickable: !NOT_PICKABLE.test(definition), order: 100, expand: "", detailRelations: [], source: "auto" };
}

// ---------- profiles authored in SitecoreAI ----------

const PROFILES_QUERY = `query($path: String!, $language: String!) {
  item(path: $path, language: $language) { children(first: 50) { results { name fields { name value } } } }
}`;

/** THROWS when SitecoreAI doesn't answer (never cached). */
async function loadAuthoredProfilesUncached(site: string, language: string): Promise<Partial<EntityProfile>[]> {
  const root = await siteRootPath(site, language);
  if (!root) return [];
  const data = await xmcQuery<{ item?: { children?: { results?: any[] } } }>(PROFILES_QUERY, { path: `${root}/Data/Content Hub Profiles`, language });
  const out: Partial<EntityProfile>[] = [];
  for (const child of data?.item?.children?.results ?? []) {
    const f = new Map<string, string>((child?.fields ?? []).map((x: any) => [String(x.name), String(x.value ?? "").trim()]));
    const definition = edgeType(f.get("Definition") ?? "");
    if (!definition) continue;
    const list = (k: string) => (f.get(k) ?? "").split(/[\s,|]+/).map((s) => s.trim()).filter(Boolean);
    const p: Partial<EntityProfile> = { definition, source: "sitecoreai" };
    if (f.get("Label")) p.label = f.get("Label");
    if (f.get("LabelPlural")) p.labelPlural = f.get("LabelPlural");
    if (f.get("TitleFields")) p.title = list("TitleFields");
    if (f.get("SubtitleFields")) p.subtitle = list("SubtitleFields");
    if (f.get("SummaryFields")) p.summary = list("SummaryFields");
    if (f.get("ImageRelations")) p.image = list("ImageRelations");
    if (f.get("HiddenFields")) p.hidden = f.get("HiddenFields");
    if (f.has("DetailPath")) p.detailPath = (f.get("DetailPath") ?? "").replace(/\/$/, "");
    if (f.get("Pickable")) p.pickable = f.get("Pickable") === "1";
    if (f.get("Order")) p.order = Number(f.get("Order")) || 100;
    if (f.has("ExpandRelation")) p.expand = f.get("ExpandRelation") ?? "";
    if (f.get("DetailRelations")) p.detailRelations = list("DetailRelations");
    out.push(p);
  }
  return out;
}
/** The authored profiles; on a failure the last good ones of this instance, else none. */
const loadAuthoredProfiles = withLastGood("ch profiles", (site: string, language: string) =>
  unstable_cache(() => loadAuthoredProfilesUncached(site, language), ["ch-profiles", site, language], { revalidate: 60, tags: ["xmc-site"] })(), () => [] as Partial<EntityProfile>[]);

// ---------- detail pages authored in SitecoreAI ----------

/** definition → public section path, from the site's wildcard pages: a `*` page whose
 *  `Definition` field (or the fixed DetailKind) names the definition. One aliased lookup per
 *  section page keeps the query far below Edge's complexity limit. */
async function loadDetailSectionsUncached(site: string, language: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  // THROWS when SitecoreAI doesn't answer (never cached)
  const root = await siteRootPath(site, language);
  if (!root) return out;
  const sections = (await loadSectionPagesStrict(site, language)).filter((p) => /^[\w -]+$/.test(p.name));
  if (!sections.length) return out;
  // Edge counts every alias towards its query depth (limit 15): four sections per query.
  const data: Record<string, { d?: { value?: string }; k?: { value?: string } } | null> = {};
  for (let start = 0; start < sections.length; start += 4) {
    const batch = sections.slice(start, start + 4);
    const query = `query($language: String!) { ${batch.map((p, j) => `s${start + j}: item(path: "${root}/Home/${p.name}/*", language: $language) { d: field(name: "Definition") { value } k: field(name: "DetailKind") { value } }`).join(" ")} }`;
    Object.assign(data, await xmcQuery<typeof data>(query, { language }));
  }
  // "program" is a marker, not a definition: a site with a program detail page (the university
  // setup) shows its Content Hub products as programs (see profileFor)
  const KIND: Record<string, string> = { product: "M_PCM_Product", press: "M_Content_PressRelease", brand: "M_Brand", program: "program" };
  sections.forEach((p, i) => {
    const hit = data?.[`s${i}`];
    if (!hit) return;
    const def = edgeType(hit.d?.value ?? "") || KIND[(hit.k?.value ?? "").trim().toLowerCase()] || "";
    if (def && !out[def]) out[def] = p.href;
  });
  return out;
}
/** On a failure the last good sections of this instance, else none. */
const loadDetailSections = withLastGood("ch detail sections", (site: string, language: string) =>
  unstable_cache(() => loadDetailSectionsUncached(site, language), ["ch-detail-sections", site, language], { revalidate: 60, tags: ["xmc-site"] })(), () => ({}) as Record<string, string>);

/** The site's generic detail sections: definition → "/section". */
export const detailSections = () => loadDetailSections(currentSite(), scConfig.defaultLanguage);

// ---------- resolved profiles ----------

/** The profile of a definition (schema defaults ← built-in ← SitecoreAI item); null when Edge
 *  doesn't publish the type. */
export async function profileFor(definitionOrType: string): Promise<EntityProfile | null> {
  const definition = edgeType(definitionOrType);
  const fields = await edgeTypeFields(definition);
  if (!fields) return null;
  const auto = autoProfile(definition, fields);
  const builtin = BUILTIN[definition] ?? {};
  const [authoredAll, sections] = await Promise.all([loadAuthoredProfiles(currentSite(), scConfig.defaultLanguage), detailSections()]);
  const authored = authoredAll.find((p) => p.definition === definition) ?? {};
  // only on a site with program pages (university demos): products are its programs
  const programs = definition === "M_PCM_Product" && sections.program ? { label: "Program", labelPlural: "Programs", detailPath: sections.program } : {};
  const merged: EntityProfile = { ...auto, ...builtin, ...programs, ...authored, definition, source: authored.definition ? "sitecoreai" : BUILTIN[definition] ? "builtin" : "auto" };
  if (!merged.labelPlural) merged.labelPlural = pluralize(merged.label);
  if (!merged.detailPath && sections[definition]) merged.detailPath = sections[definition];
  return merged;
}

/** Every definition an author may pick: built-in and authored ones first, then the rest of
 *  the schema (list queries that aren't system types), each verified against Edge. */
export async function pickableProfiles(): Promise<EntityProfile[]> {
  const [queries, authored] = await Promise.all([edgeListQueries(), loadAuthoredProfiles(currentSite(), scConfig.defaultLanguage)]);
  const onEdge = new Set(queries.map((q) => q.replace(/^all/, "")));
  const wanted = new Set<string>([...Object.keys(BUILTIN), ...authored.map((p) => p.definition!).filter(Boolean), ...onEdge]);
  const profiles = await Promise.all([...wanted].filter((def) => onEdge.has(def)).map((def) => profileFor(def).catch(() => null)));
  return profiles.filter((p): p is EntityProfile => !!p?.pickable).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

// ---------- listing and loading ----------

const textOf = (e: any, names: string[]): string => {
  for (const n of names) {
    const v = e?.[n];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
    const s = loc(v);
    if (s) return s;
  }
  return "";
};

function relSelection(fields: EdgeField[], name: string, inner: string): string {
  const f = fields.find((x) => x.name === name);
  if (!f || f.kind !== "OBJECT") return "";
  return isList(f) ? `${name} { results { ${inner} } }` : `${name} { ${inner} }`;
}
const relResults = (e: any, name: string): any[] => { const v = e?.[name]; return !v ? [] : Array.isArray(v.results) ? v.results : [v]; };

/** The fields that mark a localized or variant copy of another entity. */
const copyMarkers = (fields: EdgeField[]) => ({
  flags: fields.filter((f) => f.kind === "SCALAR" && f.typeName === "Boolean" && /_IsVariant$/.test(f.name)).map((f) => f.name),
  parents: fields.filter((f) => f.kind === "OBJECT" && /(Variant|Localizations?)_Parent$/.test(f.name)).map((f) => f.name),
});
const isCopy = (e: any, m: { flags: string[]; parents: string[] }) => m.flags.some((n) => e?.[n] === true) || m.parents.some((n) => !!e?.[n]?.id);
const parentIdOf = (e: any, m: { parents: string[] }) => { for (const n of m.parents) { const id = e?.[n]?.id; if (id) return String(id); } return ""; };
/** Dotted Content Hub name and REST localization relation of an Edge type (M_PCM_Product → M.PCM.Product, LocalizationToProduct). */
const dotted = (definition: string) => definition.replace(/_/g, ".");
const localizationRelation = (fields: EdgeField[], definition: string) => { const f = localizationFields(fields)[0] ?? ""; return { field: f, relation: f ? f.replace(/^localizationTo/, "LocalizationTo") : `LocalizationTo${definition.split("_").pop()}` }; };

/**
 * The localized variants of a definition in the active culture, master id → variant id
 * (empty in the default culture). One light list per definition, cached per culture.
 */
async function localizedVariantIdsUncached(definition: string): Promise<Record<string, string>> {
  if (isDefaultCulture()) return {};
  const [p, typeFields, queries] = await Promise.all([profileFor(definition), edgeTypeFields(definition), edgeListQueries()]);
  if (!p || !typeFields || !queries.includes(`all${definition}`)) return {};
  const fields = (await edgeTypeFields(`I${definition}`)) ?? typeFields;
  const markers = copyMarkers(fields);
  const locRel = localizationRelation(fields, definition);
  const selection = ["id", ...p.title.filter((n) => hasField(fields, n)), ...markers.flags, ...markers.parents.map((n) => `${n} { id }`), locRel.field ? `${locRel.field} { id }` : ""].filter(Boolean).join(" ");
  const items = await edgeAllList(`all${definition}`, selection);
  const { byMaster } = await pairLocalizedVariants(items, { definition: dotted(definition), relation: locRel.relation, localizationField: locRel.field, isCopy: (e) => isCopy(e, markers), parentId: (e) => parentIdOf(e, markers), titleOf: (e) => textOf(e, p.title) });
  return Object.fromEntries([...byMaster].map(([m, v]) => [m, String(v.id)]));
}
export const localizedVariantIds = cachedByCulture("ch-localized", localizedVariantIdsUncached, SCOPED);

function cardOf(p: EntityProfile, e: any): EntityCard {
  const id = String(e.id);
  const title = textOf(e, p.title) || id;
  let image = "";
  let thumb = "";
  let imageLinks: ImageLink[] | undefined;
  for (const rel of p.image) {
    const asset = rel === "self" ? toPortalAsset(e) : relResults(e, rel).map((a) => toPortalAsset(a)).find((a) => a?.preview) ?? null;
    if (asset?.preview) { image = asset.preview; thumb = asset.thumb ?? ""; imageLinks = asset.links; break; }
  }
  const href = !p.detailPath ? "" : p.definition === "M_Brand" ? brandHref(slugify(title)) : `${p.detailPath}/${idParam(id)}`;
  return { id, definition: p.definition, title, subtitle: textOf(e, p.subtitle), summary: textOf(e, p.summary), image, ...(imageLinks?.length ? { imageLinks } : {}), href, ...(typeof e.modifiedOn === "string" && e.modifiedOn ? { modified: e.modifiedOn } : {}), ...(thumb ? { thumb } : {}) };
}

async function listEntitiesUncached(definitionOrType: string): Promise<EntityCard[]> {
  const definition = edgeType(definitionOrType);
  if (definition === "M_Brand") {
    const [brands, visibility] = await Promise.all([listBrands(), getBrandVisibilityMap()]);
    return brands.filter((b) => (visibility[b.brandId] || "visible") !== "hidden").map((b) => ({ id: String(b.brandId), definition, title: b.name, subtitle: "", summary: "", image: b.logoUrl, href: brandHref(b.slug) }));
  }
  const [p, typeFields, queries] = await Promise.all([profileFor(definition), edgeTypeFields(definition), edgeListQueries()]);
  if (!p || !typeFields || !queries.includes(`all${definition}`)) return [];
  // A list of a base type (allM_Content) yields its interface (IM_Content): only the
  // interface's fields may be selected there, not the subtype-specific ones.
  const fields = (await edgeTypeFields(`I${definition}`)) ?? typeFields;
  const markers = copyMarkers(fields);
  const brandRel = fields.find(isBrandRel);
  const locRel = localizationRelation(fields, definition);
  const textFields = [...p.title, ...p.subtitle, ...p.summary].filter((n) => hasField(fields, n));
  const selection = [
    "id",
    ...textFields,
    // (assets select it with ASSET_SELECTION)
    !p.image.includes("self") && hasField(fields, "modifiedOn") ? "modifiedOn" : "",
    ...p.image.map((rel) => (rel === "self" ? ASSET_SELECTION : relSelection(fields, rel, ASSET_SELECTION))),
    brandRel ? relSelection(fields, brandRel.name, "id") : "",
    ...markers.flags,
    ...markers.parents.map((n) => `${n} { id }`),
    locRel.field ? `${locRel.field} { id }` : "",
  ].filter(Boolean).join(" ");
  const [only, items, partnerOnly] = await Promise.all([brandScope(), edgeAllList(`all${definition}`, selection), definition === "M_Asset" ? partnerOnlyAssets() : Promise.resolve(new Map<string, string[]>())]);
  // masters only; in another language each master shows its variant's texts (and images when it has its own)
  const { masters, byMaster } = await pairLocalizedVariants(items, { definition: dotted(definition), relation: locRel.relation, localizationField: locRel.field, isCopy: (e) => isCopy(e, markers), parentId: (e) => parentIdOf(e, markers), titleOf: (e) => textOf(e, p.title) });
  const imageRels = p.image.filter((r) => r !== "self");
  return masters
    .filter((e) => !brandRel || inScope(e[brandRel.name], only))
    .map((e) => { const v = byMaster.get(String(e.id)); const m = overlay(e, v, [...textFields, ...imageRels]); const card = cardOf(p, { ...m, id: e.id }); return v ? { ...card, title: stripVariantSuffix(card.title) } : card; })
    .filter((c) => definition !== "M_Asset" || (c.image && !partnerOnly.has(c.id)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Every entity of a list query, before the scope filter: up to EDGE_LIST_MAX (warned when cut). */
const edgeAllList = (field: string, selection: string) => edgeAll(field, selection, { max: EDGE_LIST_MAX });

/** Every published entity of a definition as cards (brand scope applied), cached 60 s per culture. */
export const listEntities = cachedByCulture("ch-entities", listEntitiesUncached, SCOPED);

/** Cards for chosen ids, in that order; ids Edge doesn't list are returned in `missing`. */
export async function cardsFor(definitionOrType: string, ids: string[]): Promise<{ cards: EntityCard[]; missing: string[] }> {
  const all = await listEntities(edgeType(definitionOrType));
  const byId = new Map(all.map((c) => [c.id, c]));
  const cards: EntityCard[] = [];
  const missing: string[] = [];
  for (const id of ids) { const c = byId.get(id); if (c) cards.push(c); else missing.push(id); }
  return { cards, missing };
}

/** Search the published entities of a definition (title, subtitle, summary, id; every word must match). */
export async function searchEntities(definitionOrType: string, q: string, limit = 60): Promise<{ total: number; items: EntityCard[] }> {
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const words = norm(q).split(/\s+/).filter(Boolean);
  const all = await listEntities(definitionOrType);
  const hits = words.length ? all.filter((c) => { const hay = norm(`${c.title} ${c.subtitle} ${c.summary} ${c.id}`); return words.every((w) => hay.includes(w)); }) : all;
  return { total: hits.length, items: hits.slice(0, limit) };
}

function displayValue(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  const s = loc(v);
  if (s) return s;
  if (Array.isArray(v)) return v.map(loc).filter(Boolean).join(", ");
  return "";
}

async function loadEntityUncached(definitionOrType: string, id: string): Promise<EntityDetail | null> {
  const definition = edgeType(definitionOrType);
  const [p, fields] = await Promise.all([profileFor(definition), edgeTypeFields(definition)]);
  if (!p || !fields) return null;
  const hidden = new RegExp(p.hidden || HIDDEN_DEFAULT, "i");
  const scalars = fields.filter((f) => f.kind === "SCALAR" && SCALARS.has(f.typeName) && f.name !== "id");
  const assetRels = fields.filter(isAssetRel).map((f) => f.name);
  const brandRel = fields.find(isBrandRel);
  const markers = copyMarkers(fields);
  const selection = [
    "id", ...scalars.map((f) => f.name),
    ...(definition === "M_Asset" ? [ASSET_SELECTION] : assetRels.map((rel) => relSelection(fields, rel, ASSET_SELECTION))),
    brandRel ? relSelection(fields, brandRel.name, "id") : "",
    ...markers.parents.map((n) => `${n} { id }`),
  ].filter(Boolean).join(" ");
  const [data, only] = await Promise.all([edgeRequest(`query($id: String!) { e: ${lowerFirst(definition)}(id: $id) { ${selection} } }`, { id }), brandScope()]);
  const master = data?.e;
  if (!master || (brandRel && !inScope(master[brandRel.name], only))) return null;
  // the variant of the page's language, laid over the master (values, and assets when it has its own)
  const variantId = (await localizedVariantIds(definition))[String(master.id)];
  const variant = variantId ? (await edgeRequest(`query($id: String!) { e: ${lowerFirst(definition)}(id: $id) { ${selection} } }`, { id: variantId }))?.e : null;
  const e = variant ? { ...overlay(master, variant, [...scalars.map((f) => f.name), ...assetRels]), id: master.id } : master;
  const card0 = cardOf(p, e);
  const card = variant ? { ...card0, title: stripVariantSuffix(card0.title) } : card0;
  const assets = definition === "M_Asset" ? [toPortalAsset(e)].filter((a): a is PortalAsset => !!a) : assetRels.flatMap((rel) => relResults(e, rel).map(toPortalAsset)).filter((a): a is PortalAsset => !!a).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);
  const images = assets.filter((a) => (a.kind === "image" || a.kind === "video") && a.preview);
  const used = new Set([...p.title, ...p.subtitle, ...p.summary]);
  const longText = scalars.filter((f) => textKind(f) && /long|body|description|text$/i.test(f.name) && !used.has(f.name)).map((f) => loc(e[f.name])).find((s) => s.length > 0) ?? "";
  const fieldsOut = scalars
    .filter((f) => !hidden.test(f.name) && !used.has(f.name))
    .map((f) => ({ label: fieldLabel(f.name), value: displayValue(e[f.name]) }))
    .filter((f) => f.value && f.value.length < 600 && f.value !== longText);
  const relations = await loadRelations(p, fields, e);
  return { ...card, label: p.label, html: longText, fields: fieldsOut, images, files: assets.filter((a) => !images.includes(a)), relations };
}

/** Relations worth showing on a detail page: list relations to pickable, non-asset types
 *  (the profile's `detailRelations` when set), each hydrated to cards. */
function relationFields(p: EntityProfile, fields: EdgeField[]): EdgeField[] {
  const wanted = p.detailRelations.length ? fields.filter((f) => p.detailRelations.includes(f.name)) : fields.filter((f) => isList(f) && target(f) !== "M_Asset" && target(f) !== "M_Brand" && target(f) !== p.definition && !NOT_PICKABLE.test(target(f)) && !/Self|Draft|Variant|Localization|Gate|Review|Check/i.test(f.name));
  return wanted.filter(isList).slice(0, 8);
}

async function loadRelations(p: EntityProfile, fields: EdgeField[], e: any): Promise<EntityRelation[]> {
  const rels = relationFields(p, fields);
  if (!rels.length) return [];
  const selection = rels.map((f) => `${f.name} { results { id } }`).join(" ");
  const data = await edgeRequest(`query($id: String!) { e: ${lowerFirst(p.definition)}(id: $id) { ${selection} } }`, { id: String(e.id) });
  // four relations at a time (each lists its target definition), in the schema's order
  const out = await mapPool(rels, 4, async (f): Promise<EntityRelation | null> => {
    const ids = (data?.e?.[f.name]?.results ?? []).map((r: any) => String(r.id)).slice(0, 24);
    if (!ids.length) return null;
    const tp = await profileFor(target(f)).catch(() => null);
    if (!tp) return null;
    const { cards } = await cardsFor(target(f), ids);
    return cards.length ? { name: f.name, label: tp.labelPlural, definition: target(f), items: cards } : null;
  });
  return out.filter((r): r is EntityRelation => !!r);
}

/** The entities behind a profile's `expand` relation of one entity (a family's products). */
export async function expandEntity(definitionOrType: string, id: string): Promise<EntityRelation | null> {
  const definition = edgeType(definitionOrType);
  const [p, fields] = await Promise.all([profileFor(definition), edgeTypeFields(definition)]);
  if (!p?.expand || !fields) return null;
  const f = fields.find((x) => x.name === p.expand && isList(x));
  if (!f) return null;
  const data = await edgeRequest(`query($id: String!) { e: ${lowerFirst(definition)}(id: $id) { ${f.name} { results { id } } } }`, { id });
  const ids = (data?.e?.[f.name]?.results ?? []).map((r: any) => String(r.id)).slice(0, 48);
  const tp = await profileFor(target(f));
  if (!ids.length || !tp) return null;
  const { cards } = await cardsFor(target(f), ids);
  return { name: f.name, label: tp.labelPlural, definition: target(f), items: cards };
}

/** One entity in full (scalars, images, files), cached 60 s per culture. */
export const loadEntity = cachedByCulture("ch-entity", loadEntityUncached, SCOPED);
