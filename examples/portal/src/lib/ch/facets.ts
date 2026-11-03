import "server-only";
import { unstable_cache } from "next/cache";
import { activeCulture, cachedByCulture, runWithCulture } from "./culture";
import { env } from "./env";
import { edgeListQueries, edgeType, humanize, profileFor } from "./entities";
import { edgeAll, edgeTypeFields, hasField, loc, type EdgeField } from "./portalEdge";
import { chGet, extractPropValue, mapPool, queryEntities } from "./rest";

/**
 * Filters for the "Content Hub items" picker: what a definition's entities can be narrowed by.
 *
 *  - Experience Edge relations, found in the schema: every relation of the definition to another
 *    published definition that works as a classification (brand, product family, content type,
 *    campaign, collection, audience, an industry concept…). Self, draft, variant, localization,
 *    asset, public-link and process relations are left out.
 *  - Assets: the file type, from the file name Edge already returns (Content Hub's asset media).
 *  - Content Hub REST, for the classic taxonomies Edge doesn't publish on most tenants (asset type,
 *    lifecycle status, product category through the product family): one query per value — never
 *    one per entity — cached 10 minutes. A taxonomy added to the Edge publishing settings later
 *    shows up as an Edge filter and its REST twin is skipped.
 *
 * A filter is offered only when it narrows the list: two or more values, or one value that some
 * entities lack. Membership is keyed by the Edge id (the Content Hub identifier).
 */
export interface FacetValue { id: string; label: string; count: number }
export interface Facet { key: string; label: string; source: "edge" | "file" | "rest"; values: FacetValue[] }
export interface FacetData { facets: Facet[]; membership: Record<string, Record<string, string[]>> }

const EMPTY: FacetData = { facets: [], membership: {} };
const MAX_EDGE_FACETS = 8;
const MAX_VALUES = 150;

/** Targets that classify nothing for an author. */
const SKIP_TARGET = /^(M_Asset|M_Localization|M_PublicLink|M_ChannelAccount|M_Deliverable|SC_Automation_.*|.*_(Gate|BrandReview|FileCheck|AssetAIIndex|DocInsight|FacePerson|DataSheetLayout|SubmitStatus|StateFlowActivity))$/;
/** Relation names that are structure, not classification. */
const SKIP_NAME = /(_Parents?|_Children|_Child|Draft|Self|Master|Localization|Variant|Adaptation|Reference_|ToGate$)/;
/** Preferred order of the Edge filters (by target type). */
const ORDER = ["M_Brand", "M_PCM_ProductCategory", "M_PCM_ProductFamily", "M_ContentType", "M_CMP_Campaign", "M_Collection", "M_CMP_Audience", "M_PCM_Product"];

const target = (f: EdgeField) => f.typeName.replace(/List$/, "");
const isList = (f: EdgeField) => /List$/.test(f.typeName);
const relIds = (v: any): Array<{ id: string; raw: any }> => (!v ? [] : Array.isArray(v.results) ? v.results : [v]).filter((x: any) => x?.id).map((x: any) => ({ id: String(x.id), raw: x }));

/** One value per label: a master and its localized variants (same name) filter together. */
function mergeSameLabels(facets: Facet[], membership: FacetData["membership"]): Facet[] {
  return facets.map((f) => {
    const canon = new Map<string, FacetValue>(), alias = new Map<string, string>();
    for (const v of f.values) {
      const key = v.label.trim().replace(/\s+[-–]\s+[A-Z]{2}(-[A-Z]{2})?$/, "").toLowerCase();
      const hit = canon.get(key);
      if (hit) { alias.set(v.id, hit.id); hit.count += v.count; } else canon.set(key, { ...v, label: v.label.replace(/\s+[-–]\s+[A-Z]{2}(-[A-Z]{2})?$/, "") });
    }
    if (alias.size) for (const m of Object.values(membership)) if (m[f.key]) m[f.key] = [...new Set(m[f.key].map((id) => alias.get(id) ?? id))];
    return { ...f, values: [...canon.values()] };
  });
}

function finish(facets: Facet[], membership: FacetData["membership"], total: number): Facet[] {
  facets = mergeSameLabels(facets, membership);
  return facets
    .map((f) => ({ ...f, values: f.values.filter((v) => v.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, MAX_VALUES) }))
    .filter((f) => {
      if (f.values.length >= 2) return true;
      if (f.values.length !== 1) return false;
      const tagged = Object.values(membership).filter((m) => m[f.key]?.length).length;
      return tagged < total; // one value that only some entities carry still narrows the list
    });
}

// ---------- Experience Edge ----------

/**
 * Up to two fields that name an entity of a type: its profile's title, else a name/title/label
 * field, else a code (`claimId`) plus a text (`claimText`) — "CRD-DOS-001 · Once-daily dosing".
 */
async function labelFieldsFor(type: string): Promise<string[]> {
  const [p, tf] = await Promise.all([profileFor(type).catch(() => null), edgeTypeFields(type).catch(() => null)]);
  const text = (tf ?? []).filter((f) => f.kind === "SCALAR" && (f.typeName === "String" || f.typeName === "Json")).map((f) => f.name);
  const titled = [...(p?.title ?? []).filter((n) => text.includes(n)), ...text.filter((n) => /(name|title|label)$/i.test(n))];
  if (titled.length) return [titled[0]];
  const code = text.find((n) => /[a-z]Id$/.test(n) || /(code|number)$/i.test(n));
  const prose = text.find((n) => /(text|description|statement|summary)$/i.test(n));
  return [code, prose].filter((n): n is string => !!n);
}
const labelFrom = (raw: any, fields: string[]) => fields.map((f) => loc(raw?.[f]).trim()).filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 70);

async function edgeFacetsUncached(definitionOrType: string): Promise<FacetData> {
  const definition = edgeType(definitionOrType);
  const [fields, queries] = await Promise.all([edgeTypeFields(definition), edgeListQueries()]);
  if (!fields || !queries.includes(`all${definition}`)) return EMPTY;
  // A list of a base type answers with its interface (allM_Content → IM_Content, whose items are
  // the subtypes), a subtype's list with items whose interface lacks most relations. So a relation
  // the interface carries is selected directly, any other through a fragment on the concrete type.
  const iface = await edgeTypeFields(`I${definition}`).catch(() => null);
  const onIface = new Set((iface ?? []).map((f) => f.name));
  const onEdge = new Set(queries.map((q) => q.replace(/^all/, "")));
  const rank = (t: string) => { const i = ORDER.indexOf(t); return i < 0 ? ORDER.length : i; };
  const rels = fields
    .filter((f) => f.kind === "OBJECT" && !SKIP_NAME.test(f.name))
    .filter((f) => { const t = target(f); return t !== definition && !SKIP_TARGET.test(t) && onEdge.has(t); })
    .sort((a, b) => rank(target(a)) - rank(target(b)) || a.name.localeCompare(b.name))
    .slice(0, MAX_EDGE_FACETS);

  // the label fields per target type, selected inline with the ids
  const labelField = new Map<string, string[]>();
  const labelOf = new Map<string, string>();
  for (const r of rels) {
    const t = target(r);
    if (labelField.has(t)) continue;
    const [lf, p] = await Promise.all([labelFieldsFor(t), profileFor(t).catch(() => null)]);
    labelField.set(t, lf);
    labelOf.set(t, p?.label || humanize(t));
  }
  const fileField = definition === "M_Asset" && hasField(fields, "fileName");
  const fieldSel = (name: string, r?: EdgeField) => {
    if (!r) return name;
    const sel = ["id", ...(labelField.get(target(r)) ?? [])].join(" ");
    return isList(r) ? `${name} { results { ${sel} } }` : `${name} { ${sel} }`;
  };
  const parts: Array<{ name: string; r?: EdgeField }> = [...(fileField ? [{ name: "fileName" }] : []), ...rels.map((r) => ({ name: r.name, r }))];
  const direct = parts.filter((x) => !iface || onIface.has(x.name)).map((x) => fieldSel(x.name, x.r));
  const viaType = parts.filter((x) => iface && !onIface.has(x.name)).map((x) => fieldSel(x.name, x.r));
  const selection = ["id", ...direct, viaType.length ? `... on ${definition} { ${viaType.join(" ")} }` : ""].filter(Boolean).join(" ");
  const items = await edgeAll(`all${definition}`, selection, { max: 600 });

  // facet keys: the target type, or the relation when two relations share a target
  const byTarget = new Map<string, number>();
  for (const r of rels) byTarget.set(target(r), (byTarget.get(target(r)) ?? 0) + 1);
  const keyOf = (r: EdgeField) => ((byTarget.get(target(r)) ?? 0) > 1 ? r.name : target(r));
  const membership: FacetData["membership"] = {};
  const facets = new Map<string, Facet>();
  const valueMaps = new Map<string, Map<string, FacetValue>>();
  for (const r of rels) {
    const key = keyOf(r);
    facets.set(key, { key, label: (byTarget.get(target(r)) ?? 0) > 1 ? humanize(r.name.replace(/To[A-Z].*$/, "")) : labelOf.get(target(r)) ?? humanize(target(r)), source: "edge", values: [] });
    valueMaps.set(key, new Map());
  }
  if (fileField) { facets.set("fileType", { key: "fileType", label: "File type", source: "file", values: [] }); valueMaps.set("fileType", new Map()); }
  for (const e of items) {
    const id = String(e.id);
    const m: Record<string, string[]> = (membership[id] = {});
    for (const r of rels) {
      const key = keyOf(r), lf = labelField.get(target(r)) ?? [];
      const vals = relIds(e[r.name]);
      if (!vals.length) continue;
      m[key] = vals.map((v) => v.id);
      const vm = valueMaps.get(key)!;
      for (const v of vals) {
        const hit = vm.get(v.id) ?? { id: v.id, label: labelFrom(v.raw, lf) || v.id, count: 0 };
        hit.count++;
        vm.set(v.id, hit);
      }
    }
    if (fileField) {
      const ext = (/\.([a-z0-9]{2,5})$/i.exec(String(e.fileName ?? ""))?.[1] ?? "").toUpperCase();
      if (ext) {
        const ft = ext === "JPEG" ? "JPG" : ext === "TIF" ? "TIFF" : ext;
        m.fileType = [ft];
        const vm = valueMaps.get("fileType")!;
        const hit = vm.get(ft) ?? { id: ft, label: ft, count: 0 };
        hit.count++;
        vm.set(ft, hit);
      }
    }
  }
  for (const [key, f] of facets) f.values = [...valueMaps.get(key)!.values()];
  // a content subtype (press release, battlecard…) is M.Content with the same ids: its own
  // schema may lack relations the base type publishes (brand, campaign, audience)
  if (definition.startsWith("M_Content_")) {
    const base = await edgeFacets("M_Content").catch(() => EMPTY);
    for (const bf of base.facets) {
      if (facets.has(bf.key)) continue;
      const counts = new Map<string, number>();
      for (const e of items) {
        const vals = base.membership[String(e.id)]?.[bf.key] ?? [];
        if (!vals.length) continue;
        membership[String(e.id)][bf.key] = vals;
        for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      facets.set(bf.key, { ...bf, values: bf.values.map((v) => ({ ...v, count: counts.get(v.id) ?? 0 })) });
    }
  }
  return { facets: finish([...facets.values()], membership, items.length), membership };
}

export const edgeFacets = cachedByCulture("ch-facets-edge", edgeFacetsUncached);

// ---------- Content Hub REST (taxonomies Edge doesn't publish) ----------

interface RestSpec {
  key: string; label: string;
  /** The Edge type that would replace it once published. */
  edgeTarget: string;
  /** The taxonomy definition and its label properties. */
  taxonomy: string; labelProps: string[];
  /** Direct: the entity is the child of `relation`. */
  relation?: string;
  /** Through a parent the entity already has on Edge: taxonomy → `relation` → parent (dotted
   *  `parentDefinition`) → the entity via the Edge facet `edgeFacet`. */
  through?: { relation: string; parentDefinition: string; edgeFacet: string };
}
const REST_SPECS: Array<[RegExp, RestSpec[]]> = [
  [/^M_Asset$/, [
    { key: "assetType", label: "Asset type", edgeTarget: "M_AssetType", taxonomy: "M.AssetType", labelProps: ["Label", "ClassificationName"], relation: "AssetTypeToAsset" },
    { key: "assetStatus", label: "Status", edgeTarget: "M_Final_LifeCycle_Status", taxonomy: "M.Final.LifeCycle.Status", labelProps: ["StatusValue"], relation: "FinalLifeCycleStatusToAsset" },
  ]],
  [/^M_Content/, [
    { key: "contentStatus", label: "Status", edgeTarget: "M_ContentLifeCycle", taxonomy: "M.ContentLifeCycle", labelProps: ["ContentLifeCycle.Label"], relation: "ContentLifeCycleToContent" },
  ]],
  [/^M_PCM_Product$/, [
    { key: "productStatus", label: "Status", edgeTarget: "M_PCM_ProductStatus", taxonomy: "M.PCM.ProductStatus", labelProps: ["ProductStatusLabel", "ProductStatusName"], relation: "PCMProductStatusToProduct" },
    { key: "productCategory", label: "Product category", edgeTarget: "M_PCM_ProductCategory", taxonomy: "M.PCM.ProductCategory", labelProps: ["ProductCategoryLabel", "ProductCategoryName"], through: { relation: "PCMProductCategoryToProductFamily", parentDefinition: "M.PCM.ProductFamily", edgeFacet: "M_PCM_ProductFamily" } }],
  ],
];
/** The dotted Content Hub definition REST queries use (content subtypes are M.Content). */
const restDefinition = (definition: string) => (definition.startsWith("M_Content") ? "M.Content" : definition.replace(/_/g, "."));
const hrefId = (href: unknown) => /\/api\/entities\/(\d+)(?:$|[/?#])/.exec(String(href ?? ""))?.[1] ?? "";

/** Identifiers of `definition`'s entities under one taxonomy value (paged; `members` keeps the payload small). */
async function childrenOf(definition: string, relation: string, valueId: number): Promise<string[]> {
  const out: string[] = [];
  const query = encodeURIComponent(`Definition.Name=='${definition}' AND Parent('${relation}').id==${valueId}`);
  for (let skip = 0; skip < 2000; skip += 100) {
    const d = await chGet(`/api/entities/query?query=${query}&skip=${skip}&take=100&members=${encodeURIComponent(relation)}`);
    const items: any[] = d?.items ?? [];
    for (const i of items) if (i?.identifier) out.push(String(i.identifier));
    if (items.length < 100) break;
  }
  return out;
}

async function restFacetsUncached(definitionOrType: string, culture: string): Promise<FacetData> {
  const definition = edgeType(definitionOrType);
  const specs = REST_SPECS.find(([re]) => re.test(definition))?.[1] ?? [];
  if (!specs.length || !env.chHost || !env.chUser) return EMPTY;
  const queries = new Set((await edgeListQueries()).map((q) => q.replace(/^all/, "")));
  const edge = await runWithCulture(culture, () => edgeFacets(definition));
  const onEdge = new Set(Object.keys(edge.membership));
  const membership: FacetData["membership"] = {};
  const facets: Facet[] = [];
  for (const spec of specs) {
    // published to Edge with its relation → the Edge filter covers it
    if (queries.has(spec.edgeTarget) && edge.facets.some((f) => f.key === spec.edgeTarget)) continue;
    let values: any[] = [];
    try { values = (await queryEntities(`Definition.Name=='${spec.taxonomy}'`)).slice(0, 60); } catch { continue; }
    const label = (v: any) => runWithCulture(culture, async () => spec.labelProps.map((p) => extractPropValue(v?.properties, p)).find(Boolean) || String(v?.identifier ?? v?.id).split(".").pop() || String(v?.id));
    let members: Array<{ id: string; label: string; entities: string[] }> = [];
    if (spec.relation) {
      members = await mapPool(values, 3, async (v) => ({ id: String(v.identifier || v.id), label: await label(v), entities: await childrenOf(restDefinition(definition), spec.relation!, Number(v.id)).catch(() => []) }));
    } else if (spec.through) {
      const via = spec.through;
      // parent numeric id → identifier, then each taxonomy value's parents, then the Edge facet's members
      const parents = new Map((await queryEntities(`Definition.Name=='${via.parentDefinition}'`).catch(() => [])).map((p: any) => [String(p.id), String(p.identifier ?? "")]));
      const byParent = new Map<string, string[]>();
      for (const [entity, m] of Object.entries(edge.membership)) for (const pid of m[via.edgeFacet] ?? []) byParent.set(pid, [...(byParent.get(pid) ?? []), entity]);
      members = await mapPool(values, 3, async (v) => {
        const r = await chGet(`/api/entities/${v.id}/relations/${via.relation}`).catch(() => null);
        const kids: any[] = r?.children ?? (r?.child ? [r.child] : []);
        const ids = kids.map((k) => parents.get(hrefId(k?.href)) ?? "").filter(Boolean);
        return { id: String(v.identifier || v.id), label: await label(v), entities: [...new Set(ids.flatMap((pid) => byParent.get(pid) ?? []))] };
      });
    }
    const facet: Facet = { key: spec.key, label: spec.label, source: "rest", values: [] };
    for (const m of members) {
      const inList = m.entities.filter((id) => onEdge.has(id));
      if (!inList.length) continue;
      facet.values.push({ id: m.id, label: m.label, count: inList.length });
      for (const id of inList) (membership[id] ??= {})[spec.key] = [...((membership[id] ?? {})[spec.key] ?? []), m.id];
    }
    facets.push(facet);
  }
  return { facets: finish(facets, membership, onEdge.size), membership };
}

/** REST filters, cached 10 minutes per definition and culture. */
export const restFacets = (definitionOrType: string): Promise<FacetData> => {
  const culture = activeCulture();
  return unstable_cache(() => restFacetsUncached(definitionOrType, culture), ["ch-facets-rest", edgeType(definitionOrType), culture], { revalidate: 600, tags: ["ch", "ch:ch-facets"] })();
};

// ---------- filtering ----------

/** Selected values per facet key; AND across facets, OR within one. */
export type FacetFilter = Record<string, string[]>;

export function parseFacetFilter(raw: string | null): FacetFilter {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).slice(0, 12).map(([k, vals]) => [String(k).slice(0, 80), (Array.isArray(vals) ? vals : [vals]).map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 50)]).filter(([, vals]) => (vals as string[]).length));
  } catch { return {}; }
}

export const matches = (membership: FacetData["membership"], id: string, filter: FacetFilter, skipKey = ""): boolean =>
  Object.entries(filter).every(([key, wanted]) => key === skipKey || (membership[id]?.[key] ?? []).some((v) => wanted.includes(v)));
