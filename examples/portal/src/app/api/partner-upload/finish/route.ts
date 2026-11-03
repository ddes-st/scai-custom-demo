/** POST /api/partner-upload/finish {token, title?, note?} — the asset under review and its review job. */
import { NextRequest, NextResponse } from "next/server";
import { finishUpload } from "src/lib/ch/partner-uploads";
import { failed, json, uploadingPartner } from "src/lib/portal/upload-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const partner = await uploadingPartner();
  if (partner instanceof NextResponse) return partner;
  try {
    const body = await request.json();
    return json(await finishUpload(partner, String(body?.token ?? ""), { title: body?.title, note: body?.note }));
  } catch (e) { return failed(e); }
}
