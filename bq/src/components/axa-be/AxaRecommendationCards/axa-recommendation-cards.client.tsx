'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

type RecommendationCardsChromeProps = {
  children: ReactNode;
};

export default function RecommendationCardsChrome({ children }: RecommendationCardsChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateState = () => {
    const track = trackRef.current;
    if (!track) return;
    const overflowing = track.scrollWidth > track.clientWidth + 1;
    setCanScroll(overflowing);
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1);
  };

  useEffect(() => {
    updateState();
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(updateState);
    observer.observe(track);
    track.addEventListener("scroll", updateState, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", updateState);
    };
  }, []);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.firstElementChild as HTMLElement | null;
    const distance = (firstCard?.offsetWidth ?? 350) + 30;
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Vorige"
        disabled={!canScroll || atStart}
        onClick={() => move(-1)}
        className="absolute left-[-36px] top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] text-xl text-[#00008f] disabled:pointer-events-none disabled:text-[#9fa1b1] md:flex lg:left-[-56px]"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-0 py-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-[20px] md:px-0 lg:justify-center lg:gap-[30px] lg:overflow-x-visible lg:py-4 [&>*]:w-[min(90%,300px)] [&>*]:shrink-0 [&>*]:snap-center md:[&>*]:w-[347px] lg:[&>*]:w-[350px]"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Volgende"
        disabled={!canScroll || atEnd}
        onClick={() => move(1)}
        className="absolute right-[-36px] top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] text-xl text-[#00008f] disabled:pointer-events-none disabled:text-[#9fa1b1] md:flex lg:right-[-56px]"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
