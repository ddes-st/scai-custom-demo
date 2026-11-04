import React from "react";
import { Link } from "src/i18n/navigation";
import type { EntityCard } from "src/lib/ch/entities";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";

/** Card, row and tile for any Content Hub entity (server components; link when the
 *  definition has a detail page). */
function Wrap({ card, className, children }: { card: EntityCard; className: string; children: React.ReactNode }) {
  return card.href ? <Link href={card.href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

/** `crop`: an author's choice of public link (rendering parameter ImageCrop); "" = best fit per box. */
export function EntityCardView({ card, hero = false, crop = "", width = 0 }: { card: EntityCard; hero?: boolean; crop?: string; width?: number }) {
  return (
    <Wrap card={card} className={hero ? "portal-press-lead ch-hero" : "portal-card"}>
      <span className="media">{card.image ? <ChImage links={card.imageLinks} fallback={card.image} slot={hero ? "lead" : "card"} crop={crop} width={hero ? 0 : width} alt="" loading={hero ? "eager" : "lazy"} /> : <span className="glyph">{card.title.charAt(0)}</span>}</span>
      <span className="body">
        {hero && card.subtitle && <span className="sub">{card.subtitle}</span>}
        <span className="name">{card.title}</span>
        {card.summary && <span className="summary">{card.summary}</span>}
        {!hero && card.subtitle && <span className="sub">{card.subtitle}</span>}
        {hero && card.href && <span className="more">{ui("open")}</span>}
      </span>
    </Wrap>
  );
}

export function EntityRow({ card, crop = "" }: { card: EntityCard; crop?: string }) {
  return (
    <Wrap card={card} className="portal-press-item">
      {card.image && <span className="media"><ChImage links={card.imageLinks} fallback={card.image} slot="row" crop={crop} alt="" /></span>}
      <span className="body">
        {card.subtitle && <span className="sub">{card.subtitle}</span>}
        <span className="name">{card.title}</span>
        {card.summary && <span className="summary">{card.summary}</span>}
      </span>
    </Wrap>
  );
}

/**
 * Image-led card: title and summary sit on the photo. `mosaic` places it in the
 * brand-hub masonry; `label` is the small category chip on that layout.
 */
export function EntityOverlay({ card, crop = "", width = 0, mosaic, label }: { card: EntityCard; crop?: string; width?: number; mosaic?: number; label?: string }) {
  const mosaicClass = mosaic == null ? "" : ` hub-mosaic hub-mosaic-${mosaic % 6}`;
  return (
    <Wrap card={card} className={`hub-overlay-card group${mosaicClass}`}>
      <span className="media">
        {card.image ? <ChImage links={card.imageLinks} fallback={card.image} slot="card" crop={crop} width={width} alt="" /> : <span className="glyph">{card.title.charAt(0)}</span>}
      </span>
      <span className="hub-overlay-copy">
        {label && mosaic != null ? <span className="hub-overlay-label">{label}</span> : (
          <>
            <span className="name">{card.title}</span>
            {card.summary && <span className="summary">{card.summary}</span>}
          </>
        )}
      </span>
    </Wrap>
  );
}

export function EntityTile({ card, crop = "", width = 0 }: { card: EntityCard; crop?: string; width?: number }) {
  return (
    <Wrap card={card} className="ch-tile">
      <span className="media">{card.image ? <ChImage links={card.imageLinks} fallback={card.image} slot="tile" crop={crop} width={width} alt="" /> : <span className="glyph">{card.title.charAt(0)}</span>}</span>
      <span className="caption">{card.title}</span>
    </Wrap>
  );
}
