import "server-only";
/**
 * Product information: families and products from Experience Edge (published only — a
 * product publishes once its product status is Approved; the family link needs
 * PCMProductFamilyToProduct switched on in the publishing settings, which the demo builder
 * does when it deploys this use case).
 *
 * The product page shows every scalar field the tenant's product schema has (industry
 * models add their own), so the field list is read from the Edge schema, not hardcoded.
 * Loaders THROW when Edge doesn't answer (never cached); pages render an error state.
 */
import { cachedByCulture, SCOPED } from "./culture";
import type { ImageLink } from "./image-links";
import { overlay, pairLocalizedVariants, stripVariantSuffix } from "./localized";
import { edgeRequest } from "./edge";
import { brandScope } from "../portal/scope";
import {
  ASSET_SELECTION, EDGE_LIST_MAX, assetsOf, edgeAll, edgeTypeFields, fieldLabel, hasField, inScope, loc, type EdgeField, type PortalAsset,
} from "./portalEdge";

export interface CatalogProduct {
  id: string;
  name: string;
  number: string;
  summary: string;
  image: string;
  /** The image's public links with sizes (ChImage picks per box). */
  imageLinks?: ImageLink[];
  brands: string[];
}

export interface CatalogFamily {
  id: string;
  name: string;
  summary: string;
  parentId: string;
  image: string;
  products: CatalogProduct[];
}

export interface Catalog {
  families: CatalogFamily[];
  /** Published products no loaded family lists (or all of them without the family link). */
  unassigned: CatalogProduct[];
  /** False when Edge doesn't publish the product → family link. */
  familyLink: boolean;
  total: number;
}

const brandNames = (rel: any): string[] => (rel?.results ?? []).map((b: any) => loc(b?.brandName)).filter(Boolean);

function toCatalogProduct(p: any): CatalogProduct {
  const master = assetsOf(p.pCMProductToMasterAsset)[0] ?? assetsOf(p.pCMProductToAsset)[0];
  return {
    id: String(p.id),
    name: stripVariantSuffix(loc(p.productName) || loc(p.productLabel) || String(p.id)),
    number: loc(p.productNumber),
    summary: loc(p.productShortDescription),
    image: master?.preview ?? "",
    ...(master?.links?.length ? { imageLinks: master.links } : {}),
    brands: brandNames(p.brandToProduct),
  };
}

/** A variant of another product (its own page lists it). Localized masters are NOT variants:
 *  the demo builder links every master to its en-US M.Localization. */
const isVariant = (p: any) => !!p.productToProductVariant_Parent?.id || p.m_PCM_Product_IsVariant === true;

async function loadCatalogUncached(): Promise<Catalog> {
  const [productFields, familyFields] = await Promise.all([edgeTypeFields("M_PCM_Product"), edgeTypeFields("M_PCM_ProductFamily")]);
  if (!productFields) return { families: [], unassigned: [], familyLink: false, total: 0 };
  const familyLink = hasField(productFields, "pCMProductFamilyToProduct") && !!familyFields;
  const opt = (fields: EdgeField[] | null, name: string, sel = "") => (hasField(fields, name) ? `${name}${sel}` : "");
  const selection = [
    "id", opt(productFields, "productName"), opt(productFields, "productLabel"), opt(productFields, "productNumber"), opt(productFields, "productShortDescription"),
    opt(productFields, "m_PCM_Product_IsVariant"), opt(productFields, "productToProductVariant_Parent", " { id }"), opt(productFields, "localizationToProduct", " { id }"),
    opt(productFields, "brandToProduct", " { results { id brandName } }"),
    opt(productFields, "pCMProductToMasterAsset", ` { results { ${ASSET_SELECTION} } }`),
    opt(productFields, "pCMProductToAsset", ` { results { ${ASSET_SELECTION} } }`),
    familyLink ? "pCMProductFamilyToProduct { results { id } }" : "",
  ].filter(Boolean).join(" ");
  const familySelection = ["id", opt(familyFields, "productFamilyName"), opt(familyFields, "productFamilyLabel"), opt(familyFields, "productFamilyShortDescription"), opt(familyFields, "pCMProductFamilyToSelf_Parent", " { id }")]
    .filter(Boolean).join(" ");
  const [only, products, families] = await Promise.all([
    brandScope(),
    edgeAll("allM_PCM_Product", selection, { max: EDGE_LIST_MAX }),
    familyLink ? edgeAll("allM_PCM_ProductFamily", familySelection, { max: EDGE_LIST_MAX }) : Promise.resolve([] as any[]),
  ]);
  // masters in scope; in another language a master carries its localized variant's texts
  const { masters, byMaster } = await pairProductVariants(products, hasField(productFields, "localizationToProduct"));
  const main = masters.filter((p) => inScope(p.brandToProduct, only)).map((p) => { const v = byMaster.get(String(p.id)); return v ? { ...overlay(p, v, PRODUCT_TEXT), id: p.id } : p; });
  const loaded = new Set(families.map((f) => String(f.id)));
  const byFamily = new Map<string, CatalogProduct[]>();
  const placed = new Set<string>();
  for (const p of main) {
    const cp = toCatalogProduct(p);
    for (const f of p.pCMProductFamilyToProduct?.results ?? []) {
      const fid = String(f.id);
      if (!loaded.has(fid)) continue;
      const list = byFamily.get(fid) ?? [];
      list.push(cp);
      byFamily.set(fid, list);
      placed.add(cp.id);
    }
  }
  const fams: CatalogFamily[] = families.map((f) => {
    const list = (byFamily.get(String(f.id)) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: String(f.id),
      name: loc(f.productFamilyLabel) || loc(f.productFamilyName) || String(f.id),
      summary: loc(f.productFamilyShortDescription),
      parentId: f.pCMProductFamilyToSelf_Parent?.id ? String(f.pCMProductFamilyToSelf_Parent.id) : "",
      image: list.find((p) => p.image)?.image ?? "",
      products: list,
    };
  }).filter((f) => f.products.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const unassigned = main.filter((p) => !placed.has(String(p.id))).map(toCatalogProduct).sort((a, b) => a.name.localeCompare(b.name));
  return { families: fams, unassigned, familyLink, total: main.length };
}

export const loadCatalog = cachedByCulture("portal-catalog", loadCatalogUncached, SCOPED);

/** The text (and own-asset) fields a localized variant overrides on its master. */
const PRODUCT_TEXT = ["productName", "productLabel", "productShortDescription", "productLongDescription", "productDataSheet", "pCMProductToMasterAsset", "pCMProductToAsset"];
const productTitle = (p: any) => loc(p.productName) || loc(p.productLabel) || String(p.id);
const pairProductVariants = (products: any[], linkPublished: boolean) =>
  pairLocalizedVariants(products, { definition: "M.PCM.Product", relation: "LocalizationToProduct", localizationField: linkPublished ? "localizationToProduct" : "", isCopy: isVariant, parentId: (p) => (p.productToProductVariant_Parent?.id ? String(p.productToProductVariant_Parent.id) : ""), titleOf: productTitle });

/** master id → localized variant id for the active culture (one light list, cached per culture). */
async function productVariantIdsUncached(): Promise<Record<string, string>> {
  const fields = await edgeTypeFields("M_PCM_Product");
  if (!fields) return {};
  const opt = (name: string, sel = "") => (hasField(fields, name) ? `${name}${sel}` : "");
  const selection = ["id", opt("productName"), opt("productLabel"), opt("m_PCM_Product_IsVariant"), opt("productToProductVariant_Parent", " { id }"), opt("localizationToProduct", " { id }")].filter(Boolean).join(" ");
  const products = await edgeAll("allM_PCM_Product", selection, { max: EDGE_LIST_MAX });
  const { byMaster } = await pairProductVariants(products, hasField(fields, "localizationToProduct"));
  return Object.fromEntries([...byMaster].map(([m, v]) => [m, String(v.id)]));
}
export const productVariantIds = cachedByCulture("portal-product-variants", productVariantIdsUncached);

// ---------- one product ----------

/** Fields the product page shows elsewhere or never. */
const HIDDEN = /^(id|createdBy|createdOn|modifiedBy|modifiedOn|publishedToEdgeOn|productName|productLabel|productNumber|productShortDescription|productLongDescription|m_PCM_Product_IsDraft|m_PCM_Product_IsVariant|productCompletenessPercentage|productData(Diagrams|Publications|Versions|Sheet)|preventPublish|.*Status(Details)?)$/i;
const SCALARS = new Set(["String", "Int", "Float", "Boolean", "Long", "Decimal", "DateTime", "DateTimeOffset", "Json"]);

export interface ProductField { label: string; value: string }

export interface ProductDetail {
  id: string;
  name: string;
  number: string;
  summary: string;
  /** Raw HTML or text — rendered through the client-side sanitizer. */
  descriptionHtml: string;
  fields: ProductField[];
  images: PortalAsset[];
  files: PortalAsset[];
  brands: string[];
  families: Array<{ id: string; name: string }>;
  variants: Array<{ id: string; name: string }>;
  related: Array<{ id: string; name: string }>;
  /** The product data editor's sheet (sections of tables and text), when there is one. */
  dataSheet: any | null;
}

function displayValue(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const s = loc(v);
  if (s) return s;
  if (Array.isArray(v)) return v.map(loc).filter(Boolean).join(", ");
  return "";
}

/** The product page's Edge selection: only the fields and links this tenant publishes — on the product, and
 *  inside the family and variant links (Edge rejects the whole query for one unknown field). */
export function productSelection(fields: EdgeField[], familyFields: EdgeField[] | null): string {
  const scalars = fields.filter((f: EdgeField) => f.kind === "SCALAR" && SCALARS.has(f.typeName) && !HIDDEN.test(f.name));
  const opt = (name: string, sel = "") => (hasField(fields, name) ? `${name}${sel}` : "");
  const inner = (typeFields: EdgeField[] | null, names: string[]) => ["id", ...names.filter((n) => hasField(typeFields, n))].join(" ");
  return [
    "id", opt("productName"), opt("productLabel"), opt("productNumber"), opt("productShortDescription"), opt("productLongDescription"), opt("productDataSheet"),
    scalars.map((f) => f.name).join(" "),
    opt("brandToProduct", " { results { id brandName } }"),
    familyFields ? opt("pCMProductFamilyToProduct", ` { results { ${inner(familyFields, ["productFamilyName", "productFamilyLabel"])} } }`) : "",
    opt("pCMProductToMasterAsset", ` { results { ${ASSET_SELECTION} } }`),
    opt("pCMProductToAsset", ` { results { ${ASSET_SELECTION} } }`),
    opt("productToProductVariant_Children", ` { results { ${inner(fields, ["productName", "productNumber"])} } }`),
    opt("pCMProductToContent", " { results { id content_Name } }"),
  ].filter(Boolean).join(" ");
}

async function loadProductUncached(id: string): Promise<ProductDetail | null> {
  const [fields, familyFields] = await Promise.all([edgeTypeFields("M_PCM_Product"), edgeTypeFields("M_PCM_ProductFamily")]);
  if (!fields) return null;
  const scalars = fields.filter((f: EdgeField) => f.kind === "SCALAR" && SCALARS.has(f.typeName) && !HIDDEN.test(f.name));
  const selection = productSelection(fields, familyFields);
  const [data, only] = await Promise.all([edgeRequest(`query($id: String!) { p: m_PCM_Product(id: $id) { ${selection} } }`, { id }), brandScope()]);
  const master = data?.p;
  if (!master || !inScope(master.brandToProduct, only)) return null;
  // the page language's variant laid over the master: texts, data, own assets; relations stay the master's
  const variantId = (await productVariantIds())[String(master.id)];
  const variant = variantId ? (await edgeRequest(`query($id: String!) { p: m_PCM_Product(id: $id) { ${selection} } }`, { id: variantId }))?.p : null;
  const p = variant ? { ...overlay(master, variant, [...PRODUCT_TEXT, ...scalars.map((f) => f.name)]), id: master.id } : master;
  const all = [...assetsOf(p.pCMProductToMasterAsset), ...assetsOf(p.pCMProductToAsset)].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);
  const images = all.filter((a) => (a.kind === "image" || a.kind === "video") && a.preview);
  let sheet: any = p.productDataSheet;
  if (typeof sheet === "string") { try { sheet = JSON.parse(sheet); } catch { sheet = null; } }
  return {
    id: String(p.id),
    name: stripVariantSuffix(loc(p.productName) || loc(p.productLabel) || String(p.id)),
    number: loc(p.productNumber),
    summary: loc(p.productShortDescription),
    descriptionHtml: loc(p.productLongDescription),
    fields: scalars.map((f) => ({ label: fieldLabel(f.name), value: displayValue(p[f.name]) })).filter((f) => f.value && f.value.length < 600),
    images,
    files: all.filter((a) => !images.includes(a)),
    brands: brandNames(p.brandToProduct),
    families: (p.pCMProductFamilyToProduct?.results ?? []).map((f: any) => ({ id: String(f.id), name: loc(f.productFamilyLabel) || loc(f.productFamilyName) })),
    // real variants only — a localized copy ("… - DE", ….de-DE) is this product in another language, not a variant
    variants: (p.productToProductVariant_Children?.results ?? []).map((v: any) => ({ id: String(v.id), name: loc(v.productName) || loc(v.productNumber) || String(v.id) })).filter((v: any) => stripVariantSuffix(v.name) === v.name && !/[._-][a-z]{2}-[A-Z]{2}$/.test(v.id)),
    related: (p.pCMProductToContent?.results ?? []).map((c: any) => ({ id: String(c.id), name: loc(c.content_Name) })).filter((c: any) => c.name),
    dataSheet: sheet && Array.isArray(sheet.sections) && sheet.sections.length ? sheet : null,
  };
}

export const loadProduct = cachedByCulture("portal-product", loadProductUncached, SCOPED);
