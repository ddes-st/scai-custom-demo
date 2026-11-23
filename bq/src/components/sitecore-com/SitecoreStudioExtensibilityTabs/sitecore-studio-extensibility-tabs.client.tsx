'use client';

import React, { ReactNode, useEffect, useState } from 'react';

interface ChromeProps {
  children: ReactNode;
}

export default function SitecoreStudioExtensionTabsChrome({ children }: ChromeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-studio-tab]'));
    const nextLabels = roots.map((root) => root.dataset.studioLabel || '').filter(Boolean);
    setLabels(nextLabels);
  }, [children]);

  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-studio-tab]'));
    roots.forEach((root) => {
      const index = Number(root.dataset.studioTab);
      root.hidden = index !== activeIndex;
    });
  }, [activeIndex, children]);

  const count = labels.length || 4;
  const previous = () => setActiveIndex((index) => (index + count - 1) % count);
  const next = () => setActiveIndex((index) => (index + 1) % count);

  return (
    <>
      <div className="hidden flex-col lg:flex">
        <nav
          role="tablist"
          aria-label="Content tabs"
          className="flex flex-wrap justify-center gap-2 border-b border-[#e4e2e8] pb-6 sm:gap-3 lg:pb-10"
        >
          {labels.map((label, index) => (
            <button
              key={`${label}-${index}`}
              id={`tab-${index}`}
              type="button"
              role="tab"
              aria-selected={activeIndex === index}
              aria-controls={`tabpanel-${index}`}
              tabIndex={activeIndex === index ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              className={`relative rounded-[6px] border px-3 py-1.5 text-base font-medium leading-[1.5] shadow-[0_1px_3px_rgba(0,0,0,.06),0_2px_6px_rgba(0,0,0,.03)] transition sm:px-4 sm:py-2 ${activeIndex === index ? 'border-transparent bg-gradient-to-br from-[#f8f0ffb3] to-[#fff5faa6] text-transparent shadow-[0_4px_12px_rgba(134,41,255,.15),0_2px_6px_rgba(255,31,56,.08)]' : 'border-[#e4e2e8] bg-white/50 text-[#746f7b]'}`}
            >
              <span
                className={
                  activeIndex === index
                    ? 'bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent'
                    : ''
                }
              >
                {label}
              </span>
            </button>
          ))}
        </nav>
        <div className="relative grid grid-cols-1 pt-8">{children}</div>
      </div>
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex items-center justify-center">
          <button
            type="button"
            aria-label="Previous"
            onClick={previous}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e4e2e8] bg-white text-[#746f7b] shadow-sm"
          >
            ←
          </button>
          <div className="flex flex-1 items-center justify-center gap-0.5 overflow-hidden px-2">
            <button
              type="button"
              aria-label={labels[(activeIndex + count - 1) % count] || 'Previous'}
              onClick={previous}
              className="scale-90 rounded-lg border border-[#e4e2e8] px-2.5 py-2 text-sm text-[#746f7b] opacity-70"
            >
              {labels[(activeIndex + count - 1) % count] || ''}
            </button>
            <button
              type="button"
              aria-current="true"
              aria-label={labels[activeIndex] || 'Current'}
              onClick={() => setActiveIndex(activeIndex)}
              className="rounded-lg border border-transparent bg-gradient-to-br from-[#f8f0ffd9] to-[#fff5facc] px-2.5 py-2 text-sm font-medium text-transparent shadow-md"
            >
              <span className="bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent">
                {labels[activeIndex] || ''}
              </span>
            </button>
            <button
              type="button"
              aria-label={labels[(activeIndex + 1) % count] || 'Next'}
              onClick={next}
              className="scale-90 rounded-lg border border-[#e4e2e8] px-2.5 py-2 text-sm text-[#746f7b] opacity-70"
            >
              {labels[(activeIndex + 1) % count] || ''}
            </button>
          </div>
          <button
            type="button"
            aria-label="Next"
            onClick={next}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e4e2e8] bg-white text-[#746f7b] shadow-sm"
          >
            →
          </button>
        </div>
        <nav className="flex flex-wrap justify-center gap-2" aria-label="Mobile content tabs">
          {labels.map((label, index) => (
            <button
              key={`${label}-mobile-${index}`}
              type="button"
              aria-selected={activeIndex === index}
              onClick={() => setActiveIndex(index)}
              className="rounded-lg border border-[#e4e2e8] px-2.5 py-2 text-sm"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="overflow-hidden rounded-xl border border-[#e4e2e8] bg-white shadow-[0_6px_24px_rgba(0,0,0,.06)]">
          {children}
        </div>
        <div className="flex items-center justify-center gap-3 py-1 text-sm text-[#746f7b]">
          <button
            type="button"
            aria-label="Previous"
            onClick={previous}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e2e8] bg-white shadow-sm"
          >
            ←
          </button>
          <span className="min-w-8 text-center tabular-nums">
            {activeIndex + 1}/{count}
          </span>
          <button
            type="button"
            aria-label="Next"
            onClick={next}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e2e8] bg-white shadow-sm"
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
