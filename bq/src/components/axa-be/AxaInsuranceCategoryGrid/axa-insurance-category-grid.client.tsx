'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type CarouselChromeProps = {
  children: ReactNode;
};

export default function CarouselChrome({ children }: CarouselChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const overflow = track.scrollWidth > track.clientWidth + 1;
    setHasOverflow(overflow);
    setCanPrevious(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateState();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateState, { passive: true });
    const observer = new ResizeObserver(updateState);
    observer.observe(track);
    return () => {
      track.removeEventListener('scroll', updateState);
      observer.disconnect();
    };
  }, [updateState]);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(':scope > *');
    const distance = card ? card.offsetWidth + 16 : track.clientWidth;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:justify-center lg:gap-[30px] lg:overflow-visible lg:py-0 [&>*]:w-[200px] [&>*]:shrink-0 [&>*]:snap-center md:[&>*]:w-[255px] lg:[&>*]:w-[255px]"
      >
        {children}
      </div>
      <div className={`${hasOverflow ? 'flex' : 'hidden'} mt-6 justify-center gap-5 lg:hidden`}>
        <button
          type="button"
          aria-label="Vorige"
          disabled={!canPrevious}
          onClick={() => move(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#00008f] disabled:text-[#9fa1b1]"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Volgende"
          disabled={!canNext}
          onClick={() => move(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] text-2xl leading-none text-[#00008f] disabled:text-[#9fa1b1]"
        >
          ›
        </button>
      </div>
    </div>
  );
}
