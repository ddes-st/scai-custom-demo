import "server-only";
import { listBrands } from "../ch/data";
import { getBrandVisibilityMap } from "../ch/siteConfig";
import { loadCatalog } from "../ch/products";
import { loadPress } from "../ch/press";
import { env } from "../ch/env";
import { detailSections, listEntities } from "../ch/entities";
import { brandHref, pressHref, productHref } from "./sections";

export interface SitemapEntry { loc: string; lastmod?: string; changefreq?: string; priority?: string }

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/**
 * Every Content Hub detail URL the live site serves: visible brand books, published products
 * and press releases. SitecoreAI's own sitemap only knows the five page items (the wildcard
 * pages are one item each), so these are added for crawlers. Each loader is the site's own
 * 60 s cache; a failing source is skipped rather than failing the whole sitemap.
 */
export async function contentHubSitemapEntries(baseUrl: string): Promise<SitemapEntry[]> {
  const base = baseUrl.replace(/\/$/, "");
  const entries: SitemapEntry[] = [];
  const safely = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e: any) { console.warn(`sitemap: ${name} skipped:`, e?.message ?? e); }
  };
  await safely("brands", async () => {
    const [brands, visibility] = await Promise.all([listBrands(), getBrandVisibilityMap()]);
    for (const b of brands) {
      if ((visibility[b.brandId] || "visible") !== "visible") continue;
      entries.push({ loc: `${base}${brandHref(b.slug)}`, changefreq: "weekly", priority: "0.8" });
    }
  });
  if (env.edgeToken) {
    await safely("products", async () => {
      const catalog = await loadCatalog();
      const seen = new Set<string>();
      for (const p of [...catalog.families.flatMap((f) => f.products), ...catalog.unassigned]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        entries.push({ loc: `${base}${productHref(p.id)}`, changefreq: "weekly", priority: "0.7" });
      }
    });
    await safely("press", async () => {
      for (const r of (await loadPress()) ?? []) {
        const day = /^(\d{4}-\d{2}-\d{2})/.exec(r.date || "")?.[1];
        entries.push({ loc: `${base}${pressHref(r.id)}`, ...(day && { lastmod: day }), changefreq: "monthly", priority: "0.6" });
      }
    });
    await safely("generic detail pages", async () => {
      const sections = await detailSections();
      for (const definition of Object.keys(sections)) {
        if (["M_PCM_Product", "M_Content_PressRelease", "M_Brand"].includes(definition)) continue; // covered above
        for (const card of await listEntities(definition)) if (card.href) entries.push({ loc: `${base}${card.href}`, changefreq: "weekly", priority: "0.6" });
      }
    });
  }
  return entries;
}

export const urlXml = (e: SitemapEntry) =>
  `<url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `<priority>${e.priority}</priority>` : ""}</url>`;

export const urlsetXml = (entries: SitemapEntry[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(urlXml).join("\n")}\n</urlset>\n`;

export const sitemapIndexEntryXml = (loc: string) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`;
