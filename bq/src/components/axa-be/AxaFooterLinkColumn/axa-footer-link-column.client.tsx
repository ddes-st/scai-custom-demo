'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

type FooterLinkColumnChromeProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function FooterLinkColumnChrome({ title, children }: FooterLinkColumnChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        className="flex w-full items-center justify-between py-4 text-left text-base font-semibold leading-6 lg:pointer-events-none lg:cursor-default lg:justify-start lg:py-0 lg:pb-6"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={`ml-4 text-2xl leading-none transition-transform duration-200 lg:hidden ${open ? 'rotate-180' : ''}`}
        >
         ⌄
        </span>
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>{children}</div>
    </div>
  );
}
