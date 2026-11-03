import "server-only";
import { loadBrandData } from "../ch/data";
import { getBrandConfig } from "../ch/siteConfig";
import { loadProduct } from "../ch/products";
import { loadRelease } from "../ch/press";
import { env } from "../ch/env";
import { loadEntity, profileFor } from "../ch/entities";
import type { DetailKind } from "./sections";
import { getViewer } from "../ch/viewer";
import { findPartner } from "./partners";
import { loadGame, loadPlayer } from "../ch/sports";
import { loadProgram } from "../ch/university";

export type DetailState = { status: "ok"; title: string; description?: string; image?: string } | { status: "missing" } | { status: "error"; message: string };

const EDGE_ERROR = "Experience Edge didn't answer — reload the page in a moment.";

/**
 * Resolves the Content Hub item behind a wildcard detail page once, up front, so the page can
 * answer a real 404 for unknown ids (the loaders are cached 60 s — the component's own call
 * hits the same cache entry). Hidden brands are "missing"; coming-soon brands are "ok".
 */
export async function resolveDetail(kind: DetailKind | string, slug: string): Promise<DetailState> {
  if (!slug) return { status: "missing" };
  try {
    if (kind === "partner") {
      // staff see every partner; a partner only its own page (another partner's is "missing")
      const viewer = await getViewer();
      const partner = await findPartner(slug);
      if (!partner) return { status: "missing" };
      if (viewer.kind === "staff" || (viewer.kind === "partner" && viewer.partner.user === partner.user)) return { status: "ok", title: partner.name, description: partner.about || undefined };
      return { status: "missing" };
    }
    if (kind === "program") {
      if (!env.edgeToken) return { status: "error", message: "This section reads Experience Edge, which isn't connected for this portal." };
      const p = await loadProgram(slug);
      return p ? { status: "ok", title: p.name, description: p.summary || [p.level, p.college?.name].filter(Boolean).join(" · ") || undefined, image: p.image || undefined } : { status: "missing" };
    }
    if (kind === "game" || kind === "player") {
      if (!env.edgeToken) return { status: "error", message: "This section reads Experience Edge, which isn't connected for this portal." };
      if (kind === "game") {
        const g = await loadGame(slug);
        return g ? { status: "ok", title: g.title, description: [g.finalScore, g.result].filter(Boolean).join(" · ") || undefined, image: g.image?.preview || undefined } : { status: "missing" };
      }
      const p = await loadPlayer(slug);
      return p ? { status: "ok", title: p.number != null ? `#${p.number} ${p.name}` : p.name, description: [p.position, p.nationality].filter(Boolean).join(" · ") || undefined, image: p.headshot?.preview || undefined } : { status: "missing" };
    }
    if (kind !== "brand" && kind !== "product" && kind !== "press") {
      // a generic detail page: `kind` is the Content Hub definition (Edge type)
      if (!env.edgeToken) return { status: "error", message: "This section reads Experience Edge, which isn't connected for this portal." };
      if (!(await profileFor(kind))) return { status: "missing" };
      const e = await loadEntity(kind, slug);
      return e ? { status: "ok", title: e.title, description: e.summary || undefined, image: e.image || undefined } : { status: "missing" };
    }
    if (kind === "brand") {
      const data = await loadBrandData(slug);
      if (!data) return { status: "missing" };
      const config = await getBrandConfig(data.brandId);
      if (config.brand.visibility === "hidden") return { status: "missing" };
      return { status: "ok", title: data.brandName };
    }
    if (!env.edgeToken) return { status: "error", message: "This section reads Experience Edge, which isn't connected for this portal." };
    if (kind === "product") {
      const p = await loadProduct(slug);
      return p ? { status: "ok", title: p.name, description: p.summary || undefined, image: p.images[0]?.preview || undefined } : { status: "missing" };
    }
    const r = await loadRelease(slug);
    return r ? { status: "ok", title: r.title, description: r.lead || undefined, image: r.image || undefined } : { status: "missing" };
  } catch (e: any) {
    console.warn(`portal detail (${kind}) load failed:`, e?.message ?? e);
    return { status: "error", message: EDGE_ERROR };
  }
}

export function detailKindOf(value: string): DetailKind | null {
  const v = value.trim().toLowerCase();
  return v === "brand" || v === "product" || v === "press" || v === "partner" || v === "game" || v === "player" || v === "program" ? v : null;
}

/** What a wildcard page renders: a fixed kind (DetailKind) or a Content Hub definition
 *  (Definition, Edge type or dotted name) for the generic detail page. */
export function detailSpecOf(fields: Record<string, unknown> | undefined): DetailKind | string | null {
  const get = (n: string) => { const f = fields?.[n] as { value?: unknown } | undefined; return typeof f?.value === "string" ? f.value.trim() : ""; };
  return detailKindOf(get("DetailKind")) ?? (get("Definition") ? get("Definition").replace(/\./g, "_") : null);
}
