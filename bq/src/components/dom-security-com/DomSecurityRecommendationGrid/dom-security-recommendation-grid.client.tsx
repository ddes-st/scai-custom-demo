'use client';

import { useRef } from "react";
import type { ReactNode } from "react";

type RecommendationGridChromeProps = {
  children: ReactNode;
};

export default function RecommendationGridChrome({ children }: RecommendationGridChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: number) => {
    trackRef.current?.scrollBy({ left: direction * 346, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Previous"
        onClick={() => scroll(-1)}
        className="absolute left-[-15px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-[#d51130] text-xl leading-none text-white lg:hidden"
      >
        <span aria-hidden="true">←</span>
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[330px] [&>*]:shrink-0 [&>*]:snap-start lg:grid lg:grid-cols-3 lg:gap-[30px] lg:overflow-visible lg:pb-0 lg:[&>*]:w-auto lg:[&>*]:shrink lg:[&>*]:snap-none"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scroll(1)}
        className="absolute right-[-15px] top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-[#d51130] text-xl leading-none text-white lg:hidden"
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
