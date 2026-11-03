/**
 * POST|GET /api/revalidate?secret=<REVALIDATE_SECRET>[&definition=M.PCM.Product][&scope=ch|xmc|all]
 *
 * Drops the head's Content Hub caches so a change shows within seconds instead of the 60 s
 * cache window. Meant for a Content Hub API-call action (Manage → Actions, type API call,
 * POST this URL, custom header x-revalidate-secret) fired by a trigger on entity creation /
 * modification / approval. The definition comes from the `definition` query parameter, else
 * from Content Hub's default request headers (`target_definition`, `target_id`, `event` — sent
 * with every API-call action), else from the JSON body (`saveEntityMessage.TargetDefinition`,
 * `TargetDefinition`, `EntityDefinition`, `definition`); without one, every Content Hub cache
 * is dropped. `scope=xmc` drops the SitecoreAI caches (settings, pages, profiles) instead;
 * `scope=all` both.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { chTagsFor, XMC_TAGS } from "src/lib/portal/revalidate-tags";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

const findDefinition = (v: unknown, depth = 0): string => {
  if (!v || typeof v !== "object" || depth > 4) return "";
  const o = v as Record<string, unknown>;
  for (const k of ["TargetDefinition", "EntityDefinition", "definition", "Definition"]) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  for (const val of Object.values(o)) { const d = findDefinition(val, depth + 1); if (d) return d; }
  return "";
};

async function handle(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET || "";
  const headers = { "Cache-Control": "no-store" };
  if (!expected) return NextResponse.json({ error: "REVALIDATE_SECRET is not configured on this deployment." }, { status: 503, headers });
  const given = request.nextUrl.searchParams.get("secret") || request.headers.get("x-revalidate-secret") || "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Invalid secret." }, { status: 401, headers });

  let body: unknown = null;
  if (request.method === "POST") { try { body = JSON.parse(await request.text()); } catch { body = null; } }
  const scope = (request.nextUrl.searchParams.get("scope") || "ch").toLowerCase();
  const definition = (request.nextUrl.searchParams.get("definition") || request.headers.get("target_definition") || findDefinition(body)).trim();
  const event = request.headers.get("event") || "";

  const tags = new Set<string>();
  if (scope === "ch" || scope === "all") {
    for (const t of chTagsFor(definition)) tags.add(t);
  }
  if (scope === "xmc" || scope === "all") for (const t of XMC_TAGS) tags.add(t);
  // expire now: the next view fetches fresh data ("max" would serve the stale entry once more)
  for (const t of tags) revalidateTag(t, { expire: 0 });
  const id = request.headers.get("target_id") || findId(body);
  console.log(`revalidate: definition=${definition || "(any)"} id=${id || "-"} event=${event || "-"} tags=${[...tags].join(",")}`);
  return NextResponse.json({ ok: true, definition: definition || null, id: id || null, event: event || null, revalidated: [...tags] }, { headers });
}

const findId = (v: unknown): string => {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  for (const k of ["TargetId", "EntityId", "id", "Id"]) if (o[k] != null && typeof o[k] !== "object") return String(o[k]);
  for (const val of Object.values(o)) { const d = findId(val); if (d) return d; }
  return "";
};

export const POST = handle;
export const GET = handle;
