/**
 * POST /api/ch-info — the Content Hub info panel's data: for the components of the page open in
 * the Page builder (read by the panel from the Authoring API: rendering names, parameters and the
 * Picks of their datasources) the Content Hub items they show, each with whether Experience Edge
 * publishes it, its lifecycle status, its localized variants per portal language and the Content
 * Hub page that opens it.
 *
 * Reports only what the portal itself publishes: ids Edge doesn't list come back as "not on
 * Edge" without any Content Hub lookup, so the route reveals nothing beyond the public site
 * except lifecycle statuses and Content Hub ids. Not cached.
 *
 * Body: { language, page: { detailKind?, definition? }, components: [{ name, params?, picks? }] }
 */
import { applyRequestSite } from "src/lib/portal/sites";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "src/i18n/routing";
import { cultureFor, DEFAULT_CULTURE, runWithCulture } from "src/lib/ch/culture";
import { cultureMatches } from "src/lib/ch/localized";
import { cardsFor, edgeType, listEntities, localizedVariantIds, profileFor } from "src/lib/ch/entities";
import { loadMedia } from "src/lib/ch/media";
import { loadPress, releaseVariantIds } from "src/lib/ch/press";
import { productVariantIds } from "src/lib/ch/products";
import { entityStatuses } from "src/lib/ch/status";
import { env } from "src/lib/ch/env";
import { parsePicks } from "src/lib/portal/picks";
import { toolsDenied, pickableDefinition } from "src/lib/portal/auth/tools";

export const dynamic = "force-dynamic";

const SHOWN = 12;
/** Definitions whose localized variants are separate entities (see src/lib/ch/localized.ts). */
const LOCALIZED = /^M_(PCM_Product|Content|CMP_Campaign)/;
const KIND_DEFINITION: Record<string, string> = { product: "M_PCM_Product", press: "M_Content_PressRelease", brand: "M_Brand" };

interface Item { id: string; title: string; href: string; onEdge: boolean; status: string; chUrl: string; variants: Record<string, boolean> | null }
interface Group { component: string; label: string; definition: string; total: number | null; items: Item[]; note: string }
interface Component { name: string; params?: Record<string, string>; picks?: string }

const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);
/** Component names as the Page builder shows them (the setup's rendering display names). */
const DISPLAY: Record<string, string> = { BrandGrid: "Brand grid", BrandBook: "Brand book", ProductCatalog: "Product catalog", ProductDetail: "Product detail", PressList: "Press list", PressRelease: "Press release", MediaLibrary: "Media library", ContentHubItems: "Content Hub items", ContentHubList: "Content Hub list", ContentHubDetail: "Content Hub detail", PartnerHub: "Partner hub", PartnerDetail: "Partner detail" };
const shown = (name: string, variant?: string) => `${DISPLAY[name] ?? name}${variant ? ` (${variant})` : ""}`;

export async function POST(request: NextRequest) {
  // one deployment can serve several sites (joint microsites): answer for the one asked (?site=)
  applyRequestSite(request);
  const denied = toolsDenied(request);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  let body: any;
  try { body = JSON.parse((await request.text()).slice(0, 200_000)); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers }); }
  const language = str(body?.language, 20) || routing.defaultLocale;
  const culture = cultureFor(language);
  const components: Component[] = (Array.isArray(body?.components) ? body.components : []).slice(0, 40).map((c: any) => ({
    name: str(c?.name, 80),
    params: Object.fromEntries(Object.entries(c?.params && typeof c.params === "object" ? c.params : {}).slice(0, 20).map(([k, v]) => [str(k, 60), str(v, 300)])),
    picks: typeof c?.picks === "string" ? c.picks.slice(0, 20_000) : undefined,
  }));
  const detailKind = str(body?.page?.detailKind, 40).toLowerCase();
  const pageDefinition = edgeType(str(body?.page?.definition, 80));
  // the portal's other languages (the head's locales), as Content Hub cultures
  const otherCultures = [...new Set(routing.locales.map((l) => cultureFor(l)))].filter((c) => !cultureMatches(c, DEFAULT_CULTURE));

  const labelOf = async (definition: string) => (await profileFor(definition).catch(() => null))?.labelPlural || definition.replace(/_/g, ".");

  const groups: Group[] = await runWithCulture(culture, async () => {
    const out: Group[] = [];
    const list = async (component: string, definition: string, note = "") => {
      if (!pickableDefinition(definition)) return;
      const all = await listEntities(definition).catch(() => []);
      out.push({ component, label: await labelOf(definition), definition, total: all.length, note, items: all.slice(0, SHOWN).map((c) => ({ id: c.id, title: c.title, href: c.href, onEdge: true, status: "", chUrl: "", variants: null })) });
    };
    const detail = async (component: string, definition: string) => {
      const all = definition === "partner" ? [] : await listEntities(definition).catch(() => []);
      out.push({ component, label: definition === "partner" ? "Partner kit" : await labelOf(definition), definition, total: definition === "partner" ? null : all.length, items: [], note: "A detail page: it shows the item named in the URL (the Page builder shows a sample)." });
    };
    for (const c of components) {
      const p = c.params ?? {};
      switch (c.name) {
        case "ContentHubItems": {
          const picks = parsePicks(c.picks ?? "");
          if (!picks || !picks.items.length) { out.push({ component: shown(c.name, p.Variant), label: "Picked items", definition: picks?.definition ?? "", total: 0, items: [], note: "No items picked yet — select the component and open its datasource's Picks field." }); break; }
          const { cards, missing } = await cardsFor(picks.definition, picks.items.map((i) => i.id)).catch(() => ({ cards: [], missing: picks.items.map((i) => i.id) }));
          const byId = new Map(cards.map((x) => [x.id, x]));
          out.push({
            component: shown(c.name, p.Variant), label: `Picked ${(await labelOf(picks.definition)).toLowerCase()}`, definition: picks.definition, total: picks.items.length, note: missing.length ? `${missing.length} picked item${missing.length === 1 ? " is" : "s are"} not on Experience Edge (not approved, not published, or out of the brand scope) — the portal skips ${missing.length === 1 ? "it" : "them"}.` : "",
            items: picks.items.map((i) => { const card = byId.get(i.id); return { id: i.id, title: card?.title || i.name || i.id, href: card?.href ?? "", onEdge: !!card, status: "", chUrl: "", variants: null }; }),
          });
          break;
        }
        case "ContentHubList": if (p.Definition) await list(shown(c.name, p.Variant), edgeType(p.Definition)); break;
        case "ProductCatalog": await list(shown(c.name), "M_PCM_Product"); break;
        case "PressList": {
          // the press component's own loader: masters only, variants overlaid in the page language
          const press = await loadPress().catch(() => null);
          out.push({ component: shown(c.name), label: await labelOf("M_Content_PressRelease"), definition: "M_Content_PressRelease", total: press?.length ?? null, note: press ? "" : "Experience Edge didn't answer.", items: (press ?? []).slice(0, SHOWN).map((r) => ({ id: r.id, title: r.title, href: "", onEdge: true, status: "", chUrl: "", variants: null })) });
          break;
        }
        case "BrandGrid": await list(shown(c.name), "M_Brand"); break;
        case "MediaLibrary": {
          const media = await loadMedia().catch(() => null);
          out.push({ component: shown(c.name), label: "Assets", definition: "M_Asset", total: media?.items.length ?? null, note: media ? `${media.collections.length} collections.` : "Experience Edge didn't answer.", items: (media?.items ?? []).slice(0, SHOWN).map((a) => ({ id: a.id, title: a.title || a.fileName, href: "", onEdge: true, status: "", chUrl: "", variants: null })) });
          break;
        }
        case "ProductDetail": await detail(shown(c.name), "M_PCM_Product"); break;
        case "PressRelease": await detail(shown(c.name), "M_Content_PressRelease"); break;
        case "BrandBook": await detail(shown(c.name), "M_Brand"); break;
        case "ContentHubDetail": await detail(shown(c.name), pageDefinition || KIND_DEFINITION[detailKind] || ""); break;
        case "PartnerDetail": case "PartnerHub": await detail(shown(c.name), "partner"); break;
        default: break;
      }
    }
    return out;
  });

  // statuses and Content Hub links for the items Edge publishes
  const wanted = groups.flatMap((g) => g.items.filter((i) => i.onEdge && g.definition).map((i) => ({ definition: g.definition, id: i.id })));
  const statuses = await entityStatuses(wanted.slice(0, 60));
  for (const g of groups) for (const i of g.items) {
    const s = statuses.get(`${g.definition}|${i.id}`);
    if (s) { i.status = s.status; i.chUrl = s.chUrl; }
  }
  // localized variants per other portal language
  for (const g of groups) {
    if (!LOCALIZED.test(g.definition) || !otherCultures.length) continue;
    // the same variant maps the components use (products and press have their own)
    const variantIds = g.definition === "M_PCM_Product" ? () => productVariantIds() : g.definition === "M_Content_PressRelease" ? () => releaseVariantIds() : () => localizedVariantIds(g.definition);
    const maps = await Promise.all(otherCultures.map((c) => runWithCulture(c, variantIds).catch(() => ({} as Record<string, string>))));
    for (const i of g.items) if (i.onEdge) i.variants = Object.fromEntries(otherCultures.map((c, k) => [c, !!maps[k][i.id]]));
  }

  return NextResponse.json({ language, culture, cultures: otherCultures, chHost: env.chHost ? env.chHost.replace(/^https?:\/\//, "").replace(/\/$/, "") : "", groups }, { headers });
}
