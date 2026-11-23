'use client';

import { useRef } from 'react';
import type { ReactNode } from 'react';

type SitecorePlatformCapabilitiesCarouselChromeProps = {
  children?: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
};

export default function SitecorePlatformCapabilitiesCarouselChrome({
  children,
  previousLabel = 'Previous slide',
  nextLabel = 'Next slide',
}: SitecorePlatformCapabilitiesCarouselChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const first = track.firstElementChild as HTMLElement | null;
    const distance = first ? first.getBoundingClientRect().width + 16 : track.clientWidth;
    track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={previousLabel}
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-xl leading-none shadow-md"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-xl leading-none shadow-md"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
