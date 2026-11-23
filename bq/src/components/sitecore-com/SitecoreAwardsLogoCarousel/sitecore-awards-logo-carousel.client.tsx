'use client';

import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function SitecoreRecognitionBadgeCarouselChrome({ children }: Props) {
  return (
    <>
      <style>{`
        @keyframes sitecore-recognition-badge-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        .sitecore-recognition-badge-track {
          animation: sitecore-recognition-badge-marquee 36s linear infinite;
        }
        .sitecore-recognition-badge-carousel:hover .sitecore-recognition-badge-track,
        .sitecore-recognition-badge-carousel:focus-within .sitecore-recognition-badge-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .sitecore-recognition-badge-track { animation: none; }
        }
      `}</style>
      <section
        className="min-h-[110px] overflow-hidden bg-[#f9f9fa] sm:min-h-[120px] md:min-h-[130px]"
        aria-label="Recognition badges"
      >
        <div className="mx-auto w-full max-w-[1920px]">
          <div className="mx-0 grid overflow-hidden py-4 sm:py-6 md:py-4 lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)]">
            <div
              className="sitecore-recognition-badge-carousel col-span-12 overflow-hidden"
              role="region"
              aria-label="Logo carousel"
              aria-roledescription="carousel"
            >
              <div
                className="sitecore-recognition-badge-track flex w-max items-center"
                aria-live="off"
              >
                <div className="flex shrink-0 items-center gap-8 py-1 pl-6 sm:gap-10 sm:pl-7 md:gap-12 md:pl-8 xl:gap-14">
                  {children}
                </div>
                <div
                  className="flex shrink-0 items-center gap-8 py-1 pl-6 sm:gap-10 sm:pl-7 md:gap-12 md:pl-8 xl:gap-14"
                  aria-hidden="true"
                >
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
