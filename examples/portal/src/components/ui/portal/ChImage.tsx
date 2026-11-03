import React from "react";
import { pickImage, type ImageLink, type ImageSlotName } from "src/lib/ch/image-links";

/**
 * A Content Hub image in the public link that fits its box best (see image-links.ts), with a
 * srcset when the asset has the same crop in several sizes. Usable in server and client
 * components. `data-public-link` names the link chosen (handy when checking a page).
 */
export function ChImage({ links, fallback, slot, crop, width, alt, loading = "lazy", className }: {
  links?: ImageLink[]; fallback?: string; slot: ImageSlotName; crop?: string; width?: number; alt: string; loading?: "lazy" | "eager"; className?: string;
}) {
  const img = pickImage(links, slot, fallback ?? "", crop ?? "", width ?? 0);
  if (!img.src) return null;
  return <img src={img.src} srcSet={img.srcSet} sizes={img.sizes} alt={alt} loading={loading} decoding="async" className={className} data-public-link={img.name || undefined} />;
}
