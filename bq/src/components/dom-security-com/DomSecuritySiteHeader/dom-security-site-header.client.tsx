'use client';

import { useState, type ReactNode } from "react";

interface HeaderChromeProps {
  children: ReactNode;
  productMenu: ReactNode;
  languageOptions: ReactNode;
  searchLabel: string;
}

export default function HeaderChrome({ children, productMenu, languageOptions, searchLabel }: HeaderChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          aria-label="Search"
          onClick={() => setSearchOpen((value) => !value)}
          className="absolute left-[15px] top-[15px] z-20 text-[1.1rem] text-black lg:right-[15px] lg:left-auto lg:top-0 lg:bg-black lg:px-4 lg:py-2 lg:text-white"
        >
          <span aria-hidden="true" className="mr-2 inline-block text-[1.3rem] leading-none">⌕</span>
          <span className="max-lg:hidden">{searchLabel}</span>
        </button>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className="absolute right-[15px] top-[14px] z-20 text-[1.4rem] leading-none text-black lg:hidden"
        >
          <span aria-hidden="true">☰</span>
        </button>
        <div className={`${menuOpen ? "block" : "hidden"} lg:block`}>
          {children}
        </div>
      </div>
      <div className="absolute right-[15px] top-0 z-30 hidden items-stretch lg:flex">
        <div className="relative shrink-0 bg-[#646363] px-3 py-1 text-[0.8rem] uppercase text-white">
          <button type="button" onClick={() => setLanguagesOpen((value) => !value)} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-[0.75em] w-[1em] bg-[#012169] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]" />
            <span>EN</span>
            <span aria-hidden="true">⌄</span>
          </button>
          {languagesOpen ? (
            <div className="absolute left-0 right-auto top-full z-[60] w-max min-w-full border border-[#e5e5e5] bg-white p-0 text-black shadow-none [&_ul]:m-0 [&_ul]:list-none [&_ul]:p-0 [&_a]:block [&_a]:px-3 [&_a]:py-1.5 [&_a]:uppercase [&_a]:no-underline hover:[&_a]:bg-[#f5f5f5]">
              {languageOptions}
            </div>
          ) : null}
        </div>
        <button type="button" onClick={() => setSearchOpen((value) => !value)} className="bg-black px-4 py-2 text-[0.9rem] text-white">
          <span aria-hidden="true" className="mr-2">⌕</span>{searchLabel}
        </button>
      </div>
      {searchOpen ? <div className="absolute left-0 right-0 top-full z-40 bg-black px-6 py-6 text-white"><input autoFocus aria-label={searchLabel} placeholder={searchLabel} className="w-full border-0 bg-black text-[1.5rem] outline-none placeholder:text-[#646363]" /></div> : null}
      <div className={`${productsOpen ? "block" : "hidden"} absolute left-0 right-0 top-full z-20 border-t border-[#e3e3e3] bg-white`}>
        <div className="grid grid-cols-1 lg:grid-cols-3">{productMenu}</div>
      </div>
      <button type="button" aria-label="Products menu" onClick={() => setProductsOpen((value) => !value)} className="sr-only">Products</button>
    </>
  );
}
