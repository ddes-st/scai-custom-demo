import "server-only";
/**
 * The press room: M.Content of the Press release content type (M.ContentType.PressRelease,
 * prefix PressRelease → Edge type M_Content_PressRelease, fields pressRelease_*), published
 * once the content reaches Final. Newest first by Content.PublicationDate. Master image and
 * linked assets make the release's media kit. Variants / localized copies are left out.
 * Loaders THROW when Edge doesn't answer (never cached).
 */
import { cachedByCulture, SCOPED } from "./culture";
import type { ImageLink } from "./image-links";
import { overlay, pairLocalizedVariants, stripVariantSuffix } from "./localized";
import { requestContext } from "../portal/request-context";
import { edgeRequest } from "./edge";
import { brandScope } from "../portal/scope";
import { ASSET_SELECTION, EDGE_LIST_MAX, assetsOf, edgeAll, edgeTypeFields, hasField, inScope, loc, type PortalAsset } from "./portalEdge";

const TYPE = "M_Content_PressRelease";
const LIST = "allM_Content_PressRelease";
const SINGLE = "m_Content_PressRelease";

export interface PressRelease {
  id: string;
  title: string;
  lead: string;
  date: string;
  brands: string[];
  image: string;
  /** The image's public links with sizes (ChImage picks per box). */
  imageLinks?: ImageLink[];
}

export interface PressReleaseDetail extends PressRelease {
  bodyHtml: string;
  boilerplateHtml: string;
  contact: string;
  media: PortalAsset[];
}

async function selection(detail: boolean): Promise<string | null> {
  const fields = await edgeTypeFields(TYPE);
  if (!fields) return null;
  const opt = (name: string, sel = "") => (hasField(fields, name) ? `${name}${sel}` : "");
  return [
    "id", opt("content_Name"), opt("pressRelease_Title"), opt("pressRelease_Lead"), opt("content_PublicationDate"),
    opt("m_Content_IsVariant"), opt("contentToContentVariant_Parent", " { id }"), opt("contentToContentLocalization_Parent", " { id }"), opt("localizationToContent", " { id }"),
    opt("brandToContent", " { results { id brandName } }"),
    opt("cmpContentToMasterLinkedAsset", ` { results { ${ASSET_SELECTION} } }`),
    ...(detail ? [opt("pressRelease_Body"), opt("pressRelease_Boilerplate"), opt("pressRelease_Contact"), opt("cmpContentToLinkedAsset", ` { results { ${ASSET_SELECTION} } }`)] : []),
  ].filter(Boolean).join(" ");
}

const isCopy = (c: any) => c.m_Content_IsVariant === true || !!c.contentToContentVariant_Parent?.id || !!c.contentToContentLocalization_Parent?.id;
const releaseTitle = (c: any) => loc(c.pressRelease_Title) || loc(c.content_Name) || String(c.id);
const RELEASE_TEXT = ["pressRelease_Title", "pressRelease_Lead", "content_Name", "pressRelease_Body", "pressRelease_Boilerplate", "pressRelease_Contact", "cmpContentToMasterLinkedAsset", "cmpContentToLinkedAsset"];
const pairReleaseVariants = (items: any[]) =>
  pairLocalizedVariants(items, { definition: "M.Content", relation: "LocalizationToContent", localizationField: "localizationToContent", isCopy, parentId: (c) => (c.contentToContentLocalization_Parent?.id ? String(c.contentToContentLocalization_Parent.id) : c.contentToContentVariant_Parent?.id ? String(c.contentToContentVariant_Parent.id) : ""), titleOf: releaseTitle });

/** master id → localized variant id for the active culture. */
async function releaseVariantIdsUncached(): Promise<Record<string, string>> {
  const sel = await selection(false);
  if (!sel) return {};
  const { byMaster } = await pairReleaseVariants(await edgeAll(LIST, sel, { max: EDGE_LIST_MAX }));
  return Object.fromEntries([...byMaster].map(([m, v]) => [m, String(v.id)]));
}
export const releaseVariantIds = cachedByCulture("portal-press-variants", releaseVariantIdsUncached);

function toRelease(c: any): PressRelease {
  const image = assetsOf(c.cmpContentToMasterLinkedAsset).find((a) => a.preview);
  return {
    id: String(c.id),
    title: stripVariantSuffix(releaseTitle(c)),
    lead: loc(c.pressRelease_Lead),
    date: typeof c.content_PublicationDate === "string" ? c.content_PublicationDate : "",
    brands: (c.brandToContent?.results ?? []).map((b: any) => loc(b?.brandName)).filter(Boolean),
    image: image?.preview ?? "",
    ...(image?.links?.length ? { imageLinks: image.links } : {}),
  };
}

/** The press room lists at most this many releases (newest first). */
const MAX_RELEASES = 300;

const time = (iso: string) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };

async function loadPressUncached(): Promise<PressRelease[] | null> {
  const sel = await selection(false);
  if (!sel) return null;
  const [items, only] = await Promise.all([edgeAll(LIST, sel, { max: EDGE_LIST_MAX }), brandScope()]);
  const { masters, byMaster } = await pairReleaseVariants(items);
  // newest first BEFORE the cut, so the latest releases always make the list
  const all = masters.filter((c) => inScope(c.brandToContent, only)).map((c) => { const v = byMaster.get(String(c.id)); return toRelease(v ? { ...overlay(c, v, RELEASE_TEXT), id: c.id } : c); }).sort((a, b) => time(b.date) - time(a.date));
  if (all.length > MAX_RELEASES) console.warn(`press: ${all.length} releases in scope, showing the newest ${MAX_RELEASES}`);
  return all.slice(0, MAX_RELEASES);
}

/** null when Edge has no Press release type (the use case isn't set up on this tenant). */
export const loadPress = cachedByCulture("portal-press", loadPressUncached, SCOPED);

async function loadReleaseUncached(id: string): Promise<PressReleaseDetail | null> {
  const sel = await selection(true);
  if (!sel) return null;
  const [data, only] = await Promise.all([edgeRequest(`query($id: String!) { c: ${SINGLE}(id: $id) { ${sel} } }`, { id }), brandScope()]);
  const master = data?.c;
  if (!master || !inScope(master.brandToContent, only)) return null;
  const variantId = (await releaseVariantIds())[String(master.id)];
  const variant = variantId ? (await edgeRequest(`query($id: String!) { c: ${SINGLE}(id: $id) { ${sel} } }`, { id: variantId }))?.c : null;
  const c = variant ? { ...overlay(master, variant, RELEASE_TEXT), id: master.id } : master;
  const media = [...assetsOf(c.cmpContentToMasterLinkedAsset), ...assetsOf(c.cmpContentToLinkedAsset)].filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);
  return {
    ...toRelease(c),
    bodyHtml: loc(c.pressRelease_Body),
    boilerplateHtml: loc(c.pressRelease_Boilerplate),
    contact: loc(c.pressRelease_Contact),
    media,
  };
}

export const loadRelease = cachedByCulture("portal-press-release", loadReleaseUncached, SCOPED);

/** The release date as written (its calendar day), not shifted by the server's time zone. */
export function formatDate(iso: string, locale?: string): string {
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(iso || "")?.[1];
  if (!day) return "";
  const d = new Date(`${day}T12:00:00Z`);
  let tag = locale || "";
  if (!tag) { try { tag = requestContext().locale; } catch { /* outside a request */ } }
  if (!tag || tag === "en") tag = "en-GB";
  try {
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(tag, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  } catch {
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }
}
