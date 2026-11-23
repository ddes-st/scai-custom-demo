'use client';

import { useState, type ReactNode } from "react";

interface HeaderChromeProps {
  children: ReactNode;
  logo: ReactNode;
  insuranceLabel: ReactNode;
  claimsLabel: ReactNode;
  signIn: ReactNode;
  searchPlaceholder?: string;
}

export default function HeaderChrome({ children, logo, insuranceLabel, claimsLabel, signIn, searchPlaceholder }: HeaderChromeProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="relative mt-0 overflow-visible rounded-none bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] lg:mt-2 lg:rounded-xl">
      <div className="flex min-h-14 items-center gap-3 px-5 lg:min-h-12 lg:px-4">
        <a href="/" aria-label="AXA home" className="mr-1 inline-block shrink-0 py-2 lg:mr-3">
          {logo}
        </a>
        <nav aria-label="Hoofdnavigatie" className="hidden items-center gap-5 lg:flex">
          <button type="button" className="relative inline-flex items-center gap-2 px-1 py-[18px] text-sm font-semibold leading-5 text-[#00008f] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#00008f]">
            {insuranceLabel}
          </button>
          <button type="button" className="inline-flex items-center px-1 py-[18px] text-sm font-semibold leading-5 text-[#00008f]">
            {claimsLabel}
          </button>
        </nav>
        <div className="flex-1" />
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-3 lg:max-w-[500px]">
            <input
              type="search"
              autoFocus
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 min-w-0 flex-1 rounded-3xl border border-[#828598] px-4 text-base outline-none focus-visible:outline-2 focus-visible:outline-[#00008f]"
            />
            <button type="button" aria-label="Zoekopdracht sluiten" onClick={() => setSearchOpen(false)} className="px-2 text-xl text-[#00008f]">×</button>
          </div>
        ) : (
          <button type="button" aria-label="Zoekopdracht openen" onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center text-lg text-[#00008f]">⌕</button>
        )}
        <a href="#dialog-user-menu-anonymous-" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#00008f] px-5 text-sm font-semibold text-white lg:min-w-[130px]">
          <span aria-hidden="true">●</span>{signIn}
        </a>
        <button type="button" aria-label="Menu" onClick={() => setMenuOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center text-xl text-[#00008f] lg:hidden">
          {menuOpen ? "×" : "☰"}
        </button>
      </div>
      <div className={`${menuOpen ? "block" : "hidden"} border-t border-[#dcdde4] lg:block`}>
        {children}
      </div>
    </section>
  );
}
