'use client';

import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';

function ArrowIcon({ next = false }: { next?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-6 lg:w-6 ${next ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export default function EventsWebinarsCarouselChrome({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrevious(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateControls();
    track.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls);
    return () => {
      track.removeEventListener('scroll', updateControls);
      window.removeEventListener('resize', updateControls);
    };
  }, [updateControls]);

  const move = (direction: number) => {
    const track = trackRef.current;
    const card = track?.firstElementChild as HTMLElement | null;
    if (!track || !card) return;
    track.scrollBy({ left: direction * card.getBoundingClientRect().width, behavior: 'smooth' });
  };

  return (
    <div className="relative flex w-full items-center">
      <button
        type="button"
        aria-label="Previous slide"
        disabled={!canPrevious}
        onClick={() => move(-1)}
        className="absolute left-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#e4e2e8] bg-white/90 text-gray-700 shadow-md transition-all duration-300 hover:border-[#ff1f56] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9 md:static md:translate-y-0 md:bg-white md:shadow-sm lg:h-12 lg:w-12"
      >
        <ArrowIcon />
      </button>
      <div ref={trackRef} className="-my-4 min-w-0 flex-1 overflow-hidden py-4 md:mx-2">
        <div className="flex overflow-x-visible">{children}</div>
      </div>
      <button
        type="button"
        aria-label="Next slide"
        disabled={!canNext}
        onClick={() => move(1)}
        className="absolute right-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[#e4e2e8] bg-white/90 text-gray-700 shadow-md transition-all duration-300 hover:border-[#ff1f56] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9 md:static md:translate-y-0 md:bg-white md:shadow-sm lg:h-12 lg:w-12"
      >
        <ArrowIcon next />
      </button>
    </div>
  );
}
