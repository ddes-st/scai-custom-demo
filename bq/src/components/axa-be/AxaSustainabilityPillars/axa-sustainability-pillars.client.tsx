'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

type SustainabilityPillarsChromeProps = {
  children: ReactNode;
};

export default function SustainabilityPillarsChrome({ children }: SustainabilityPillarsChromeProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const updateOverflow = () => {
      const track = trackRef.current;
      setHasOverflow(Boolean(track && track.scrollWidth > track.clientWidth + 1));
    };

    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, []);

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const amount = card ? card.getBoundingClientRect().width + 16 : 300;
    track.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <div className="relative flex flex-wrap justify-center md:flex-wrap md:justify-center lg:flex-wrap lg:justify-center">
      {hasOverflow ? (
        <button
          type="button"
          aria-label="Vorige"
          onClick={() => move(-1)}
          className="absolute left-[-8px] top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] md:flex lg:left-[-36px]"
        >
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}
      <ul
        ref={trackRef}
        className="order-1 flex w-[calc(100%+16px)] gap-4 overflow-x-auto px-2 py-[18px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:w-[calc(100%+40px)] md:gap-4 md:px-2 lg:w-[calc(100%+20px)] lg:flex-wrap lg:justify-center lg:gap-[30px] lg:overflow-visible lg:px-[10px] lg:py-4 [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center"
      >
        {children}
      </ul>
      {hasOverflow ? (
        <button
          type="button"
          aria-label="Volgende"
          onClick={() => move(1)}
          className="absolute right-[-8px] top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] md:flex lg:right-[-36px]"
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
      {hasOverflow ? (
        <div className="order-2 mt-5 flex w-full justify-center gap-5 md:hidden">
          <button
            type="button"
            aria-label="Vorige"
            onClick={() => move(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f]"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label="Volgende"
            onClick={() => move(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f]"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
