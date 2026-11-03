/**
 * GET /api/picker/definitions — the Content Hub definitions an author may pick in the
 * "Content Hub items" app: every type Experience Edge lists, minus system types, with the
 * labels from the entity profiles (built-in, SitecoreAI items, or derived from the schema).
 */
import { applyRequestSite } from "src/lib/portal/sites";
import { NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { pickableProfiles } from "src/lib/ch/entities";
import { toolsDenied, pickableDefinition } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  if (!env.edgeToken) return NextResponse.json({ error: "Experience Edge for Content Hub isn't connected (EDGE_TOKEN)." }, { status: 503, headers });
  try {
    const profiles = await pickableProfiles();
    // the Content Hub tenant the picker reads (shown in its header; one portal = one tenant)
    let chHost = "";
    try { chHost = env.chHost; } catch { chHost = ""; }
    return NextResponse.json({ chHost, definitions: profiles.filter((p) => pickableDefinition(p.definition)).map((p) => ({ definition: p.definition, label: p.label, labelPlural: p.labelPlural, detailPath: p.detailPath, source: p.source })) }, { headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Content Hub didn't answer" }, { status: 502, headers });
  }
}
