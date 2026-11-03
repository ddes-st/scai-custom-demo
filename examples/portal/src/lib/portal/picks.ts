/**
 * The value of a "Portal Picks" datasource's `Picks` field: Content Hub entities an author
 * chose in the Page builder (Marketplace custom field "Content Hub items", or pasted JSON when
 * the app isn't installed). Shared by the picker app (client), the ContentHubItems rendering
 * (server) and the setup script, so it imports nothing.
 *
 *   { "definition": "M_PCM_Product", "items": [ { "id": "<CH entity id>", "name": "<label at pick time>" } ] }
 *
 * `definition` is the Experience Edge type name (Content Hub's dotted name is accepted too). `max`
 * (optional) caps the selection: the "Content Hub image" fields (banner, page hero) carry
 * `{"definition":"M_Asset","max":1,"items":[]}`, which puts the picker in single-image mode.
 * Older values used `kind: "product" | "press"`; they still parse.
 */
export interface Pick { id: string; name: string }
export interface Picks { definition: string; items: Pick[]; max?: number }

export const MAX_PICKS = 24;
const LEGACY_KIND: Record<string, string> = { product: "M_PCM_Product", press: "M_Content_PressRelease", brand: "M_Brand", asset: "M_Asset" };

export const normalizeDefinition = (d: unknown) => String(d ?? "").trim().replace(/\./g, "_");

/** A tolerant parser: a JSON string or an object; malformed items are dropped. */
export function parsePicks(raw: unknown): Picks | null {
  let v: any = raw;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try { v = JSON.parse(s); } catch { return null; }
  }
  if (!v || typeof v !== "object") return null;
  const definition = normalizeDefinition(v.definition) || LEGACY_KIND[String(v.kind ?? "").trim().toLowerCase()] || "";
  if (!definition) return null;
  const seen = new Set<string>();
  const items: Pick[] = [];
  for (const it of Array.isArray(v.items) ? v.items : []) {
    const id = typeof it === "string" ? it.trim() : String(it?.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name: String((typeof it === "object" && it?.name) || "").trim().slice(0, 200) });
    if (items.length >= MAX_PICKS) break;
  }
  const max = Number(v.max);
  return Number.isInteger(max) && max >= 1 && max < MAX_PICKS ? { definition, items: items.slice(0, max), max } : { definition, items };
}

export const serializePicks = (p: Picks): string => JSON.stringify({ definition: p.definition, ...(p.max ? { max: p.max } : {}), items: p.items.map((i) => ({ id: i.id, name: i.name })) });
