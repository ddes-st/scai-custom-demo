'use client';

import React, { JSX, ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
}

function visibleCards(): number {
  if (typeof window === 'undefined') return 1;
  if (window.innerWidth >= 1024) return 3;
  if (window.innerWidth >= 640) return 2;
  return 1;
}

export default function SitecoreAiWorkflowCardsCarouselChrome({ children }: Props): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(1);
  const cardCount = React.Children.count(children);

  useEffect(() => {
    const updateVisible = () => setVisible(visibleCards());
    updateVisible();
    window.addEventListener('resize', updateVisible);
    return () => window.removeEventListener('resize', updateVisible);
  }, []);

  const move = (direction: -1 | 1) => {
    const nextIndex = Math.max(
      0,
      Math.min(Math.max(0, cardCount - visible), activeIndex + direction),
    );
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({
        left: (viewport.clientWidth / visible) * nextIndex,
        behavior: 'smooth',
      });
    }
    setActiveIndex(nextIndex);
  };

  return (
    <div className="flex flex-col">
      <div className="relative flex w-full items-center">
        <div className="absolute left-0 top-1/2 z-20 -translate-y-1/2 md:static md:flex-shrink-0 md:translate-y-0">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => move(-1)}
            disabled={activeIndex === 0}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2e8] bg-white/90 text-gray-700 shadow-md transition-all duration-300 hover:border-[#ff1f38] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e4e2e8] disabled:hover:shadow-md sm:h-9 sm:w-9 md:bg-white md:shadow-sm lg:h-12 lg:w-12"
          >
            <svg
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 lg:h-6 lg:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div ref={viewportRef} className="-my-4 min-w-0 flex-1 overflow-hidden py-4 md:mx-2">
          <div className="grid grid-flow-col auto-cols-[100%] sm:auto-cols-[50%] lg:auto-cols-[33.333%]">
            {children}
          </div>
        </div>
        <div className="absolute right-0 top-1/2 z-20 -translate-y-1/2 md:static md:flex-shrink-0 md:translate-y-0">
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => move(1)}
            disabled={activeIndex >= cardCount - visible}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e2e8] bg-white/90 text-gray-700 shadow-md transition-all duration-300 hover:border-[#ff1f38] hover:bg-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e4e2e8] disabled:hover:shadow-md sm:h-9 sm:w-9 md:bg-white md:shadow-sm lg:h-12 lg:w-12"
          >
            <svg
              className="h-3.5 w-3.5 rotate-180 sm:h-4 sm:w-4 lg:h-6 lg:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
