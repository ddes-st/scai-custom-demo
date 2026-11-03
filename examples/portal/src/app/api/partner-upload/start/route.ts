/** POST /api/partner-upload/start {name, size} — a signed-in partner starts an upload (src/lib/ch/partner-uploads.ts). */
import { NextRequest, NextResponse } from "next/server";
import { startUpload } from "src/lib/ch/partner-uploads";
import { failed, json, uploadingPartner } from "src/lib/portal/upload-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const partner = await uploadingPartner();
  if (partner instanceof NextResponse) return partner;
  try {
    const body = await request.json();
    return json(await startUpload(partner, { name: String(body?.name ?? ""), size: Number(body?.size) }));
  } catch (e) { return failed(e); }
}
