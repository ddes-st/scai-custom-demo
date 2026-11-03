"use client";
import React, { useState } from "react";
import type { MediaItem } from "src/lib/ch/media";
import { ChImage } from "components/ui/portal/ChImage";
import { Lightbox } from "components/ui/portal/Lightbox";

/** The microsite's images and films as tiles; a tile opens the lightbox (keyboard: Enter, ← →, Esc). */
export function GalleryGrid({ items, label }: { items: MediaItem[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ul className="au-gallery-grid" aria-label={label}>
        {items.map((a, i) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpen(i)} aria-label={a.title}>
              <ChImage links={a.links} fallback={a.preview} slot="tile" alt="" />
              {a.kind === "video" && <span className="au-play" aria-hidden="true">▶</span>}
            </button>
          </li>
        ))}
      </ul>
      {open != null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} track />}
    </>
  );
}
