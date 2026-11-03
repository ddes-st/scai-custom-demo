/**
 * GET /api/portal-health — exercises every Content Hub loader and the SitecoreAI settings
 * query and reports counts or the error per area. No secrets, no content; safe to leave on.
 */
import { applyRequestSite, currentSite } from "src/lib/portal/sites";
import { NextRequest, NextResponse } from "next/server";
import client from "src/lib/sitecore-client";
import scConfig from "sitecore.config";
import { resolveDetail } from "src/lib/portal/detail";
import { listBrands } from "src/lib/ch/data";
import { loadCatalog } from "src/lib/ch/products";
import { loadPress } from "src/lib/ch/press";
import { loadMedia } from "src/lib/ch/media";
import { getGlobalConfig } from "src/lib/ch/siteConfig";
import { getPortalSettings } from "src/lib/portal/settings";
import { getPortalTheme } from "src/lib/portal/theme";
import { getSectionPages } from "src/lib/portal/site-pages";
import { toolsDenied } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

async function probe<T>(fn: () => Promise<T>, summarize: (v: T) => unknown): Promise<unknown> {
  const started = Date.now();
  try {
    const value = await fn();
    return { ok: true, ms: Date.now() - started, ...((summarize(value) as object) ?? {}) };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - started, error: String(e?.message ?? e).slice(0, 300) };
  }
}

export async function GET(request: NextRequest) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  // ?wildcard=brands&slug=smith-nephew&kind=brand — checks the wildcard layout + the detail resolver
  const wc = request.nextUrl.searchParams.get("wildcard");
  if (wc) {
    const slug = request.nextUrl.searchParams.get("slug") ?? "";
    const kind = (request.nextUrl.searchParams.get("kind") ?? "brand") as "brand" | "product" | "press";
    const site = currentSite(), locale = scConfig.defaultLanguage;
    const wildcard = await probe(() => client.getPage([wc, ",-w-,"], { site, locale }), (p) => ({ route: p?.layout.sitecore.route?.name ?? null, fields: Object.keys(p?.layout.sitecore.route?.fields ?? {}).slice(0, 6) }));
    const direct = await probe(() => client.getPage([wc, slug], { site, locale }), (p) => ({ route: p?.layout.sitecore.route?.name ?? null }));
    const detail = slug ? await probe(() => resolveDetail(kind, slug), (d) => d) : null;
    return NextResponse.json({ site, locale, wildcard, direct, detail }, { headers: { "Cache-Control": "no-store" } });
  }
  const [settings, pages, brands, catalog, press, media, config, theme] = await Promise.all([
    probe(() => getPortalSettings(), (s) => ({ fromSitecore: s.fromSitecore, rootPath: s.rootPath, brandScope: [...s.brandScope], trackUsage: s.trackUsage })),
    probe(() => getSectionPages(), (p) => ({ pages: p.map((x) => ({ key: x.key, label: x.label, showOnHome: x.showOnHome })) })),
    probe(() => listBrands(), (b) => ({ count: b.length, slugs: b.map((x) => x.slug) })),
    probe(() => loadCatalog(), (c) => ({ products: c.total, families: c.families.length, unassigned: c.unassigned.length, familyLink: c.familyLink })),
    probe(() => loadPress(), (p) => ({ releases: p?.length ?? null })),
    probe(() => loadMedia(), (m) => ({ assets: m?.items.length ?? null, collections: m?.collections.length ?? null, collectionLink: m?.collectionLink ?? null })),
    probe(() => getGlobalConfig(), (c) => ({ accent: c.site.accent, layout: c.site.layout.default, downloads: c.site.downloadsEnabled })),
    probe(() => getPortalTheme(), (t) => ({ accent: t.accent, fonts: t.fonts, brandBookLayout: t.brandBookLayout, source: t.source })),
  ]);
  return NextResponse.json({ settings, pages, brands, catalog, press, media, brandSiteConfig: config, theme }, { headers: { "Cache-Control": "no-store" } });
}
