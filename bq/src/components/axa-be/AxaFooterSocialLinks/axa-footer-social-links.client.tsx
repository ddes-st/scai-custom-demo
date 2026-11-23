'use client';

import { useState } from 'react';

type FooterColumnChromeProps = {
  title: React.ReactNode;
  children: React.ReactNode;
};

export default function FooterColumnChrome({
  title,
  children,
}: FooterColumnChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex-grow px-[15px] max-md:border-b max-md:border-white/20 max-md:px-0">
      <div className="mb-6 text-base font-semibold max-md:mb-0">
        <div className="hidden max-md:block">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold leading-6"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span>{title}</span>
            <span
              aria-hidden="true"
              className={`text-2xl leading-none transition-transform ${open ? 'rotate-180' : ''}`}
            >
             ⌄
            </span>
          </button>
          <div className={open ? 'block' : 'hidden'}>{children}</div>
        </div>
        <div className="max-md:hidden">{title}</div>
      </div>
      <div className="hidden md:max-lg:hidden lg:block">{children}</div>
    </section>
  );
}
