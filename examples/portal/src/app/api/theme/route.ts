/**
 * GET /api/theme — the resolved portal theme (accent, fonts, brand-book layout, every CSS token
 * with its effective value, the authored overrides and where each value came from) plus the
 * token table with defaults. Read by the theme editor app to show the inherited values it
 * previews against, and the deployment's brand theme (its brand preset). No secrets; not cached.
 */
import { applyRequestSite } from "src/lib/portal/sites";
import { NextResponse } from "next/server";
import { getPortalTheme } from "src/lib/portal/theme";
import { THEME_TOKENS } from "src/lib/portal/theme-tokens";
import { deployTheme } from "src/lib/portal/deploy-theme";
import scConfig from "sitecore.config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  const site = applyRequestSite(request);
  try {
    const theme = await getPortalTheme(site);
    return NextResponse.json({ ok: true, site, language: scConfig.defaultLanguage, theme, brandTheme: deployTheme(), tokens: THEME_TOKENS }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e).slice(0, 300), tokens: THEME_TOKENS }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
