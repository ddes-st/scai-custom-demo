/**
 * GET /api/portal-setup/published?path=/sitecore/content/<collection>/<site>/Settings/Portal Settings
 * — whether this deployment's Experience Edge (its context id) serves that item, i.e. whether the
 * site has been published. Content items only; Edge content is public anyway. Not cached.
 */
import { NextRequest, NextResponse } from "next/server";
import { xmcQuery } from "src/lib/portal/xmc-graphql";
import { toolsDenied } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = toolsDenied(request);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  const path = (request.nextUrl.searchParams.get("path") || "").trim();
  if (!/^\/sitecore\/content\/[\w -]{1,100}(\/[\w -]{1,100}){1,6}$/.test(path)) return NextResponse.json({ error: "A /sitecore/content/… item path is required." }, { status: 400, headers });
  try {
    const d = await xmcQuery<{ item?: { id?: string } | null }>(`query($p:String!){ item(path:$p, language:"en"){ id } }`, { p: path });
    return NextResponse.json({ path, published: !!d?.item?.id }, { headers });
  } catch (e: any) {
    return NextResponse.json({ path, published: null, error: String(e?.message ?? e).slice(0, 200) }, { headers });
  }
}
