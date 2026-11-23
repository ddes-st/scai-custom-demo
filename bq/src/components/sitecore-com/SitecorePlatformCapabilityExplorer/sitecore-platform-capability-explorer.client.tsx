'use client';

import React, { ReactNode, useEffect, useRef, useState } from 'react';

interface CapabilityChromeProps {
  children: ReactNode;
}

interface CapabilityLabel {
  title: string;
  action: string;
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M12.5 15L7.5 10L12.5 5' : 'M7.5 5L12.5 10L7.5 15'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SitecorePlatformCapabilityExplorerChrome({
  children,
}: CapabilityChromeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [labels, setLabels] = useState<CapabilityLabel[]>([]);

  useEffect(() => {
    const cards = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-capability-card]') ?? [],
    );
    const nextLabels = cards.map((card) => ({
      title: card.dataset.title || '',
      action: card.dataset.action || '',
    }));
    setLabels(nextLabels);
  }, []);

  useEffect(() => {
    const cards = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[data-capability-card]') ?? [],
    );
    cards.forEach((card, index) => {
      const active = index === activeIndex;
      card.hidden = !active;
      card.setAttribute('aria-hidden', String(!active));
    });
  }, [activeIndex, labels.length]);

  const count = labels.length || 5;
  const previousIndex = (activeIndex + count - 1) % count;
  const nextIndex = (activeIndex + 1) % count;
  const selectIndex = (index: number) => setActiveIndex((index + count) % count);

  return (
    <div
      ref={rootRef}
      className="mt-6 flex flex-col gap-2 lg:mt-8 lg:flex-row lg:items-start lg:justify-center"
    >
      <aside className="hidden w-full max-w-sm shrink-0 rounded-xl border border-[#e4e2e8] bg-white/60 p-4 shadow-[0_6px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm lg:flex lg:flex-col xl:max-w-md">
        <div className="border-b border-[#e4e2e8] pb-3 text-center text-lg font-semibold bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent">
          SitecoreAI capabilities
        </div>
        <div
          role="tablist"
          aria-label="SitecoreAI platform capabilities"
          className="flex flex-col gap-2 pt-4"
        >
          {labels.map((label, index) => (
            <button
              key={`${label.title}-${index}`}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              onClick={() => selectIndex(index)}
              className={`relative flex w-full items-start gap-2 rounded-md border p-2 text-left transition ${activeIndex === index ? 'translate-x-1 border-transparent bg-gradient-to-r from-[#f8f0ff] to-[#fff5fa] shadow-[0_2px_8px_rgba(134,41,255,0.12)]' : 'border-[#e4e2e8] bg-white/60'}`}
            >
              <span className="flex min-w-0 flex-col">
                <span
                  className={`text-sm font-semibold leading-5 ${activeIndex === index ? 'bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent' : 'text-[#746f7b]'}`}
                >
                  {label.title}
                </span>
                <span
                  className={`text-xs ${activeIndex === index ? 'text-[#1e1c22]' : 'text-zinc-400'}`}
                >
                  {label.action}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
          <button
            type="button"
            aria-label={`Previous: ${labels[previousIndex]?.title || ''}`}
            onClick={() => selectIndex(previousIndex)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e4e2e8] bg-white text-[#746f7b]"
          >
            <Chevron direction="left" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden px-1">
            {[previousIndex, activeIndex, nextIndex].map((index, position) => (
              <button
                key={`${index}-${position}`}
                type="button"
                aria-current={position === 1 ? 'true' : undefined}
                aria-label={labels[index]?.title || ''}
                onClick={() => selectIndex(index)}
                className={`flex min-w-0 shrink-0 items-center gap-2 rounded-lg border px-2 py-2 ${position === 1 ? 'border-transparent bg-gradient-to-r from-[#f8f0ff] to-[#fff5fa] shadow-sm' : 'border-[#e4e2e8] bg-white opacity-70'}`}
              >
                <span
                  className={`hidden text-left text-xs sm:flex sm:flex-col ${position === 1 ? '' : 'text-[#746f7b]'}`}
                >
                  <span>{labels[index]?.title || ''}</span>
                  <span className="text-zinc-500">{labels[index]?.action || ''}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={`Next: ${labels[nextIndex]?.title || ''}`}
            onClick={() => selectIndex(nextIndex)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e4e2e8] bg-white text-[#746f7b]"
          >
            <Chevron direction="right" />
          </button>
        </div>
        <div className="relative min-h-[280px] sm:min-h-[320px] lg:min-h-[360px]">{children}</div>
        <div className="mt-3 hidden items-center justify-center gap-3 text-sm text-[#746f7b] sm:flex lg:hidden">
          <button
            type="button"
            aria-label={`Previous: ${labels[previousIndex]?.title || ''}`}
            onClick={() => selectIndex(previousIndex)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e2e8] bg-white"
          >
            <Chevron direction="left" />
          </button>
          <span>
            {activeIndex + 1}/{count}
          </span>
          <button
            type="button"
            aria-label={`Next: ${labels[nextIndex]?.title || ''}`}
            onClick={() => selectIndex(nextIndex)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e2e8] bg-white"
          >
            <Chevron direction="right" />
          </button>
        </div>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Now showing: {labels[activeIndex]?.title || ''}
        </div>
      </div>
    </div>
  );
}
