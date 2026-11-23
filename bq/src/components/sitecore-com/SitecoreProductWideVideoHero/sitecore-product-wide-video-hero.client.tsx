'use client';

import React, { JSX, useState } from 'react';
import { Image } from '@sitecore-content-sdk/nextjs';
import type { ImageField } from '@sitecore-content-sdk/nextjs';

interface Props {
  thumbnail: ImageField;
}

export default function SitecoreAiDiscoveryVideoHeroChrome({ thumbnail }: Props): JSX.Element {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Play Video"
        aria-pressed={isPlaying}
        onClick={() => setIsPlaying(true)}
        className="group w-full cursor-pointer rounded border-none bg-transparent p-0 shadow-[0_0_5px_1px_rgba(0,0,0,0.3)]"
      >
        <div className="relative w-full overflow-hidden rounded">
          <Image
            field={thumbnail}
            className="w-full rounded transition-transform duration-300 ease-out group-hover:scale-[1.02] group-focus-visible:scale-[1.02]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              aria-hidden="true"
              className="block h-full min-w-16 w-1/6 max-w-24 bg-white drop-shadow-[0_0_2px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110 [mask-image:url('https://www.sitecore.com/static/play-circle.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:100%_auto]"
            />
          </div>
        </div>
      </button>
      {isPlaying ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="SitecoreAI video"
        >
          <div className="relative w-full max-w-4xl rounded bg-white p-3 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="absolute right-3 top-2 z-10 text-2xl leading-none text-[#1e1c22]"
              aria-label="Close video"
            >
              ×
            </button>
            <Image field={thumbnail} className="w-full rounded" />
          </div>
        </div>
      ) : null}
    </>
  );
}
