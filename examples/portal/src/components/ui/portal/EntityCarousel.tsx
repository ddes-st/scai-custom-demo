"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { EntityCard } from "src/lib/ch/entities";
import { useUi } from "src/lib/portal/ui-text-client";
import { ChImage } from "components/ui/portal/ChImage";
import { Link } from "src/i18n/navigation";

/** A scroll-snap carousel of entity cards (images, products, …) with previous/next buttons;
 *  works without JavaScript as a horizontally scrolling strip. */
/** `perView`: slides visible at once (1–4; 0 = the default peek layout); `slideWidth`: their CSS width, for the image pick. */
export function EntityCarousel({ cards, crop = "", perView = 0, slideWidth = 0 }: { cards: EntityCard[]; crop?: string; perView?: number; slideWidth?: number }) {
  const t = useUi();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const step = useCallback((dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>(".ch-slide");
    const width = (slide?.offsetWidth ?? el.clientWidth) + 16;
    // right to left: "next" scrolls toward negative scrollLeft
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: (rtl ? -dir : dir) * width, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const slide = el.querySelector<HTMLElement>(".ch-slide");
      const width = (slide?.offsetWidth ?? el.clientWidth) + 16;
      // scrollLeft runs from 0 to negative values in right-to-left pages
      setIndex(Math.round(Math.abs(el.scrollLeft) / width));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={perView ? `ch-carousel ch-per-${perView}` : "ch-carousel"}>
      <div className="ch-track" ref={track} tabIndex={0} aria-roledescription="carousel">
        {cards.map((card, i) => {
          const body = (
            <>
              <span className="media">{card.image ? <ChImage links={card.imageLinks} fallback={card.image} slot="slide" crop={crop} width={slideWidth} alt={card.title} loading={i < Math.max(2, perView) ? "eager" : "lazy"} /> : <span className="glyph">{card.title.charAt(0)}</span>}</span>
              <span className="caption"><span className="name">{card.title}</span>{card.subtitle && <span className="sub">{card.subtitle}</span>}</span>
            </>
          );
          return card.href
            ? <Link key={card.id} className="ch-slide" href={card.href} aria-label={card.title}>{body}</Link>
            : <figure key={card.id} className="ch-slide">{body}</figure>;
        })}
      </div>
      {cards.length > (perView || 1) && (
        <div className="ch-controls">
          <button type="button" onClick={() => step(-1)} aria-label={t("previous")} disabled={index <= 0}>‹</button>
          <span className="ch-dots" aria-hidden="true">{cards.map((c, i) => <i key={c.id} className={i === index ? "on" : ""} />)}</span>
          <button type="button" onClick={() => step(1)} aria-label={t("next")} disabled={index >= cards.length - (perView || 1)}>›</button>
        </div>
      )}
    </div>
  );
}
