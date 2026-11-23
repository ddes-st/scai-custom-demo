'use client';

import React, { JSX, useState } from 'react';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export default function SitecoreCustomerLogoMarqueeChrome({ children }: Props): JSX.Element {
  const [paused, setPaused] = useState(false);

  return (
    <section className="min-h-[110px] overflow-hidden bg-transparent sm:min-h-[120px] md:min-h-[130px]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid overflow-hidden border-x border-b border-[#e4e2e8] bg-[#f9f9fa] px-0 py-4 sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:py-6 lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:py-4">
          <div
            className="col-span-12 overflow-hidden"
            role="region"
            aria-label="Logo carousel"
            aria-roledescription="carousel"
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div
              className="flex w-max items-center gap-8 pl-6 sm:gap-10 sm:pl-7 md:gap-12 md:pl-8 xl:gap-14"
              style={{
                animation: 'sitecore-logo-scroll 48s linear infinite',
                animationPlayState: paused ? 'paused' : 'running',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes sitecore-logo-scroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-33.333333%, 0, 0); } } @media (prefers-reduced-motion: reduce) { .sitecore-logo-scroll { animation: none !important; } }`}</style>
    </section>
  );
}
