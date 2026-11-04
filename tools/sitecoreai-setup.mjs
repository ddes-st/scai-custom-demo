/**
 * Portal setup from the command line — the same steps as the Portal setup wizard (/portal-setup),
 * both from examples/portal/src/lib/portal/setup/core.mjs. Creates (idempotently) the templates,
 * renderings, datasources, Portal Settings, page tree, partners, dictionary and language versions,
 * then publishes. Re-running updates fields in place.
 *
 * Auth: the Sitecore CLI's cloud login (.sitecore/user.json → xmCloud.accessToken) and the
 * connected authoring environment (first endpoint with a sitecorecloud.io host).
 *
 *   DOTNET_ROLL_FORWARD=Major dotnet sitecore cloud login && dotnet sitecore cloud environment connect ...
 *   node tools/sitecoreai-setup.mjs [--no-publish]
 *
 * Environment options (all optional):
 *   XMC_ENV                     name of the connected environment to use (.sitecore/user.json), when several are connected
 *   XMC_COLLECTION / XMC_SITE   site collection and site names
 *   MARKETPLACE_APP_ID          this org's Marketplace app id → Source of Picks, ImagePick, HeroImagePick and LogoPick
 *                               (a copied snapshot still has the previous org's id, so Open app is missing until this is set)
 *   PORTAL_PUBLIC_HOST          public hostname of the live site (TargetHostName + https on the site definition)
 *   PORTAL_TRACK_USAGE=1|0      Portal Settings → TrackUsage (left untouched when unset)
 *   PORTAL_BRAND_SCOPE          writes Portal Settings → BrandScope (M.Brand identifiers; untouched when unset).
 *                               Not the runtime fallback: an empty BrandScope still uses the head's PORTAL_BRANDS.
 *   PORTAL_LANGUAGES            extra site languages (default "de-DE"; "" = none); built-in texts for de, fr, es, it, nl,
 *                               pt, sv, nb/no, da, fi, pl, ar (setup/translations.mjs), others start as English copies
 *   PORTAL_DISCOVERY_URL        read crops and partner kits from a deployed head instead
 *                               (https://<head>/api/portal-setup/discovery; PORTAL_TOOLS_KEY when that head sets one)
 *   PORTAL_EDITING_URL          register this deployment as the site's editing host afterwards,
 *   PORTAL_EDITING_HOST         under this rendering host name (default <site>-editing)
 *   PORTAL_HEAD_ENV             the head env file to read Edge credentials and PORTAL_MODEL from (default .env.local)
 *   PORTAL_VERTICAL=sports      add the sports pages without a PORTAL_MODEL at hand
 *   PORTAL_HEAD_URL             the site's portal deployment for Portal Settings → PortalHead (default https://<PORTAL_PUBLIC_HOST>)
 *   PORTAL_SETUP_FORCE=1        run although SetupState says another run is in progress (a run that died
 *                               keeps the lock for 20 minutes)
 *   PORTAL_DISCOVERY=0          skip the Content Hub reads (crops, partner kits) — for a site whose
 *                               tenant isn't the one in examples/portal/.env.local; lookups only add,
 *                               so nothing is removed
 * Crop names and partner kits are read from Experience Edge for Content Hub when EDGE_GRAPHQL_URL
 * and EDGE_TOKEN are in examples/portal/.env.local.
 */
import { readFileSync } from "node:fs";
import { discoverFromEdge, registerRenderingHost, runPortalSetup, verticalOf } from "../examples/portal/src/lib/portal/setup/core.mjs";

const user = JSON.parse(readFileSync(new URL("../.sitecore/user.json", import.meta.url), "utf8"));
const token = user.endpoints?.xmCloud?.accessToken;
const envEntry = Object.entries(user.endpoints ?? {}).filter(([k, v]) => k !== "xmCloud" && /sitecorecloud\.io/.test(v.host ?? "")).find(([k]) => !process.env.XMC_ENV || k === process.env.XMC_ENV);
if (!token || !envEntry) throw new Error("Run `dotnet sitecore cloud login` and `cloud environment connect` first.");
const API = envEntry[1].host.replace(/\/$/, "") + "/sitecore/api/authoring/graphql/v1";

async function gql(query, variables = {}) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) });
  const body = await r.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  return body.data;
}

function headEnv() {
  try {
    return Object.fromEntries(readFileSync(new URL(`../examples/portal/${process.env.PORTAL_HEAD_ENV || ".env.local"}`, import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));
  } catch { return {}; }
}

async function main() {
  console.log(`Authoring API: ${API}`);
  const env = headEnv();
  const edge = async (query) => {
    const r = await fetch(env.EDGE_GRAPHQL_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-GQL-Token": env.EDGE_TOKEN }, body: JSON.stringify({ query }) });
    const body = await r.json();
    if (body.errors?.length) throw new Error(body.errors[0].message);
    return body.data;
  };
  let partners = [];
  try { partners = JSON.parse(env.PORTAL_PARTNERS || process.env.PORTAL_PARTNERS || "[]"); } catch { partners = []; }
  let discovery = {};
  if (process.env.PORTAL_DISCOVERY_URL) {
    const r = await fetch(process.env.PORTAL_DISCOVERY_URL, { headers: process.env.PORTAL_TOOLS_KEY ? { "x-portal-tools-key": process.env.PORTAL_TOOLS_KEY } : {} });
    if (!r.ok) throw new Error(`discovery ${process.env.PORTAL_DISCOVERY_URL} → ${r.status}`);
    discovery = (await r.json()).discovery ?? {};
    console.log(`Discovery from ${new URL(process.env.PORTAL_DISCOVERY_URL).host}: ${discovery.partnerKits?.length ?? 0} partner kits, ${discovery.cropNames?.length ?? 0} crops`);
  } else if (process.env.PORTAL_DISCOVERY !== "0" && env.EDGE_GRAPHQL_URL && env.EDGE_TOKEN) discovery = await discoverFromEdge(edge, { partners });
  // the vertical: from the discovery URL's head, else the head env's PORTAL_MODEL, else PORTAL_VERTICAL
  discovery.vertical = discovery.vertical || verticalOf(env.PORTAL_MODEL || process.env.PORTAL_MODEL) || (process.env.PORTAL_VERTICAL ?? "");
  let hero = null;
  try { hero = JSON.parse(env.PORTAL_HERO || process.env.PORTAL_HERO || "null"); } catch { hero = null; }
  discovery.branding = discovery.branding ?? { wordmark: env.PORTAL_WORDMARK || process.env.PORTAL_WORDMARK || "", heroAsset: env.PORTAL_HERO_ASSET || process.env.PORTAL_HERO_ASSET || "", hero };
  if (discovery.vertical) console.log(`Vertical: ${discovery.vertical}`);
  const summary = await runPortalSetup({
    gql,
    log: (line) => console.log(line),
    discovery,
    options: {
      collection: process.env.XMC_COLLECTION,
      site: process.env.XMC_SITE,
      languages: process.env.PORTAL_LANGUAGES ?? "de-DE",
      force: process.env.PORTAL_SETUP_FORCE === "1",
      // the site's portal deployment (Portal Settings → PortalHead, read by the hub app)
      headUrl: process.env.PORTAL_HEAD_URL || (process.env.PORTAL_PUBLIC_HOST ? `https://${process.env.PORTAL_PUBLIC_HOST.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : ""),
      publish: !process.argv.includes("--no-publish"),
      marketplaceAppId: process.env.MARKETPLACE_APP_ID,
      publicHost: process.env.PORTAL_PUBLIC_HOST,
      trackUsage: process.env.PORTAL_TRACK_USAGE != null ? /^(1|true)$/i.test(process.env.PORTAL_TRACK_USAGE) : undefined,
      brandScope: process.env.PORTAL_BRAND_SCOPE,
    },
  });
  if (process.env.PORTAL_EDITING_URL) {
    console.log("\n[9] rendering host");
    await registerRenderingHost({ gql, log: (line) => console.log(line) }, { name: process.env.PORTAL_EDITING_HOST || `${summary.site}-editing`, url: process.env.PORTAL_EDITING_URL, collection: summary.collection, site: summary.site, useForSite: true });
    if (!process.argv.includes("--no-publish")) await gql(`mutation($i:PublishItemInput!){ publishItem(input:$i){ operationId } }`, { i: { rootItemPath: `${summary.sitePath}/Settings`, languages: summary.languages, publishSubItems: true, publishRelatedItems: false, publishItemMode: "SMART", targetDatabases: ["experienceedge"] } });
  }
}

main().catch((e) => { console.error("\nFAILED:", e.message); process.exit(1); });
