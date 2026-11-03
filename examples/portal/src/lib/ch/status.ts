import "server-only";
import { unstable_cache } from "next/cache";
import { env } from "./env";
import { chGet, mapPool, resolveIdentifier } from "./rest";

/**
 * Content Hub facts about entities the portal shows (Content Hub info panel): the numeric id,
 * the approval status (assets: FinalLifeCycleStatusToAsset → Approved/UnderReview/…, content:
 * ContentLifeCycleToContent → Final/InProgress/…, products: PCMProductStatusToProduct →
 * Approved/…, others: the first status or lifecycle relation that has a value) and the Content
 * Hub page that opens it. REST, cached 60 s per entity, tag "ch".
 * Only ever called for ids the portal already shows from Experience Edge.
 */
export interface EntityStatus { chId: number | null; status: string; chUrl: string }

const statusNames = new Map<number, string>();

async function statusName(id: number): Promise<string> {
  const hit = statusNames.get(id);
  if (hit) return hit;
  const e = await chGet(`/api/entities/${id}`);
  // M.Final.LifeCycle.Status.Approved → Approved, M.ContentLifeCycle.Final → Final
  const name = String(e?.identifier ?? "").split(".").pop() || String(e?.properties?.StatusValue ?? e?.properties?.ValueName ?? id);
  statusNames.set(id, name);
  return name;
}

/** The relations that carry an entity's approval, most telling first. */
const PREFERRED = ["FinalLifeCycleStatusToAsset", "ContentLifeCycleToContent", "PCMProductStatusToProduct", "PCMProductFamilyStatusToProductFamily", "StatusToCampaign", "FinalLifeCycleStatusToContent"];
/** Status relations that say nothing about approval. */
const SKIP = /^(Draft|Publication|Deliverables|BlockReview|StateUser)/i;

const hrefId = (href: unknown) => { const m = /\/api\/entities\/(\d+)(?:$|[/?#])/.exec(String(href ?? "")); return m ? Number(m[1]) : null; };

/** The Content Hub UI page of an entity (the admin entity page for definitions without their own). */
export function chUrlOf(definition: string, chId: number | null): string {
  if (!env.chHost || chId == null) return "";
  const host = env.chHost.replace(/\/$/, "");
  const d = definition.replace(/\./g, "_");
  if (d === "M_Asset") return `${host}/en-us/asset/${chId}`;
  if (d === "M_Collection") return `${host}/en-us/collection/${chId}`;
  if (d === "M_CMP_Campaign") return `${host}/en-us/campaigns/detail/${chId}`;
  if (d.startsWith("M_Content")) return `${host}/en-us/content/detail/${chId}`;
  return `${host}/en-us/admin/entitymgmt/entity/${chId}`;
}

async function statusUncached(definition: string, id: string): Promise<EntityStatus> {
  // Edge ids are Content Hub identifiers; brand cards carry the numeric id already
  const chId = /^\d+$/.test(id) ? Number(id) : await resolveIdentifier(id);
  if (chId == null) return { chId: null, status: "", chUrl: "" };
  let status = "";
  try {
    const e = await chGet(`/api/entities/${chId}`);
    const names = Object.keys(e?.relations ?? {});
    const candidates = [...PREFERRED.filter((n) => names.includes(n)), ...names.filter((n) => !PREFERRED.includes(n) && /(LifeCycle|Status)/i.test(n) && !SKIP.test(n))].slice(0, 3);
    for (const rel of candidates) {
      const r = await chGet(`/api/entities/${chId}/relations/${rel}`);
      const parent = hrefId(r?.parent?.href ?? r?.parents?.[0]?.href);
      if (parent != null) { status = await statusName(parent); break; }
    }
  } catch { /* status is optional */ }
  return { chId, status, chUrl: chUrlOf(definition, chId) };
}

const statusCached = (definition: string, id: string) =>
  unstable_cache(() => statusUncached(definition, id), ["ch-status", definition, id], { revalidate: 60, tags: ["ch", "ch:ch-entity"] })();

/** Statuses for many entities, five at a time (rest.ts caps the calls in flight); unknown ones come back empty. */
export async function entityStatuses(items: Array<{ definition: string; id: string }>): Promise<Map<string, EntityStatus>> {
  const out = new Map<string, EntityStatus>();
  if (!env.chHost || !env.chUser) return out;
  const results = await mapPool(items, 5, (it) => statusCached(it.definition, it.id).catch(() => ({ chId: null, status: "", chUrl: "" })));
  items.forEach((it, i) => out.set(`${it.definition}|${it.id}`, results[i]));
  return out;
}
