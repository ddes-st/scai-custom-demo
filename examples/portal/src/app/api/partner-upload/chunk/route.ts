/** POST /api/partner-upload/chunk?i=<part> — one part of the file (raw body, at most 4 MB), the upload token in X-Upload-Token. */
import { NextRequest, NextResponse } from "next/server";
import { uploadChunk } from "src/lib/ch/partner-uploads";
import { failed, json, uploadingPartner } from "src/lib/portal/upload-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const partner = await uploadingPartner();
  if (partner instanceof NextResponse) return partner;
  try {
    const index = Number(request.nextUrl.searchParams.get("i"));
    await uploadChunk(partner, request.headers.get("x-upload-token") ?? "", index, await request.arrayBuffer());
    return json({ ok: true });
  } catch (e) { return failed(e); }
}
