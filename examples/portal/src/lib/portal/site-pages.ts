import "server-only";
import { currentSite } from "./sites";
import { unstable_cache } from "next/cache";
import scConfig from "sitecore.config";
import { siteRootPath } from "./settings";
import { withLastGood } from "../ch/last-good";
import { xmcQuery } from "./xmc-graphql";
import { audienceOf, strictest, type Audience } from "./audience";

/**
 * The portal's sections = the published pages directly under Home (in item order), read
 * from SitecoreAI Experience Edge and cached 60 s (a failure is never cached: the last good list
 * of this instance stands in, else none). Drives the navigation (PortalHeader) and
 * the home cards (SectionCards). Wildcard items (`*`) and pages flagged HideFromNav are
 * left out of the navigation; ShowOnHome selects the cards.
 */
export interface SectionPage {
  name: string;
  /** Public path, e.g. /products. */
  href: string;
  /** The first path segment, e.g. "products" — the active-nav key. */
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  lead: string;
  blurb: string;
  showOnHome: boolean;
  hideFromNav: boolean;
  /** Who may see the section (VisibleTo): everyone | partners | staff. */
  visibleTo: Audience;
}

// Edge's query-complexity limit: `url { path }` and per-field `field(name:)` lookups blow it
// up for a page list, while name + all fields of up to 20 children stays well within it — so
// the children come 20 per request, up to MAX_PAGES.
const PAGES_QUERY = `query($path: String!, $language: String!, $after: String) {
  item(path: $path, language: $language) {
    children(hasLayout: true, first: 20, after: $after) {
      pageInfo { hasNext endCursor }
      results { name displayName fields { name value } }
    }
  }
}`;
const MAX_PAGES = 100;

async function loadSectionPagesUncached(site: string, language: string): Promise<SectionPage[]> {
  const rootPath = await siteRootPath(site, language);
  if (!rootPath) return [];
  const children: any[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES / 20; page++) {
    const data: { item?: { children?: { results?: any[]; pageInfo?: { hasNext?: boolean; endCursor?: string } } } } =
      await xmcQuery(PAGES_QUERY, { path: `${rootPath}/Home`, language, after });
    const list = data?.item?.children;
    children.push(...(list?.results ?? []));
    if (!list?.pageInfo?.hasNext || !list.pageInfo.endCursor) { after = null; break; }
    after = String(list.pageInfo.endCursor);
  }
  if (after) console.warn(`portal pages: more than ${MAX_PAGES} pages under Home, the rest are left out`);
  const pages: SectionPage[] = [];
  for (const child of children) {
    const name = String(child?.name ?? "");
    if (!name || name === "*") continue;
    const f = new Map<string, string>((child?.fields ?? []).map((x: any) => [String(x.name), String(x.value ?? "").trim()]));
    // SXA URL segment of a page = its item name, spaces as dashes
    const key = name.trim().toLowerCase().replace(/\s+/g, "-");
    const label = f.get("NavLabel") || String(child?.displayName || name).trim();
    pages.push({
      name,
      key,
      href: `/${key}`,
      label,
      eyebrow: f.get("Eyebrow") || label,
      title: f.get("Title") || "",
      lead: f.get("Lead") || "",
      blurb: f.get("Blurb") || "",
      showOnHome: f.get("ShowOnHome") === "1",
      hideFromNav: f.get("HideFromNav") === "1",
      visibleTo: audienceOf(f.get("VisibleTo")),
    });
  }
  return pages;
}

const loadSectionPages = (site: string, language: string) =>
  unstable_cache(() => loadSectionPagesUncached(site, language), ["portal-section-pages", site, language], { revalidate: 60, tags: ["xmc-site"] })();

/** The section pages; THROWS when SitecoreAI doesn't answer (for other cached loaders). */
export async function loadSectionPagesStrict(site = "", language = scConfig.defaultLanguage): Promise<SectionPage[]> {
  site = site || currentSite();
  const pages = await loadSectionPages(site, language || scConfig.defaultLanguage);
  if (!language || language === scConfig.defaultLanguage) return pages;
  // Settings read in the default language too: the stricter audience and HideFromNav win, and
  // ShowOnHome holds in either — a language version without the values changes nothing.
  const base = new Map((await loadSectionPages(site, scConfig.defaultLanguage)).map((p) => [p.name, p]));
  return pages.map((p) => {
    const b = base.get(p.name);
    return b ? { ...p, visibleTo: strictest(p.visibleTo, b.visibleTo), hideFromNav: p.hideFromNav || b.hideFromNav, showOnHome: p.showOnHome || b.showOnHome } : p;
  });
}

const sectionPages = withLastGood("portal pages", (site: string, language: string) => loadSectionPagesStrict(site, language), () => [] as SectionPage[]);

export async function getSectionPages(site = "", language = scConfig.defaultLanguage): Promise<SectionPage[]> {
  return sectionPages(site || currentSite(), language || scConfig.defaultLanguage);
}
