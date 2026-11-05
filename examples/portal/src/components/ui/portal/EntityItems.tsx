import React from "react";
import type { EntityCard } from "src/lib/ch/entities";
import { EntityCardView, EntityOverlay, EntityRow, EntityTile } from "components/ui/portal/EntityCards";
import { EntityCarousel } from "components/ui/portal/EntityCarousel";
import { namedLinkRatio } from "src/lib/ch/image-links";

/** The design variants an author picks in the Design tab (rendering parameter `Variant`). */
export const VARIANTS = ["cards", "list", "tiles", "carousel", "hero", "overlay", "masonry"] as const;
export type Variant = (typeof VARIANTS)[number];

export const variantOf = (value: string): Variant => {
  const v = value.trim().toLowerCase() as Variant;
  return (VARIANTS as readonly string[]).includes(v) ? v : "cards";
};

/** Rendering parameter `Columns`: items per row (cards, tiles) or slides visible (carousel); 0 = automatic. 5 is the brand-hub job row. */
export const columnsOf = (value: string): number => { const n = Number(String(value).trim()); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0; };

/** The width of one of `n` columns in the portal's content column (1200 px wide). */
const columnWidth = (n: number, gap = 16) => (n ? Math.round((1200 - (n - 1) * gap) / n) : 0);

/**
 * Entity cards in one of the design variants. `crop` forces a named public link (rendering
 * parameter ImageCrop) — the image boxes then take that crop's shape, so a HomePageHero shows
 * whole instead of cut to the box; `columns` sets items per row / slides visible.
 */
export function EntityItems({ variant, cards, crop = "", columns = 0 }: { variant: Variant; cards: EntityCard[]; crop?: string; columns?: number }) {
  if (!cards.length) return null;
  const ratio = namedLinkRatio(cards.map((c) => c.imageLinks), crop);
  const shape = ratio ? ({ ["--ch-media-ratio" as string]: String(Math.round(ratio * 1000) / 1000) } as React.CSSProperties) : undefined;
  const cols = columns ? ` ch-cols ch-cols-${columns}` : "";
  const width = columnWidth(columns, variant === "tiles" ? 12 : variant === "carousel" ? 16 : 18);
  switch (variant) {
    case "list":
      return <div className="portal-press-list">{cards.map((card) => <EntityRow key={card.id} card={card} crop={crop} />)}</div>;
    case "tiles":
      return <div className={`ch-tiles${cols}`} style={shape}>{cards.map((card) => <EntityTile key={card.id} card={card} crop={crop} width={width} />)}</div>;
    case "overlay":
      return (
        <div className={`hub-overlay-grid${cols}`} style={shape}>
          {cards.map((card) => <EntityOverlay key={card.id} card={card} crop={crop} width={width} />)}
        </div>
      );
    case "masonry":
      return (
        <div className="hub-masonry" style={shape}>
          {cards.map((card, i) => <EntityOverlay key={card.id} card={card} crop={crop} width={width} mosaic={i} label={/^\d{4}-\d{2}-\d{2}/.test(card.subtitle) ? card.title : (card.subtitle || card.title)} />)}
        </div>
      );
    case "carousel":
      return <div style={shape}><EntityCarousel cards={cards} crop={crop} perView={columns} slideWidth={width} /></div>;
    case "hero": {
      const [first, ...rest] = cards;
      return (
        <>
          <EntityCardView card={first} hero crop={crop} />
          {rest.length > 0 && <div className={`portal-grid${cols}`} style={shape}>{rest.map((card) => <EntityCardView key={card.id} card={card} crop={crop} width={width} />)}</div>}
        </>
      );
    }
    default:
      return <div className={`portal-grid${cols}`} style={shape}>{cards.map((card) => <EntityCardView key={card.id} card={card} crop={crop} width={width} />)}</div>;
  }
}
