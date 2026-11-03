/**
 * GET /api/picker/facets?definition=<Edge type>&source=edge|rest — the filters the "Content Hub
 * items" app offers for a definition (src/lib/ch/facets.ts): `edge` = relations Experience Edge
 * publishes plus the assets' file type (fast, 60 s cache); `rest` = Content Hub taxonomies Edge
 * doesn't publish (asset type, status, product category; first call can take a few seconds, then
 * cached 10 minutes). Labels and counts only — no entity data beyond what the picker lists.
 */
import { applyRequestSite } from "src/lib/portal/sites";
import { NextRequest, NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { edgeFacets, restFacets } from "src/lib/ch/facets";
import { normalizeDefinition } from "src/lib/portal/picks";
import { toolsDenied, pickableDefinition } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  const definition = normalizeDefinition(request.nextUrl.searchParams.get("definition"));
  const source = request.nextUrl.searchParams.get("source") === "rest" ? "rest" : "edge";
  if (!definition) return NextResponse.json({ error: "definition is required" }, { status: 400, headers });
  if (!pickableDefinition(definition)) return NextResponse.json({ error: `${definition} can't be picked.` }, { status: 403, headers });
  if (!env.edgeToken) return NextResponse.json({ error: "Experience Edge for Content Hub isn't connected (EDGE_TOKEN)." }, { status: 503, headers });
  try {
    const data = source === "rest" ? await restFacets(definition) : await edgeFacets(definition);
    return NextResponse.json({ definition, source, facets: data.facets }, { headers });
  } catch (e: any) {
    return NextResponse.json({ definition, source, facets: [], error: e?.message || "Content Hub didn't answer" }, { headers });
  }
}
