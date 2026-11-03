import "server-only";
import { NextResponse } from "next/server";
import { env } from "../ch/env";
import { getViewer } from "../ch/viewer";
import { findPartner, type PartnerProfile } from "./partners";

/** The partner upload routes' shared guard: only a signed-in partner uploads; staff may read a
 *  partner's list. Uploads need a sign-in mode (hybrid or gated) and PORTAL_UPLOADS. */
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

const off = () => env.siteMode === "public" || !env.uploads;

export async function uploadingPartner(): Promise<PartnerProfile | NextResponse> {
  if (off()) return json({ error: "uploads aren't set up for this portal" }, 404);
  const viewer = await getViewer();
  return viewer.kind === "partner" ? viewer.partner : json({ error: "only a partner can upload" }, 403);
}

/** The partner whose list is read: the signed-in partner, or for staff the one named. */
export async function listedPartner(named: string | null): Promise<PartnerProfile | NextResponse> {
  if (off()) return json({ error: "uploads aren't set up for this portal" }, 404);
  const viewer = await getViewer();
  if (viewer.kind === "partner") return viewer.partner;
  if (viewer.kind === "staff" && named) return (await findPartner(named)) ?? json({ error: "no such partner" }, 404);
  return json({ error: "not allowed" }, 403);
}

export const failed = (e: unknown) => json({ error: String((e as any)?.message ?? e).slice(0, 300) }, 400);
