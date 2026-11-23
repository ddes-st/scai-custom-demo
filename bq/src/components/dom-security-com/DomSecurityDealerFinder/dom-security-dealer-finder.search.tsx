'use client';

import { useState } from 'react';
import type { LinkField } from '@sitecore-content-sdk/nextjs';
import { pushDealerPostalToProfile } from '../_demo/demo-cdp';

type DealerFinderSearchProps = {
  placeholder?: string;
  searchLink?: LinkField;
  ctaText?: string;
};

function resolveSearchHref(searchLink: LinkField | undefined, postal: string): string {
  const value = searchLink?.value;
  const base =
    (typeof value?.href === 'string' && value.href) ||
    (typeof value?.url === 'string' && value.url) ||
    '/find-a-dom-dealer';
  const trimmed = postal.trim();
  if (!trimmed) return base;
  try {
    const abs = base.startsWith('http')
      ? new URL(base)
      : new URL(base, typeof window !== 'undefined' ? window.location.origin : 'https://local.invalid');
    abs.searchParams.set('postal', trimmed);
    if (base.startsWith('http')) return abs.toString();
    return `${abs.pathname}${abs.search}${abs.hash}`;
  } catch {
    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}postal=${encodeURIComponent(trimmed)}`;
  }
}

export default function DealerFinderSearch({
  placeholder,
  searchLink,
  ctaText,
}: DealerFinderSearchProps) {
  const [postal, setPostal] = useState('');
  const label =
    ctaText ||
    (typeof searchLink?.value?.text === 'string' ? searchLink.value.text : '') ||
    'Find a dealer';

  const go = () => {
    const trimmed = postal.trim();
    if (trimmed) {
      pushDealerPostalToProfile(trimmed);
    }
    const href = resolveSearchHref(searchLink, postal);
    if (typeof window !== 'undefined') {
      window.location.assign(href);
    }
  };

  return (
    <div className="relative mt-0">
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={postal}
        onChange={(e) => setPostal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        className="block h-[42px] w-full rounded-[3px] border border-[#cac9c9] bg-white px-[12px] pr-[11rem] font-['Source_Sans_Pro',sans-serif] text-[16px] font-normal text-black outline-none placeholder:text-[#999] focus:border-[#00a0de] lg:h-[50px] lg:px-[19.8px] lg:pr-[12.5rem] lg:text-[19.98px]"
      />
      <button
        type="button"
        onClick={go}
        className="absolute right-0 top-0 inline-flex h-[42px] items-center rounded-[50px] border border-transparent bg-[#d51130] px-5 font-['Source_Sans_Pro',sans-serif] text-[16px] font-normal leading-none text-white no-underline transition-colors hover:bg-[#a50d25] lg:h-[50px] lg:px-5 lg:text-[18px]"
      >
        {label}
        <span aria-hidden="true" className="ml-5 text-[1.35rem] leading-none">
          →
        </span>
      </button>
    </div>
  );
}
