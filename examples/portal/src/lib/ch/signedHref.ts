import "server-only";
/**
 * Gated mode's source for file bytes: SHORT-LIVED SIGNED DELIVERY URLS.
 *
 * Content Hub's REST response for an asset carries pre-authenticated rendition hrefs
 * (renditions.downloadOriginal[0].href) served by the delivery CDN with an `expires` timestamp
 * and an enforced signature (verified live: anonymous fetch 200, tampered signature 403,
 * validity ~8h, CORS *). Leaked URLs die on their own — the property public links lack.
 *
 * Two cache levels keep the REST calls to about one per file and rendition every 6 hours,
 * however many Vercel instances run:
 *  - Next's Data Cache (shared by every instance), keyed by the 6-hour window — an entry is
 *    never older than 6h, well inside the signature's ~8h;
 *  - this instance's memory, 10 minutes (a miss — no such rendition — 2 minutes).
 * Only the asset route resolves these now (pages link versioned same-origin URLs), so this
 * runs on a CDN miss, not on every page view.
 */
import { revalidateTag, unstable_cache } from "next/cache";
import { chGet } from "./rest";

const MEMORY_TTL_MS = 10 * 60 * 1000;
const MISS_TTL_MS = 2 * 60 * 1000;
const WINDOW_MS = 6 * 60 * 60 * 1000;
const memory = new Map<string, { href: string; fetchedAt: number }>();

/** Content Hub answered: the asset has no such rendition (a real "not found", unlike a failed call). */
class NoRendition extends Error {
  constructor() { super("no such rendition"); }
}

const safeRendition = (r: string) => (/^[A-Za-z]+$/.test(r) ? r : "downloadOriginal");
const tagOf = (id: string, r: string) => `signed-href:${id}:${r}`;

async function resolveUncached(id: string, r: string): Promise<string> {
  // the identifier endpoint serves renditions too (verified live), so both id forms cost ONE call
  const path = /^\d+$/.test(id)
    ? `/api/entities/${id}?renditions=${r}`
    : `/api/entities/identifier/${encodeURIComponent(id)}?renditions=${r}`;
  const entity = await chGet(path);
  const href = entity?.renditions?.[r]?.[0]?.href || "";
  // no rendition: an answer, but not one for the shared cache (thrown = not stored)
  if (!href) throw new NoRendition();
  // Freshly issued signatures can 403 briefly while they propagate to the delivery CDN —
  // only hand out (and share) hrefs known to serve.
  if (!(await verifyHref(href))) throw new Error("signed URL not serving yet");
  return href;
}

export async function resolveSignedOriginalHref(idOrIdentifier: string): Promise<string> {
  return resolveSignedHref(idOrIdentifier, "downloadOriginal");
}

/** The signed URL of an asset's rendition ("downloadOriginal", "preview"); "" when none. */
export async function resolveSignedHref(idOrIdentifier: string, rendition: string): Promise<string> {
  return (await resolveSignedHrefStatus(idOrIdentifier, rendition)).href;
}

/**
 * The signed URL, and when there is none whether that's final (no such rendition — remembered
 * briefly) or transient (Content Hub didn't answer, throttled, or the signature isn't serving yet
 * — not remembered, so the next request tries again; the asset route answers 503 then, not 404).
 */
export async function resolveSignedHrefStatus(idOrIdentifier: string, rendition: string): Promise<{ href: string; transient: boolean }> {
  const id = String(idOrIdentifier);
  const r = safeRendition(rendition);
  const key = `${id}#${r}`;
  const hit = memory.get(key);
  if (hit && Date.now() - hit.fetchedAt < (hit.href ? MEMORY_TTL_MS : MISS_TTL_MS)) return { href: hit.href, transient: false };
  const window = Math.floor(Date.now() / WINDOW_MS);
  let href = "";
  try {
    href = await unstable_cache(() => resolveUncached(id, r), ["signed-href", id, r, String(window)], {
      revalidate: (2 * WINDOW_MS) / 1000,
      tags: [tagOf(id, r)],
    })();
  } catch (e) {
    if (!(e instanceof NoRendition)) return { href: "", transient: true };
    href = "";
  }
  memory.set(key, { href, fetchedAt: Date.now() });
  return { href, transient: false };
}

async function verifyHref(href: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(href, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(10_000) });
      // only the status matters: drop the (one-byte) body
      void r.body?.cancel().catch(() => undefined);
      if (r.ok || r.status === 206) return true;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
  }
  return false;
}

/** Drop a resolved href everywhere (after a 403 — the signature died earlier than expected). */
export function invalidateSignedHref(idOrIdentifier: string, rendition = "downloadOriginal"): void {
  const r = safeRendition(rendition);
  memory.delete(`${idOrIdentifier}#${r}`);
  try { revalidateTag(tagOf(String(idOrIdentifier), r), "max"); } catch { /* outside a request scope */ }
}
