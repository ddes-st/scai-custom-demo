'use client';

import { useState, type ReactNode } from 'react';

type AccordionChromeProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function AccordionChrome({ title, children }: AccordionChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <h3 className="m-0 hidden font-[Source_Sans_Pro] text-[24px] font-semibold leading-8 lg:block">
        {title}
      </h3>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between border-0 border-b border-[#dc dde4] bg-transparent px-0 py-3 text-left font-[Source_Sans_Pro] text-[20px] font-semibold leading-6 text-[#20212c] lg:hidden"
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={`ml-4 inline-block text-[14px] leading-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          ⌄
        </span>
      </button>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>
        {children}
      </div>
    </div>
  );
}
