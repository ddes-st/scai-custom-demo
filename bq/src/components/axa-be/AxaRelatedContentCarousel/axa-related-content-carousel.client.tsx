'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface RelatedContentCarouselChromeProps {
  children: React.ReactNode;
}

export default function RelatedContentCarouselChrome({ children }: RelatedContentCarouselChromeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const overflow = viewport.scrollWidth > viewport.clientWidth + 1;
    setHasOverflow(overflow);
    setAtStart(viewport.scrollLeft <= 1);
    setAtEnd(viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateState();
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener('scroll', updateState, { passive: true });
    window.addEventListener('resize', updateState);
    return () => {
      viewport.removeEventListener('scroll', updateState);
      window.removeEventListener('resize', updateState);
    };
  }, [updateState]);

  const scroll = (direction: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const card = viewport.querySelector<HTMLElement>(':scope > * > *');
    const distance = card ? card.offsetWidth + 30 : viewport.clientWidth;
    viewport.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="relative mt-10 sm:mt-14">
      <div ref={viewportRef}>{children}</div>
      {hasOverflow ? (
        <>
          <button
            type="button"
            aria-label="Vorige inhoud"
            disabled={atStart}
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#9fa1b1] disabled:opacity-50 lg:flex"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Volgende inhoud"
            disabled={atEnd}
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 hidden h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#9fa1b1] disabled:opacity-50 lg:flex"
          >
            <span aria-hidden="true">›</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
