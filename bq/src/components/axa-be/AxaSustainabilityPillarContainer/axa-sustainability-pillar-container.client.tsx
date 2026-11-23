'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type CarouselChromeProps = {
  children: ReactNode;
};

export default function CarouselChrome({ children }: CarouselChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const update = () => {
      const overflowing = track.scrollWidth > track.clientWidth + 1;
      setHasOverflow(overflowing);
      setCanPrev(track.scrollLeft > 1);
      setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
    };

    update();
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      track.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(':scope > *');
    const distance = card ? card.getBoundingClientRect().width + 16 : track.clientWidth;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5 md:px-0 lg:mx-auto lg:max-w-[760px] lg:flex-wrap lg:justify-center lg:gap-[30px] lg:overflow-visible lg:px-0 lg:pb-0 [&>*]:w-[calc(100vw-74px)] [&>*]:shrink-0 [&>*]:snap-center [&>*]:scroll-mx-5 md:[&>*]:w-[350px] lg:[&>*]:w-[350px]"
      >
        {children}
      </div>
      {hasOverflow ? (
        <div className="mt-6 flex justify-center gap-5 lg:absolute lg:-left-16 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">
          <button
            type="button"
            aria-label="Vorige"
            disabled={!canPrev}
            onClick={() => move(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#00008f] disabled:opacity-40 lg:rounded-[5px]"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Volgende"
            disabled={!canNext}
            onClick={() => move(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#00008f] disabled:opacity-40 lg:rounded-[5px]"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
