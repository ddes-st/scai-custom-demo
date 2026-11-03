import "server-only";
/**
 * Aggregates one BrandGuidelineData per brand: REST for brand + asset metadata (with public-link
 * URLs for every binary), Experience Edge for the three content sections. Wrapped in
 * unstable_cache (60s) so the dynamic pages stay fast without hammering Content Hub. The loaders
 * THROW when Content Hub or Edge doesn't answer, so a hiccup is never cached as an empty or
 * partial brand book; only a genuinely empty answer is.
 */
import { cachedByCulture, SCOPED } from "./culture";
import { ChHttpError, definitionEntities, extractPropValue, mapPool, publicLinkUrlStrict, queryEntities, resolveIdentifierStrict } from "./rest";
import { loadEdgeContent } from "./edge";
import { resolveSignedOriginalHref } from "./signedHref";
import { gatedFileUrl } from "./fileUrl";
import { env } from "./env";
import { brandScope } from "../portal/scope";
import { parseCihubColor, parseLenientJson } from "./colorService";
import { fileSizeToBytes } from "./format";
import {
  BrandColorAsset,
  BrandGuidelineData,
  BrandSummary,
  FontAsset,
  GuidelineAsset,
  LogoAsset,
  TemplateAsset,
} from "./types";

const ASSET_TYPES = {
  color: "M.AssetType.BrandColor",
  guideline: "M.AssetType.Brand.Guideline",
  font: "M.AssetType.Brand.Font",
  logo: "M.AssetType.Brand.Logo",
  template: "M.AssetType.Brand.Templates",
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchBrandEntities(): Promise<any[]> {
  const all = await definitionEntities("M.Brand");
  // the Portal Settings brand scope: only the demo's brands (a tenant can host several demos)
  const only = await brandScope();
  return only.size ? all.filter((b) => only.has(String(b?.identifier ?? ""))) : all;
}

function visualizationColor(entity: any): string {
  const vis = entity?.properties?.["Entity.Visualization"];
  return vis && typeof vis === "object" ? String(vis.color || "") : "";
}

async function queryBrandAssets(brandId: number, typeIdentifier: string): Promise<any[]> {
  // null only when the asset type really isn't on the tenant; a failure throws
  const typeId = await resolveIdentifierStrict(typeIdentifier);
  if (!typeId) return [];
  return queryEntities(
    `Definition.Name=='M.Asset' AND Parent('PCMBrandToAsset').id==${brandId} AND Parent('AssetTypeToAsset').id==${typeId}`
  );
}

/**
 * A brand's master asset (PCMBrandToMasterAsset): THE brand's logo wherever the portal shows one (brand
 * tiles, the brand book). null without one — then the first file typed Brand Logo stands in.
 */
async function brandMasterAsset(brandId: number): Promise<any | null> {
  // 400: no such relation on this tenant; any other failure throws (never cached)
  const rows = await queryEntities(`Definition.Name=='M.Asset' AND Parent('PCMBrandToMasterAsset').id==${brandId}`).catch((e) => {
    if (e instanceof ChHttpError && e.status === 400) return [];
    throw e;
  });
  return rows[0] ?? null;
}

function assetTitle(item: any): string {
  return extractPropValue(item.properties, "Title") || extractPropValue(item.properties, "FileName");
}

/**
 * The URL a browser uses for an asset binary:
 * - public mode: the permanent public link (downloadOriginal)
 * - gated mode: a VERSIONED same-origin URL (/api/asset/<id>?v=<modified>) — no Content Hub
 *   call while the page renders; the route resolves the file once per version and region and
 *   Vercel's CDN keeps it (see app/api/asset/[id]/route.ts). Content Hub's throttle budget
 *   (about a dozen requests per burst) is then spent once per changed file, not per view.
 */
async function assetUrl(item: any): Promise<string> {
  if (env.gatedFiles) return gatedFileUrl(item.id, { version: item.modified_on || item.created_on });
  return publicLinkUrlStrict(item.id);
}

/** Server-side byte access (colour JSON): signed href in gated mode, public link otherwise. */
async function assetFetchUrl(assetId: number): Promise<string> {
  if (env.gatedFiles) return resolveSignedOriginalHref(String(assetId));
  return publicLinkUrlStrict(assetId);
}

async function listBrandsUncached(): Promise<BrandSummary[]> {
  const brands = await fetchBrandEntities();
  return mapPool(brands, 4, async (b) => {
    const name = extractPropValue(b.properties, "BrandName") || b.identifier || `Brand ${b.id}`;
    const master = await brandMasterAsset(b.id);
    const logo = master ?? (await queryBrandAssets(b.id, ASSET_TYPES.logo))[0];
    const logoUrl = logo ? await assetUrl(logo) : "";
    return {
      brandId: b.id,
      identifier: String(b.identifier ?? ""),
      name,
      slug: slugify(name),
      visualizationColor: visualizationColor(b),
      logoUrl,
    };
  });
}

async function loadBrandDataUncached(slug: string): Promise<BrandGuidelineData | null> {
  const brands = await fetchBrandEntities();
  const brand = brands.find(
    (b) => slugify(extractPropValue(b.properties, "BrandName") || b.identifier || "") === slug
  );
  if (!brand) return null;

  const brandId: number = brand.id;
  const brandName = extractPropValue(brand.properties, "BrandName") || brand.identifier;

  const [colorItems, guidelineItems, fontItems, typedLogos, templateItems, edge, master] = await Promise.all([
    queryBrandAssets(brandId, ASSET_TYPES.color),
    queryBrandAssets(brandId, ASSET_TYPES.guideline),
    queryBrandAssets(brandId, ASSET_TYPES.font),
    queryBrandAssets(brandId, ASSET_TYPES.logo),
    queryBrandAssets(brandId, ASSET_TYPES.template),
    loadEdgeContent(brand.identifier),
    brandMasterAsset(brandId),
  ]);
  // the brand's logo (its master asset) first — the brand book's hero logo — then the other logo files
  const logoItems = master ? [master, ...typedLogos.filter((l: any) => l.id !== master.id)] : typedLogos;

  // Colors: read the .cihubcolor JSON server-side through its public link (no CORS in play).
  const colors: BrandColorAsset[] = await mapPool(colorItems, 8, async (item) => {
    const title = assetTitle(item);
    const url = await assetFetchUrl(item.id);
    if (!url) return { assetId: item.id, title, color: null, loadError: "No file URL yet" };
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const color = parseCihubColor(parseLenientJson(await r.text()));
      return { assetId: item.id, title, color, loadError: color ? undefined : "Invalid .cihubcolor content" };
    } catch (e: any) {
      return { assetId: item.id, title, color: null, loadError: e?.message || "Load failed" };
    }
  });

  const guidelines: GuidelineAsset[] = await mapPool(guidelineItems, 8, async (item) => ({
    assetId: item.id,
    title: assetTitle(item),
    fileName: extractPropValue(item.properties, "FileName"),
    url: await assetUrl(item),
    sizeBytes: fileSizeToBytes(item.properties?.FileSize),
    updatedAt: item.modified_on || item.created_on || null,
  }));

  const fonts: FontAsset[] = await mapPool(fontItems, 8, async (item) => ({
    assetId: item.id,
    title: assetTitle(item),
    fileName: extractPropValue(item.properties, "FileName"),
    url: await assetUrl(item),
  }));

  const logos: LogoAsset[] = await mapPool(logoItems, 8, async (item) => ({
    assetId: item.id,
    title: assetTitle(item),
    fileName: extractPropValue(item.properties, "FileName"),
    url: await assetUrl(item),
  }));

  const templates: TemplateAsset[] = await mapPool(templateItems, 8, async (item) => ({
    assetId: item.id,
    title: assetTitle(item),
    fileName: extractPropValue(item.properties, "FileName"),
    url: await assetUrl(item),
    sizeBytes: fileSizeToBytes(item.properties?.FileSize),
  }));

  colors.sort((a, b) => (a.color?.id || "zzz").localeCompare(b.color?.id || "zzz") || a.title.localeCompare(b.title));
  guidelines.sort((a, b) => a.title.localeCompare(b.title));
  fonts.sort((a, b) => a.title.localeCompare(b.title));
  // the master stays first; the other logo files by title
  if (master) logos.splice(1, logos.length - 1, ...logos.slice(1).sort((a, b) => a.title.localeCompare(b.title)));
  else logos.sort((a, b) => a.title.localeCompare(b.title));
  templates.sort((a, b) => a.title.localeCompare(b.title));

  return {
    brandId,
    brandName,
    visualizationColor: visualizationColor(brand),
    colors,
    logos,
    guidelines,
    fonts,
    templates,
    ...edge,
  };
}

export const listBrands = cachedByCulture("brand-list", listBrandsUncached, SCOPED);

export const loadBrandData = cachedByCulture("brand-data", loadBrandDataUncached, SCOPED);
