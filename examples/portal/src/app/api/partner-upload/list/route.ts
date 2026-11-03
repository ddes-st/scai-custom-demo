/** GET /api/partner-upload/list[?partner=<login>] — the partner's uploads with their review status (staff name the partner). */
import { NextRequest, NextResponse } from "next/server";
import { env } from "src/lib/ch/env";
import { listUploads } from "src/lib/ch/partner-uploads";
import { failed, json, listedPartner } from "src/lib/portal/upload-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const partner = await listedPartner(request.nextUrl.searchParams.get("partner"));
  if (partner instanceof NextResponse) return partner;
  try { return json({ uploads: await listUploads(partner), maxMb: env.uploads?.maxMb ?? 0 }); }
  catch (e) { return failed(e); }
}
