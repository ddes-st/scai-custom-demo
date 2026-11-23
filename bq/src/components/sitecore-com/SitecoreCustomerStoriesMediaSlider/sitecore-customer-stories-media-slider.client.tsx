'use client';

import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  CTA: LinkField;
  'Story Controls': Field<string>;
}

type Props = {
  fields: Fields;
  children: ReactNode;
};

type StoryControl = {
  title?: string;
  logo?: string;
  logoAlt?: string;
};

export default function SitecoreCustomerStoriesMediaSliderChrome({ fields, children }: Props) {
  const [active, setActive] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const controls = useMemo(() => {
    try {
      const raw = fields['Story Controls']?.value;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as StoryControl[]) : [];
    } catch {
      return [];
    }
  }, [fields]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-story-index]').forEach((item) => {
      const isActive = Number(item.dataset.storyIndex) === active;
      item.hidden = !isActive;
      item.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }, [active, children]);

  const select = (index: number) => setActive(index);

  return (
    <>
      <div
        className="mb-6 flex flex-wrap justify-center gap-x-5 gap-y-3 lg:hidden"
        role="tablist"
        aria-label="Slide navigation"
      >
        {controls.map((story, index) => (
          <button
            key={`mobile-logo-${index}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => select(index)}
            className={`group flex flex-col items-center justify-center rounded-md transition-all duration-300 ${active === index ? '' : 'opacity-40 hover:opacity-100'}`}
            aria-label={story.title || ''}
          >
            {story.logo ? (
              <img
                src={story.logo}
                alt={story.logoAlt || ''}
                width="100"
                height="48"
                className="h-7 w-auto object-contain"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`mt-1.5 h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${active === index ? 'bg-[#eb001a]' : 'bg-transparent'}`}
            />
          </button>
        ))}
      </div>
      <div
        ref={contentRef}
        className="flex flex-col gap-3 pb-2 lg:hidden"
        role="region"
        aria-label="Customer stories"
      >
        {children}
      </div>
      <div className="mt-4 flex justify-center pb-8 lg:hidden">
        <Link
          field={fields.CTA}
          className="flex items-center rounded-full border border-[#c1bdc7] bg-white px-4 py-2 font-medium"
        />
      </div>
      <div className="hidden gap-4 pb-12 lg:flex lg:items-start">
        <div className="relative w-full lg:w-1/2 xl:w-[60%]">
          <div className="relative overflow-visible rounded-lg" ref={contentRef}>
            {children}
          </div>
          <div
            className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-3"
            role="tablist"
            aria-label="Slide navigation"
          >
            {controls.map((story, index) => (
              <button
                key={`desktop-logo-${index}`}
                type="button"
                role="tab"
                aria-selected={active === index}
                onClick={() => select(index)}
                className={`group flex flex-col items-center justify-center rounded-md transition-all duration-300 ${active === index ? '' : 'opacity-40 hover:opacity-100'}`}
                aria-label={story.title || ''}
              >
                {story.logo ? (
                  <img
                    src={story.logo}
                    alt={story.logoAlt || ''}
                    width="100"
                    height="48"
                    className="h-[22px] w-auto object-contain"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${active === index ? 'bg-[#eb001a]' : 'bg-transparent'}`}
                />
              </button>
            ))}
          </div>
        </div>
        <div
          className="flex w-full flex-col gap-2 lg:w-1/2 xl:w-[40%]"
          role="tablist"
          aria-label="Story titles"
        >
          {controls.map((story, index) => (
            <button
              key={`story-title-${index}`}
              type="button"
              role="tab"
              aria-selected={active === index}
              onClick={() => select(index)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left transition-colors ${active === index ? 'bg-gradient-to-r from-[#ff1f38] to-[#8629ff] text-white' : 'border border-[#e4e2e8] bg-white text-gray-900 hover:bg-purple-50'}`}
            >
              <span className="text-sm font-normal sm:text-lg">{story.title || ''}</span>
            </button>
          ))}
          <Link
            field={fields.CTA}
            className="mt-2 flex w-fit items-center rounded-full border border-[#c1bdc7] bg-white px-4 py-2 font-medium"
          />
        </div>
      </div>
    </>
  );
}
