'use client';

import React, { useState } from 'react';
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  'Video Thumbnail': ImageField;
  'Close Icon': ImageField;
}

type Props = { fields: Fields };

export default function SitecoreScrunchAiVisibilityVideoCtaChrome({ fields }: Props) {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  return (
    <>
      <div className="relative aspect-[1.77778] w-full overflow-hidden rounded-2xl border border-white/15 bg-white/[0.055] shadow-[0_2rem_5rem_rgba(0,0,0,0.34),inset_0_0_0_1px_rgba(130,104,255,0.08)] sm:rounded-[17px] lg:rounded-[20px]">
        <div className="absolute inset-0 z-0 bg-[conic-gradient(from_90deg_at_40%_-25%,rgba(255,31,57,0.16),rgba(254,125,255,0.16),rgba(134,41,255,0.16),rgba(54,142,205,0.16),rgba(77,223,255,0.16))] blur-[11px]" />
        <div className="relative z-[1] h-full w-full">
          <button
            type="button"
            aria-label="Play Video"
            aria-haspopup="dialog"
            aria-expanded={isVideoOpen}
            onClick={() => setIsVideoOpen(true)}
            className="group relative block h-full w-full cursor-pointer border-none bg-transparent p-0"
          >
            <div className="h-full w-full overflow-hidden rounded">
              <Image
                field={fields['Video Thumbnail']}
                className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02] group-focus-visible:scale-[1.02]"
              />
            </div>
            <span className="absolute inset-0 flex items-center justify-center">
              <span
                aria-hidden="true"
                className="block h-full w-1/6 min-w-16 max-w-24 bg-white drop-shadow-[0_0_2px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-[1.1] group-focus-visible:scale-[1.1]"
                style={{
                  maskImage: 'url(https://www.sitecore.com/static/play-circle.svg)',
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                  maskSize: '100% auto',
                  WebkitMaskImage: 'url(https://www.sitecore.com/static/play-circle.svg)',
                  WebkitMaskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskSize: '100% auto',
                }}
              />
            </span>
          </button>
        </div>
      </div>

      {isVideoOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-[3px]"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="relative aspect-video w-full max-w-5xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close video player"
              onClick={() => setIsVideoOpen(false)}
              className="group absolute right-0 top-0 z-10 rounded-bl-md bg-transparent p-4 text-white"
            >
              <Image
                field={fields['Close Icon']}
                className="transition-[filter] duration-150 group-hover:brightness-0 group-hover:invert"
              />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
