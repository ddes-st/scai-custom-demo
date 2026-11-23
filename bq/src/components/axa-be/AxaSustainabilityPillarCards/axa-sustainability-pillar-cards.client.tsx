'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type CarouselChromeProps = {
  children: ReactNode;
};

export default function CarouselChrome({ children }: CarouselChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScroll(maxScroll > 1);
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft >= maxScroll - 1);
  }, []);

  useEffect(() => {
    updateState();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateState);
    observer.observe(track);
    track.addEventListener('scroll', updateState, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', updateState);
    };
  }, [updateState]);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(':scope > *');
    const distance = card ? card.offsetWidth + 16 : track.clientWidth * 0.85;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="relative mt-10 md:mt-12 lg:mt-14">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto px-0 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5 md:px-0 lg:flex-wrap lg:justify-center lg:gap-[30px] lg:overflow-visible lg:pb-0 [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center"
      >
        {children}
      </div>
      {canScroll ? (
        <>
          <button
            type="button"
            aria-label="Vorige"
            disabled={atStart}
            onClick={() => move(-1)}
            className="absolute left-0 top-1/2 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#cfd1dc] md:flex lg:-left-5"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Volgende"
            disabled={atEnd}
            onClick={() => move(1)}
            className="absolute right-0 top-1/2 hidden h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#cfd1dc] md:flex lg:-right-5"
          >
            <span aria-hidden="true">›</span>
          </button>
          <div className="flex justify-center gap-5 pt-4 md:pt-6 lg:hidden">
            <button
              type="button"
              aria-label="Vorige"
              disabled={atStart}
              onClick={() => move(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#cfd1dc]"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              aria-label="Volgende"
              disabled={atEnd}
              onClick={() => move(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#cfd1dc]"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
