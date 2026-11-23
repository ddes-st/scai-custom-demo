'use client';

import { useState, type ReactNode } from 'react';

type FooterLinkGroupChromeProps = {
  title: ReactNode;
  children: ReactNode;
  isSocial?: boolean;
};

export default function FooterLinkGroupChrome({ title, children, isSocial = false }: FooterLinkGroupChromeProps) {
  const [open, setOpen] = useState(false);

  if (isSocial) {
    return (
      <div className="footer__menu footer__menu--icons">
        <div className="mb-6 hidden text-base font-semibold lg:block">{title}</div>
        <div className="footer__menu__items">{children}</div>
      </div>
    );
  }

  return (
    <div className="footer__menu">
      <h3 className="footer__menu__title mb-0 flex items-center justify-between text-base font-semibold lg:mb-6">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold lg:block lg:p-0"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <span aria-hidden="true" className={`ml-4 inline-block text-xl transition-transform lg:hidden ${open ? 'rotate-180' : ''}`}>
           ⌄
          </span>
        </button>
      </h3>
      <div className={`${open ? 'block' : 'hidden'} lg:block`}>{children}</div>
    </div>
  );
}
