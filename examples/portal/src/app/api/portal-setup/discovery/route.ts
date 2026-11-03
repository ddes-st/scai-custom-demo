/**
 * GET /api/portal-setup/discovery — what the Portal setup wizard needs from this deployment:
 * the Content Hub data the setup reads (crop names, partner kits, brands for the scope), a
 * health check of the head's configuration and Content Hub connection, and suggested values.
 * Never returns secrets — only whether they are set. Not cached.
 *
 * The Demo Builder's SitecoreAI portal card filters these checks by `id` to the site's sections
 * (type-M_* per section, kits, crops, usage, revalidate, editing-secret): renaming or adding a
 * check id must be passed on to the Demo Builder.
 */
import { applyRequestSite, currentSite, micrositeIdNow, portalUrlNow, siteKindNow } from "src/lib/portal/sites";
import { jointMicrositeOf, jointMicrosites } from "src/lib/portal/microsites";
import { NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { edgeRequest } from "src/lib/ch/edge";
import { chGet } from "src/lib/ch/rest";
import { edgeListQueries } from "src/lib/ch/entities";
import { discoverFromEdge, verticalOf } from "src/lib/portal/setup/core.mjs";
import { deployTheme } from "src/lib/portal/deploy-theme";
import { deploymentDealers } from "src/lib/portal/dealers";
import { loadMicrosite, micrositeSetupInfo } from "src/lib/ch/automotive";
import { isEditingHost } from "src/lib/portal/editing-host-flag";
import { routing } from "src/i18n/routing";
import { toolsDenied } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

type Status = "ok" | "warn" | "fail";
interface Check { id: string; label: string; status: Status; detail: string; fix?: string }

const withTimeout = <T,>(p: Promise<T>, ms = 15000) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms / 1000}s`)), ms))]);

const WANTED: Array<[string, string]> = [
  ["M_PCM_Product", "Products"], ["M_PCM_ProductFamily", "Product families"], ["M_Content_PressRelease", "Press releases"],
  ["M_Asset", "Assets"], ["M_Collection", "Collections"], ["M_CMP_Campaign", "Campaigns"], ["M_Brand", "Brands"],
  ["M_Content_Battlecard", "Battlecards"], ["M_Content_CaseStudy", "Case studies"], ["BrandSite_Config", "Brand site config"],
];

export async function GET(request: Request) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const set = (v: string) => (v ? "set" : "missing");

  // 1. this deployment's configuration
  add({ id: "edge-context", label: "SitecoreAI context id", status: process.env.SITECORE_EDGE_CONTEXT_ID ? "ok" : "fail", detail: set(process.env.SITECORE_EDGE_CONTEXT_ID || ""), fix: "Set SITECORE_EDGE_CONTEXT_ID (live id on the public site, preview id on an editing host)." });
  add({ id: "editing-secret", label: "Editing secret", status: process.env.SITECORE_EDITING_SECRET ? "ok" : "warn", detail: set(process.env.SITECORE_EDITING_SECRET || ""), fix: "Set SITECORE_EDITING_SECRET to the environment's editing secret if this deployment serves the Page builder." });
  add({ id: "site-url", label: "Public URL", status: process.env.NEXT_PUBLIC_SITE_URL ? "ok" : "warn", detail: process.env.NEXT_PUBLIC_SITE_URL || "missing", fix: "Set NEXT_PUBLIC_SITE_URL to the public domain (sitemap, canonical and hreflang links)." });
  add({ id: "revalidate", label: "Instant updates", status: process.env.REVALIDATE_SECRET ? "ok" : "warn", detail: set(process.env.REVALIDATE_SECRET || ""), fix: "Set REVALIDATE_SECRET and add the Content Hub API-call action that POSTs /api/revalidate." });
  add({ id: "site-mode", label: "Site mode", status: env.siteMode !== "public" && !env.authSecret ? "fail" : "ok", detail: `${env.siteMode}${env.siteMode !== "public" ? `, sign-in secret ${set(env.authSecret)}` : ""}${env.siteMode === "public" && env.filesViaAsset ? ", files through the portal (PORTAL_FILES=asset)" : ""}`, fix: "Hybrid and gated mode need AUTH_SECRET, PORTAL_USER and a password." });

  // 2. Content Hub connection
  add({ id: "ch-config", label: "Content Hub settings", status: env.chHost && env.chUser && env.edgeUrl && env.edgeToken ? "ok" : "fail", detail: env.chHost ? env.chHost.replace(/^https?:\/\//, "") : "CH_HOST missing", fix: "Set CH_HOST, CH_USER, CH_PASS, EDGE_GRAPHQL_URL and EDGE_TOKEN (the Demo Builder's connection bundle)." });
  let types: string[] = [];
  try {
    types = (await withTimeout(edgeListQueries())).map((q) => q.replace(/^all/, ""));
    add({ id: "edge", label: "Experience Edge for Content Hub", status: types.length ? "ok" : "fail", detail: `${types.length} published types` });
  } catch (e: any) {
    add({ id: "edge", label: "Experience Edge for Content Hub", status: "fail", detail: String(e?.message ?? e).slice(0, 160), fix: "Check EDGE_GRAPHQL_URL and the delivery key EDGE_TOKEN." });
  }
  const counts: Record<string, number> = {};
  if (types.length) {
    const present = WANTED.filter(([t]) => types.includes(t));
    // one aliased query for the counts (first page totals)
    try {
      const q = `{ ${present.map(([t], i) => `t${i}: all${t}(first: 1) { total }`).join(" ")} }`;
      const d = await withTimeout(edgeRequest(q));
      present.forEach(([t], i) => { counts[t] = Number(d?.[`t${i}`]?.total ?? 0); });
    } catch { /* totals are optional */ }
    for (const [t, label] of WANTED) {
      const has = types.includes(t);
      const n = counts[t];
      add({ id: `type-${t}`, label, status: has ? (n === 0 ? "warn" : "ok") : t.startsWith("M_Content_") || t === "BrandSite_Config" || t === "M_PCM_ProductFamily" ? "warn" : "fail", detail: has ? (n != null ? `${n} published` : "published") : "not published to Edge", fix: has ? undefined : `Add ${t.replace(/_/g, ".")} to the Experience Edge publishing settings (or skip the section that uses it).` });
    }
  }
  try {
    const ed = await withTimeout(chGet("/api/entitydefinitions/BrandSite.PortalEvent"));
    add({ id: "rest", label: "Content Hub REST (portal user)", status: "ok", detail: "signed in" });
    add({ id: "usage", label: "Usage events (BrandSite.PortalEvent)", status: ed?.name ? "ok" : "warn", detail: ed?.name ? "definition present" : "definition missing", fix: ed?.name ? undefined : "The Demo Builder's portal step creates BrandSite.PortalEvent; without it TrackUsage stays off." });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    add({ id: "rest", label: "Content Hub REST (portal user)", status: /404/.test(msg) ? "ok" : "fail", detail: /404/.test(msg) ? "signed in" : msg.slice(0, 160), fix: /404/.test(msg) ? undefined : "Check CH_USER / CH_PASS (a dedicated read user with create rights on BrandSite.PortalEvent)." });
    if (/404/.test(msg)) add({ id: "usage", label: "Usage events (BrandSite.PortalEvent)", status: "warn", detail: "definition missing", fix: "The Demo Builder's portal step creates BrandSite.PortalEvent; without it TrackUsage stays off." });
  }

  // 3. data the setup uses
  // the head's partner logins decide the partner items' User (passwords are not passed on)
  let partners: Array<Record<string, string>> = [];
  try { partners = (JSON.parse(process.env.PORTAL_PARTNERS || "[]") as any[]).map((p) => ({ u: String(p?.u ?? ""), k: String(p?.k ?? ""), n: String(p?.n ?? ""), t: String(p?.t ?? ""), r: String(p?.r ?? ""), a: String(p?.a ?? ""), b: String(p?.b ?? "") })); } catch { partners = []; }
  const found = types.length ? await withTimeout(discoverFromEdge((query: string) => edgeRequest(query), { partners }), 30000).catch(() => ({ cropNames: [], partnerKits: [] })) : { cropNames: [], partnerKits: [] };
  // the demo's vertical (PORTAL_MODEL from the Demo Builder): "sports" adds the game, team and partner pages
  const vertical = verticalOf(process.env.PORTAL_MODEL);
  // branding the deployment knows (the Demo Builder sets the demo's name and a hero image)
  let hero: unknown = null;
  try { hero = JSON.parse(process.env.PORTAL_HERO || "null"); } catch { hero = null; }
  const branding = { wordmark: (process.env.PORTAL_WORDMARK || "").trim(), heroAsset: (process.env.PORTAL_HERO_ASSET || "").trim(), hero: hero && typeof hero === "object" ? hero : null };
  // the deployment's theme (PORTAL_THEME from the Demo Builder: {b, c: [hex…], h, t}) → the
  // Portal Settings Theme values the setup writes where they are still empty
  const theme = deployTheme();
  if (theme) add({ id: "theme", label: "Theme from the deployment", status: "ok", detail: `${theme.brand || "PORTAL_THEME"} — accent ${theme.accent}${theme.fontSerif ? `, ${theme.fontSerif}` : ""}${theme.fontSans ? ` / ${theme.fontSans}` : ""}` });
  // automotive: a campaign microsite deployment (PORTAL_SITE_KIND) and the dealers with showrooms (PORTAL_DEALERS)
  const dealers = deploymentDealers().filter((d) => d.showrooms.length).length;
  const siteKind = siteKindNow();
  const joint = jointMicrosites();
  // a joint microsite (served by this deployment) shares the portal's dictionary: the setup skips its own
  // a microsite: its marque (header wordmark and logo) and the marque's cars (model highlights) for the setup's defaults
  const microsite = siteKind === "microsite" && micrositeIdNow() ? await withTimeout(micrositeSetupInfo()).catch(() => null) : null;
  const discovery = { ...found, vertical, branding, theme, siteKind, dealers, joint: !!jointMicrositeOf(currentSite()), microsite };
  if (isEditingHost()) add({ id: "editing-host", label: "Editing host", status: "ok", detail: "pages only for Page builder sessions (anyone else gets a quick 404); one image size per picture" });
  if (joint.length) add({ id: "joint-microsites", label: "Campaign microsites (this deployment)", status: "ok", detail: joint.map((m) => `${m.site} → ${m.host}`).join(", ") });
  if (dealers) add({ id: "dealers", label: "Dealers", status: "ok", detail: `${dealers} with showrooms — the setup adds the dealer locator (/dealers)` });
  if (siteKind === "microsite") {
    const micrositeId = micrositeIdNow();
    const m = micrositeId ? await withTimeout(loadMicrosite()).catch(() => null) : null;
    add({
      id: "microsite", label: "Campaign microsite", status: m ? "ok" : "fail",
      detail: m ? `${m.name} — ${m.phase}${m.revealDate ? `, reveal ${m.revealDate.slice(0, 10)}` : ", no reveal date"}${m.takedown ? `, takedown ${m.takedown.slice(0, 10)}` : ""}` : micrositeId ? `no Microsite record ${micrositeId} on Experience Edge` : "PORTAL_MICROSITE isn't set",
      fix: m ? undefined : "The microsite deployment needs PORTAL_MICROSITE (the Microsite record's identifier) and the industry model on Experience Edge.",
    });
    if (microsite?.brand) add({ id: "microsite-marque", label: "Microsite header and models", status: microsite.models.length ? "ok" : "warn", detail: `${microsite.brand.name}${microsite.logo ? " (with its logo)" : " (no logo on the brand)"} — models: ${microsite.models.map((c) => c.name).join(", ") || "none of the marque's products found"}`, fix: microsite.models.length ? undefined : "Pick the models in the Page builder (Featured models), or give the marque's products in Content Hub the brand." });
    if (!portalUrlNow()) add({ id: "portal-url", label: "Portal address", status: "warn", detail: "PORTAL_PORTAL_URL isn't set — after the takedown the microsite can't send visitors to the portal", fix: "Set PORTAL_PORTAL_URL to the brand portal's origin." });
  }
  // the runtime this deployment runs on (Vercel picks the 24.x patch; a redeploy takes the newest)
  const [maj, min, pat] = process.versions.node.split(".").map(Number);
  // the portal targets Node 24 (Content SDK and the hosts share the major); 24.22.1 fixed the
  // October 2026 security release
  const safeNode = maj === 24 && (min > 22 || (min === 22 && pat >= 1));
  add({ id: "node", label: "Node.js runtime", status: safeNode ? "ok" : "warn", detail: `v${process.versions.node}`, fix: safeNode ? undefined : maj !== 24 ? "Set the project's Node.js version to 24.x and redeploy."
    // Vercel runs its current 24.x patch and a project can't pin one: the fix comes with Vercel's update
    : process.env.VERCEL === "1" ? "Vercel's current Node.js 24.x is older than 24.22.1 (the October 2026 security release). It arrives with Vercel's runtime update; a redeploy then picks it up."
    : "Redeploy to get Node.js 24.22.1 or later (the October 2026 security release)." });
  if (vertical) add({ id: "vertical", label: "Industry model", status: "ok", detail: `${vertical} — the setup adds its pages and components` });
  // brands for the scope picker: Edge ids are the Content Hub identifiers the scope uses
  const brands = types.includes("M_Brand")
    ? await withTimeout(edgeRequest(`{ b: allM_Brand(first: 100) { results { id brandName } } }`)).then((d) => (d?.b?.results ?? []).map((b: any) => ({ identifier: String(b.id), name: typeof b.brandName === "string" ? b.brandName : String(Object.values(b.brandName ?? {})[0] ?? b.id) }))).catch(() => [])
    : [];
  add({ id: "crops", label: "Image crops", status: discovery.cropNames.length ? "ok" : "warn", detail: discovery.cropNames.length ? discovery.cropNames.join(", ") : "none — images use the preview", fix: discovery.cropNames.length ? undefined : "Optional: public links with transformations give the image picker better crops." });
  add({ id: "kits", label: "Partner kits", status: discovery.partnerKits.length ? "ok" : "warn", detail: discovery.partnerKits.length ? discovery.partnerKits.map((k: any) => k.name).join(", ") : "none — the partner hub stays empty", fix: discovery.partnerKits.length ? undefined : "Optional: collections named \"<Partner> partner kit\" become partner profiles." });

  const host = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return NextResponse.json({
    checks,
    discovery,
    brands,
    counts,
    // PORTAL_EDITING_URL: the editing deployment (preview context id) that should serve the Page builder
    suggested: { publicHost: jointMicrositeOf(currentSite())?.host ?? (/localhost/.test(host) ? "" : host), siteMode: env.siteMode, editingUrl: (process.env.PORTAL_EDITING_URL || "").trim().replace(/\/$/, ""), languages: routing.locales.filter((l) => l !== routing.defaultLocale), siteName: currentSite(), jointMicrosites: jointMicrosites().map(({ site, host }) => ({ site, host })) },
  }, { headers: { "Cache-Control": "no-store" } });
}
