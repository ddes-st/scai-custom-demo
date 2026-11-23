'use client';

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type CarouselChromeProps = {
  children: ReactNode;
};

export default function CarouselChrome({ children }: CarouselChromeProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateControls = () => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollLeft(track.scrollLeft > 1);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  };

  useEffect(() => {
    updateControls();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    return () => {
      track.removeEventListener("scroll", updateControls);
      window.removeEventListener("resize", updateControls);
    };
  }, []);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>(":scope > *");
    const distance = (card?.getBoundingClientRect().width ?? 255) + 16;
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        className="mx-auto flex w-full max-w-[825px] list-none gap-4 overflow-x-auto px-[20px] pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:justify-center lg:gap-[30px] lg:overflow-visible lg:px-0 lg:pt-0 [&>*]:w-[200px] [&>*]:shrink-0 [&>*]:snap-center md:[&>*]:w-[255px] md:[&>*]:snap-center lg:[&>*]:w-[255px] lg:[&>*]:shrink-0"
      >
        {children}
      </ul>
      <div className="mt-6 flex justify-center gap-5 lg:hidden">
        <button
          type="button"
          aria-label="Vorige"
          disabled={!canScrollLeft}
          onClick={() => move(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#9fa1b1]"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          aria-label="Volgende"
          disabled={!canScrollRight}
          onClick={() => move(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:text-[#9fa1b1]"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
