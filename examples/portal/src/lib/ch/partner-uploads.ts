/**
 * Partner uploads: a signed-in partner drops files on its partner area; each becomes an asset
 * under review in Content Hub (linked to the partner's Partner record and focus brand) plus a
 * review job — the "Submit Asset(s)" creative request, at its Review step with the partner's
 * Partner Manager as approver (PORTAL_UPLOADS, which the demo builder reads off the tenant).
 * When the manager approves (the job's lifecycle turns Approved — or, on a tenant without the
 * flow, the asset's), the next read of the partner's uploads approves the file and shares it
 * with the partner (PartnerToAsset), so it joins the partner's files.
 *
 * Ported from the Demo Builder's Vercel portal (brand-portal/lib/partnerUploads.ts).
 * Vercel takes at most 4.5 MB per request and Content Hub's upload URL refuses other origins,
 * so the browser sends the file here in chunks of 4 MB, each forwarded to Content Hub's signed
 * upload URL (chunked upload, Upload API v2). The upload session travels in a token signed with
 * AUTH_SECRET and bound to the partner — no state between serverless calls.
 */
import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { chGet, chSend, mapPool, resolveIdentifier } from "./rest";
import type { PartnerProfile as PortalPartner } from "../portal/partners";

export const CHUNK_BYTES = 4 * 1024 * 1024;
const TOKEN_TTL_MS = 20 * 60 * 1000;
/** Never accepted (Content Hub refuses them too). */
const BLOCKED = /\.(exe|bat|com|cmd|msi|pdb|vb|vbs|ws|wsf|scf|scr|pif|jar|reg|ps1|js|sh|dll)$/i;

interface UploadToken { u: string; l: string; i: unknown; n: number; s: number; f: string; x: number }

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sig = (payload: string) => createHmac("sha256", env.authSecret).update(payload).digest("base64url");

function signToken(t: UploadToken): string {
  const payload = b64(JSON.stringify(t));
  return `${payload}.${sig(payload)}`;
}

/** The token's session, when it is valid, unexpired and this partner's. */
function readToken(token: string, partner: PortalPartner): UploadToken | null {
  const [payload, s] = String(token ?? "").split(".");
  if (!payload || !s || !env.authSecret) return null;
  const want = Buffer.from(sig(payload)), got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString()) as UploadToken;
    return t.u === partner.user && t.x > Date.now() ? t : null;
  } catch {
    return null;
  }
}

const href = (id: number) => ({ href: `${env.chHost}/api/entities/${id}` });
/** The body keys that take a list. */
const many = (side: string) => side === "parents" || side === "children";
const idOf = (h: unknown) => Number(/\/entities\/(\d+)/.exec(String((h as any)?.href ?? h ?? ""))?.[1] ?? NaN);
const relIds = (d: any): number[] => [...(d?.children ?? []), ...(d?.parents ?? []), d?.child, d?.parent].map(idOf).filter(Number.isFinite);
const pathOf = (location: string) => (location.startsWith("http") ? location.slice(new URL(location).origin.length) : location);

async function partnerIds(partner: PortalPartner): Promise<{ id: number; brand: number | null; manager: number | null }> {
  if (!partner.entity) throw new Error("this partner has no Partner record yet — the demo builder adds it on its next deploy");
  const id = await resolveIdentifier(partner.entity);
  if (!id) throw new Error("the partner's record wasn't found in Content Hub");
  const [b, m] = await Promise.all([
    chGet(`/api/entities/${id}/relations/BrandToPartner`).catch(() => null),
    chGet(`/api/entities/${id}/relations/UserToPartnerManager`).catch(() => null),
  ]);
  return { id, brand: relIds(b)[0] ?? null, manager: relIds(m)[0] ?? null };
}

/** One relation's writes at a time in this instance (keyed by entity and relation — the
 *  partner's PartnerToUpload / PartnerToAsset), so two finishing uploads don't overwrite each other. */
const chains = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  chains.set(key, tail);
  void tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
  return run;
}

/**
 * Merge ids into a relation (the given side), keeping what's there. Content Hub only takes the
 * whole list, so the relation is read right before the PUT (a failed read throws — writing only
 * the new ids would drop the rest), and read again after it: another instance writing in between
 * may have dropped ours, which are then merged in once more.
 */
async function addTo(entityId: number, relation: string, side: "children" | "parents", ids: number[]): Promise<void> {
  const path = `/api/entities/${entityId}/relations/${relation}`;
  return serialized(`${entityId}:${relation}`, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const have = relIds(await chGet(path));
      const all = [...new Set([...have, ...ids])];
      if (all.length === have.length) return;
      const r = await chSend("PUT", path, { [side]: all.map(href) });
      if (r.status >= 400) throw new Error(`${relation} → ${r.status}`);
      const after = new Set(relIds(await chGet(path)));
      if (ids.every((id) => after.has(id))) return;
    }
    throw new Error(`${relation}: changed by someone else on every try`);
  });
}

/** Start an upload: Content Hub's upload session, as a token for this partner. */
export async function startUpload(partner: PortalPartner, file: { name: string; size: number }): Promise<{ token: string; chunks: number; chunkSize: number }> {
  const cfg = env.uploads;
  if (!cfg) throw new Error("uploads aren't set up for this portal");
  const name = String(file.name ?? "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180);
  const size = Math.round(Number(file.size));
  if (!name || !(size > 0)) throw new Error("an empty file can't be uploaded");
  if (BLOCKED.test(name)) throw new Error("this kind of file can't be uploaded");
  if (size > cfg.maxMb * 1024 * 1024) throw new Error(`files up to ${cfg.maxMb} MB can be uploaded`);
  const r = await chSend("POST", "/api/v2.0/upload", { file_name: name, file_size: size, upload_configuration: { name: "AssetUploadConfiguration" }, action: { name: "NewAsset" } });
  if (r.status >= 400 || !r.location) throw new Error(`Content Hub didn't start the upload (${r.status})`);
  const chunks = Math.max(1, Math.ceil(size / CHUNK_BYTES));
  return { token: signToken({ u: partner.user, l: pathOf(r.location), i: r.data, n: chunks, s: size, f: name, x: Date.now() + TOKEN_TTL_MS }), chunks, chunkSize: CHUNK_BYTES };
}

/** One chunk (index 0…n-1) on to Content Hub's signed upload URL. */
export async function uploadChunk(partner: PortalPartner, token: string, index: number, bytes: ArrayBuffer): Promise<void> {
  const t = readToken(token, partner);
  if (!t) throw new Error("the upload expired — try again");
  if (!(index >= 0 && index < t.n) || bytes.byteLength > CHUNK_BYTES || bytes.byteLength === 0) throw new Error("that part of the file doesn't fit the upload");
  const form = new FormData();
  form.append("file", new Blob([bytes]), t.f);
  const r = await chSend("POST", t.n > 1 ? `${t.l}&chunks=${t.n}&chunk=${index}` : t.l, form);
  if (r.status >= 400) throw new Error(`Content Hub refused part ${index + 1} (${r.status})`);
}

/**
 * The upload done: the asset (titled, under review, on the partner's brand and record) and —
 * when the tenant has the Business Review flow — its review job at the Review step for the
 * Partner Manager. Returns the asset and the job.
 */
export async function finishUpload(partner: PortalPartner, token: string, info: { title?: string; note?: string }): Promise<{ assetId: number; jobId: number | null }> {
  const cfg = env.uploads;
  const t = readToken(token, partner);
  if (!cfg || !t) throw new Error("the upload expired — try again");
  if (t.n > 1) {
    const done = await chSend("POST", `${t.l}&chunks=${t.n}`, new FormData());
    if (done.status >= 400) throw new Error(`Content Hub didn't complete the upload (${done.status})`);
  }
  const fin = await chSend("POST", "/api/v2.0/upload/finalize", t.i);
  const assetId = Number(fin.data?.asset_id ?? fin.data?.assetId);
  if (fin.status >= 400 || !Number.isFinite(assetId)) throw new Error(`Content Hub didn't create the asset (${fin.status})`);
  const who = await partnerIds(partner);
  const title = String(info.title ?? "").trim().slice(0, 200) || t.f.replace(/\.[^.]+$/, "");
  const note = String(info.note ?? "").trim().slice(0, 1000);
  const description = `Uploaded by ${partner.name} on the partner portal${note ? `: ${note}` : "."}`;

  // the asset: its title and description (merged into what the upload wrote), under review,
  // on the partner's brand, on the partner's record as an upload
  const cur = await chGet(`/api/entities/${assetId}`);
  const props = { ...(cur?.properties ?? {}), Title: title, Description: { "en-US": description } };
  const put = await chSend("PUT", `/api/entities/${assetId}`, {
    identifier: cur?.identifier, cultures: cur?.cultures, entitydefinition: cur?.entitydefinition, is_root_taxonomy_item: cur?.is_root_taxonomy_item, properties: props,
  });
  if (put.status >= 400) throw new Error(`naming the file → ${put.status}`);
  const review = await resolveIdentifier(cfg.flc.underReview);
  if (review) await chSend("PUT", `/api/entities/${assetId}/relations/FinalLifeCycleStatusToAsset`, { parents: [href(review)] });
  if (who.brand) await addTo(assetId, "PCMBrandToAsset", "parents", [who.brand]).catch(() => undefined);
  await addTo(who.id, "PartnerToUpload", "children", [assetId]);

  // the review job, at its Review step, for the Partner Manager
  // (a failure leaves the file under review; reading the uploads makes the job then)
  let jobId: number | null = null;
  const j = cfg.job;
  if (j && who.manager) jobId = await createReviewJob(j, cfg, partner, who, assetId, title, description).catch(() => null);
  return { assetId, jobId };
}

async function createReviewJob(
  j: NonNullable<NonNullable<typeof env.uploads>["job"]>, cfg: NonNullable<typeof env.uploads>, partner: PortalPartner,
  who: { brand: number | null; manager: number | null }, assetId: number, title: string, description: string,
): Promise<number> {
  const [jobType, notTemplate, created, machine, reviewState, underReview] = await Promise.all([
    resolveIdentifier(j.jobType), j.notTemplate ? resolveIdentifier(j.notTemplate) : Promise.resolve(null), resolveIdentifier(cfg.flc.created),
    resolveIdentifier(j.machine), resolveIdentifier(j.reviewState), resolveIdentifier(cfg.flc.underReview),
  ]);
  const routes = (await Promise.all(j.reviewRoutes.map((r) => resolveIdentifier(r)))).filter((x): x is number => !!x);
  if (!jobType || !machine || !reviewState) throw new Error("the review flow isn't on this tenant any more");
  const rel = (name: string, ids: Array<number | null | undefined>) => {
    const side = j.sides[name];
    const clean = ids.filter((x): x is number => !!x);
    if (!side || !clean.length) return null;
    return [name, many(side) ? { [side]: clean.map(href) } : { [side]: href(clean[0]) }] as const;
  };
  const relations = Object.fromEntries([
    rel("BlockTypeToBlock", [jobType]), rel("IsTemplateToMProjectBlock", [notTemplate]), rel("FinalLifeCycleStatusToBlock", [created]),
    rel("MProjectBlockToStateMachine", [machine]), rel("BrandToProject", [who.brand]),
    rel("UserToProjectRequestor", [who.manager]), rel("UserToProjectPointOfContact", [who.manager]),
    rel("UserToCRUploader", [who.manager]), rel("UserToCRApprover", [who.manager]), rel("BlockToAssetDeliverables", [assetId]),
  ].filter((x): x is NonNullable<typeof x> => !!x));
  const properties: Record<string, unknown> = {
    BlockName: `Partner upload: ${title} — ${partner.name}`.slice(0, 200), BlockDescription: description, BlockIdentifier: randomUUID(),
    IsRoot: true, CalculationEnabled: true, IsTemplate: false, ...(j.requestType ? { "CR.RequestType": j.requestType } : {}),
  };
  const res = await chSend("POST", "/api/entities", {
    entitydefinition: { href: `${env.chHost}/api/entitydefinitions/${j.ed}` },
    identifier: `db.${cfg.demo}.partnerupload.${partner.user}.${assetId}`,
    properties: Object.fromEntries(Object.entries(properties).filter(([k]) => j.props.includes(k))), relations,
  });
  const jobId = idOf(res.location) || Number(res.data?.id);
  if (res.status >= 400 || !Number.isFinite(jobId)) throw new Error(`creating the review job → ${res.status}: ${JSON.stringify(res.data ?? "").slice(0, 160)}`);
  // straight to Review: the active step REPLACED (never merged), its routes and the lifecycle with it
  const side = (name: string, ids: number[]) => ({ [j.sides[name] ?? "children"]: many(j.sides[name] ?? "children") ? ids.map(href) : href(ids[0]) });
  await chSend("PUT", `/api/entities/${jobId}/relations/${j.activeState}`, side(j.activeState, [reviewState]));
  if (j.availableRoute && routes.length) await chSend("PUT", `/api/entities/${jobId}/relations/${j.availableRoute}`, side(j.availableRoute, routes));
  if (underReview && j.sides.FinalLifeCycleStatusToBlock) await chSend("PUT", `/api/entities/${jobId}/relations/FinalLifeCycleStatusToBlock`, side("FinalLifeCycleStatusToBlock", [underReview]));
  return jobId;
}

export interface PartnerUpload {
  assetId: number;
  title: string;
  fileName: string;
  uploadedOn: string;
  status: "review" | "changes" | "approved";
}

/**
 * The partner's uploads, newest first, each with its review status. An upload whose job (or,
 * without a job, whose asset) was approved is approved and shared with the partner here — the
 * step that makes it one of the partner's files.
 */
export async function listUploads(partner: PortalPartner): Promise<PartnerUpload[]> {
  const cfg = env.uploads;
  if (!cfg) return [];
  const who = await partnerIds(partner);
  const ids = relIds(await chGet(`/api/entities/${who.id}/relations/PartnerToUpload`).catch(() => null)).slice(-60);
  const [approved, reviewState] = await Promise.all([resolveIdentifier(cfg.flc.approved), cfg.job ? resolveIdentifier(cfg.job.reviewState) : Promise.resolve(null)]);
  const shared = new Set(relIds(await chGet(`/api/entities/${who.id}/relations/PartnerToAsset`).catch(() => null)));
  // approved uploads to share with the partner: one merged write after the loop, not one per file
  const toShare: number[] = [];
  const out = await mapPool(ids, 4, async (id): Promise<PartnerUpload | null> => {
    const a = await chGet(`/api/entities/${id}`).catch(() => null);
    if (!a) return null;
    const p = a.properties ?? {};
    const assetApproved = relIds(await chGet(`/api/entities/${id}/relations/FinalLifeCycleStatusToAsset`).catch(() => null)).includes(approved ?? -1);
    let status: PartnerUpload["status"] = assetApproved ? "approved" : "review";
    let jobId: number | null | undefined = cfg.job ? relIds(await chGet(`/api/entities/${id}/relations/BlockToAssetDeliverables`).catch(() => null))[0] : undefined;
    // an upload whose job didn't get made (an error at the time): made now
    if (cfg.job && !jobId && !assetApproved && who.manager) {
      const title = typeof p.Title === "string" ? p.Title : String(p.FileName ?? id);
      jobId = await createReviewJob(cfg.job, cfg, partner, who, id, title, `Uploaded by ${partner.name} on the partner portal.`).catch(() => null);
    }
    if (jobId && !assetApproved) {
      const [lc, st] = await Promise.all([
        chGet(`/api/entities/${jobId}/relations/FinalLifeCycleStatusToBlock`).catch(() => null),
        chGet(`/api/entities/${jobId}/relations/${cfg.job!.activeState}`).catch(() => null),
      ]);
      if (relIds(lc).includes(approved ?? -1)) status = "approved";
      else if (reviewState && relIds(st).length && !relIds(st).includes(reviewState)) status = "changes";
    }
    if (status === "approved" && approved) {
      if (!assetApproved) await chSend("PUT", `/api/entities/${id}/relations/FinalLifeCycleStatusToAsset`, { parents: [href(approved)] }).catch(() => undefined);
      if (!shared.has(id)) toShare.push(id);
    }
    return {
      assetId: id,
      title: typeof p.Title === "string" ? p.Title : String(p.FileName ?? id),
      fileName: String(p.FileName ?? ""),
      uploadedOn: String(a.created_on ?? ""),
      status,
    };
  });
  if (toShare.length) await addTo(who.id, "PartnerToAsset", "children", toShare).catch((e: any) => console.warn("partner uploads: sharing approved files failed:", e?.message ?? e));
  return out.filter((x): x is PartnerUpload => !!x).sort((x, y) => y.uploadedOn.localeCompare(x.uploadedOn));
}
