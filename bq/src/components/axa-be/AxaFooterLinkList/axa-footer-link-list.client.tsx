'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

type FooterLinkListChromeProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function FooterLinkListChrome({ title, children }: FooterLinkListChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-6 text-[16px] font-semibold leading-6 max-lg:mb-0 max-lg:px-5 max-lg:py-4">
        <span className="max-lg:hidden">{title}</span>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left font-semibold leading-6 lg:hidden"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{title}</span>
          <span
            aria-hidden="true"
            className={`ml-4 h-3 w-3 rotate-45 border-b-2 border-r-2 border-white transition-transform duration-200 ${open ? 'translate-y-[-2px] rotate-[225deg]' : 'translate-y-[-3px]'}`}
          />
        </button>
      </div>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>{children}</div>
    </>
  );
}
