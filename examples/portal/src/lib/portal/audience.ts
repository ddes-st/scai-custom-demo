/**
 * Who may see a page: the `VisibleTo` field of the page (Droplist: everyone | partners | staff).
 * `partners` means signed-in partners and staff; `staff` means staff only. Client-safe.
 */
export type Audience = "everyone" | "partners" | "staff";
export type ViewerKind = "public" | "staff" | "partner" | "none";

export function audienceOf(value: unknown): Audience {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "staff" ? "staff" : v === "partners" || v === "partner" ? "partners" : "everyone";
}

const RANK: Record<Audience, number> = { everyone: 0, partners: 1, staff: 2 };

/**
 * The stricter of two audiences. A page's VisibleTo is read in the page language AND the default
 * language and the stricter wins, so a language version without the value (field not shared, or
 * a version copied before the value was set) can never open a page the default language closes.
 */
export const strictest = (...audiences: Audience[]): Audience => audiences.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "everyone" as Audience);

export function canView(viewer: ViewerKind, audience: Audience): boolean {
  if (audience === "everyone") return viewer !== "none";
  if (audience === "partners") return viewer === "staff" || viewer === "partner";
  return viewer === "staff";
}
