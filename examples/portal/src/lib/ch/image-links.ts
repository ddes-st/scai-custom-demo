/**
 * The best public link of an image for the box it is shown in.
 *
 * Experience Edge returns every public link of an asset in `urls` with its size: the
 * `preview` rendition, the plain original, and the crops (transformations such as
 * HomePageHero 2000×800, HomepagePromoCTAs 1100×740) with `width`, `height`,
 * `original_width/height` and the cropping configuration. A slot names the box a component
 * draws (aspect ratio and CSS width, or `natural` for an image shown uncropped); the pick
 * prefers the link whose ratio matches the box — so an editor's intended crop wins over a
 * centre crop by the browser — and then the smallest one that still covers the box at 2×
 * density, without upscaling. Same-ratio links make the srcset. In hybrid/gated mode the links are
 * the portal's own /api/asset URLs: the chosen link is then served resized (?w=, WebP — the
 * renditions are heavy) with a srcset of widths up to its own. Client-safe (no server APIs).
 */
import { gatedFileUrl, IMAGE_WIDTHS, imageFromOrigin, isPortalFileUrl, sizedFileUrl } from "./fileUrl";
import { isEditingHost } from "../portal/editing-host-flag";

/** One usable image link: url, delivered size, effective source detail, name (crop name, `preview`, `original`). */
export interface ImageLink { u: string; w: number; h: number; d: number; n: string; crop: boolean }

export interface ImageSlot {
  /** Width ÷ height of the box; 0 = natural (shown uncropped, any ratio). */
  ratio: number;
  /** CSS pixels the box is wide on a desktop layout. */
  width: number;
  /** The `sizes` attribute for the srcset. */
  sizes: string;
}

/** The image boxes of the portal's components (see portal.css). */
export const IMAGE_SLOTS = {
  card: { ratio: 4 / 3, width: 380, sizes: "(max-width: 640px) 100vw, 380px" },
  row: { ratio: 4 / 3, width: 120, sizes: "120px" },
  tile: { ratio: 1, width: 220, sizes: "(max-width: 640px) 45vw, 220px" },
  slide: { ratio: 16 / 10, width: 520, sizes: "(max-width: 640px) 86vw, 520px" },
  lead: { ratio: 1.8, width: 680, sizes: "(max-width: 900px) 100vw, 680px" },
  wide: { ratio: 2.4, width: 1200, sizes: "(max-width: 1240px) 100vw, 1200px" },
  detail: { ratio: 0, width: 560, sizes: "(max-width: 900px) 100vw, 560px" },
  thumb: { ratio: 4 / 3, width: 280, sizes: "(max-width: 640px) 50vw, 280px" },
  // the header logo: natural shape, small (callers pass the uncropped links only)
  logo: { ratio: 0, width: 140, sizes: "140px" },
} satisfies Record<string, ImageSlot>;
export type ImageSlotName = keyof typeof IMAGE_SLOTS;

const WEB_IMAGE = /^image\/(jpe?g|png|gif|webp|avif|svg\+xml)$/i;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

/** "95738-HomePageHero-2000x800" → "HomePageHero". */
export function cropName(key: string): string {
  return key.replace(/^\d+-/, "").replace(/-\d+x\d+$/, "") || key;
}

/**
 * The image links of an asset from Edge's `urls`. In hybrid/gated mode (`gated`) the URLs are
 * same-origin /api/asset ones (preview rendition, original, or a named public link), so no
 * Content Hub link is written into the page.
 */
export function imageLinksOf(urls: unknown, gated?: { id: string; version?: unknown }): ImageLink[] {
  if (!urls || typeof urls !== "object") return [];
  const out: ImageLink[] = [];
  for (const [key, entry] of Object.entries(urls as Record<string, any>)) {
    if (!entry?.url) continue;
    if (entry.expiredOn && Date.parse(entry.expiredOn) < Date.now()) continue;
    const m = entry.metadata ?? {};
    const w = num(m.width), h = num(m.height);
    if (!w || !h) continue;
    const cropped = !!m.cropping_configuration;
    if (cropped) {
      // a crop delivers w×h, but holds no more detail than the original it was cut from
      const ow = num(m.original_width), oh = num(m.original_height);
      const scale = ow && oh ? Math.max(w / ow, h / oh) : 1;
      const d = Math.round(w / Math.max(1, scale));
      out.push({ u: gated ? gatedFileUrl(gated.id, { publicLink: key, version: gated.version }) : String(entry.url), w, h, d, n: cropName(key), crop: true });
    } else if (entry.resource === "preview") {
      out.push({ u: gated ? gatedFileUrl(gated.id, { preview: true, version: gated.version }) : String(entry.url), w, h, d: w, n: "preview", crop: false });
    } else if (entry.resource === "downloadOriginal" && WEB_IMAGE.test(String(m.content_type ?? ""))) {
      out.push({ u: gated ? gatedFileUrl(gated.id, { version: gated.version }) : String(entry.url), w, h, d: w, n: "original", crop: false });
    }
  }
  return out;
}

const SAME_RATIO = 0.03;
const ratioOf = (l: ImageLink) => l.w / l.h;

/** Lower is better: ratio fit first, then enough detail for 2× without waste. */
function score(l: ImageLink, slot: ImageSlot): number {
  const need = slot.width * 2;
  const ratio = slot.ratio ? Math.abs(Math.log(ratioOf(l) / slot.ratio)) * 4 : l.crop ? 1 : 0;
  const detail = l.d >= need ? (l.d / need - 1) * 0.15 : (1 - l.d / need) * 1.5;
  // a crop blown up beyond its original looks soft however big it is delivered
  const upscale = (l.w / l.d - 1) * 0.8;
  // the original is heavy; prefer a rendition of the same shape when one is good enough
  const weight = l.n === "original" ? 0.05 : 0;
  return ratio + detail + upscale + weight;
}

/** The aspect ratio (w/h) of a named public link of the first card that has it — the box shape for a forced crop. */
export function namedLinkRatio(linkSets: Array<ImageLink[] | undefined>, name: string): number {
  const n = name.trim().toLowerCase();
  if (!n || n === "auto") return 0;
  for (const links of linkSets) { const l = links?.find((x) => x.n.toLowerCase() === n); if (l) return l.w / l.h; }
  return 0;
}

export interface PickedImage { src: string; srcSet?: string; sizes?: string; width?: number; height?: number; name: string }

/**
 * The best link for a slot; `crop` (an author's choice: a crop name, `preview`, `original` or
 * "auto"/"") forces a named link when the asset has it. Falls back to `fallback` (the preview).
 */
export function pickImage(links: ImageLink[] | undefined, slotName: ImageSlotName, fallback = "", crop = "", width = 0): PickedImage {
  const p = pickImageHere(links, slotName, fallback, crop, width);
  // an editing host: the image (every srcset width too) from the live portal (fileUrl.imageOrigin)
  return { ...p, src: imageFromOrigin(p.src), srcSet: p.srcSet?.split(", ").map((e) => { const i = e.lastIndexOf(" "); return `${imageFromOrigin(e.slice(0, i))}${e.slice(i)}`; }).join(", ") };
}

function pickImageHere(links: ImageLink[] | undefined, slotName: ImageSlotName, fallback: string, crop: string, width: number): PickedImage {
  // `width`: the box's real CSS width when a layout setting (Columns) changes it
  const base: ImageSlot = IMAGE_SLOTS[slotName];
  const slot: ImageSlot = width > 0 ? { ...base, width, sizes: `(max-width: 640px) 100vw, ${Math.round(width)}px` } : base;
  const list = links ?? [];
  // no sized links (only the preview): a portal file still comes resized for 2× the box
  if (!list.length) return { src: isPortalFileUrl(fallback) ? sizedFileUrl(fallback, slot.width * 2) : fallback, name: "" };
  const wanted = crop.trim().toLowerCase();
  const forced = wanted && wanted !== "auto" ? list.filter((l) => l.n.toLowerCase() === wanted) : [];
  const pool = forced.length ? forced : list;
  const best = [...pool].sort((a, b) => score(a, slot) - score(b, slot))[0];
  if (isPortalFileUrl(best.u)) {
    // the portal resizes its own files: the chosen crop at the widths below its own (never enlarged)
    const widths = IMAGE_WIDTHS.filter((w) => w >= 320 && w < best.w);
    // an editing host: one size per image (2× the box) — the Page builder doesn't need a srcset, and
    // every size is one more file the portal fetches and resizes
    if (isEditingHost() && widths.length) {
      const srcW = widths.find((w) => w >= slot.width * 2) ?? widths[widths.length - 1];
      return { src: sizedFileUrl(best.u, srcW), width: srcW, height: Math.round((best.h * srcW) / best.w), name: best.n };
    }
    if (widths.length) {
      const need = slot.width * 2;
      const srcW = widths.find((w) => w >= need) ?? widths[widths.length - 1];
      const entries = widths.map((w) => `${sizedFileUrl(best.u, w)} ${w}w`);
      // full size only when the box can use more than the largest resized width
      if (need > widths[widths.length - 1]) entries.push(`${best.u} ${best.w}w`);
      const h = Math.round((best.h * srcW) / best.w);
      return { src: sizedFileUrl(best.u, srcW), srcSet: entries.join(", "), sizes: slot.sizes, width: srcW, height: h, name: best.n };
    }
  }
  // srcset: the links of the same shape (and the same kind) as the winner, one per width
  const r = ratioOf(best);
  const family = list
    .filter((l) => l.crop === best.crop && Math.abs(Math.log(ratioOf(l) / r)) < SAME_RATIO && l.d >= Math.min(best.d, slot.width))
    .sort((a, b) => a.w - b.w)
    .filter((l, i, arr) => i === 0 || l.w !== arr[i - 1].w);
  const srcSet = family.length > 1 ? family.map((l) => `${l.u} ${l.w}w`).join(", ") : undefined;
  return { src: best.u, srcSet, sizes: srcSet ? slot.sizes : undefined, width: best.w, height: best.h, name: best.n };
}
