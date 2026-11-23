'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

type SiteHeaderChromeProps = { children: ReactNode };

export default function SiteHeaderChrome({ children }: SiteHeaderChromeProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-center bg-[#edf5ff] px-6 py-2 text-[12px] lg:justify-between">
        <div className="hidden lg:block" aria-hidden="true" />
        <div className="flex items-center gap-5" aria-hidden="true">
          <span className="h-0.5 w-16 bg-[#00008f]" />
          <span className="h-0.5 w-16 bg-transparent" />
        </div>
      </div>
      <div className="relative">
        {children}
        <button
          type="button"
          aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="absolute right-5 top-1/2 flex h-10 w-8 -translate-y-1/2 items-center justify-center text-xl lg:hidden"
        >
          {menuOpen ? '×' : '☰'}
        </button>
      </div>
      {menuOpen && (
        <div className="border-t border-[#d9d9df] bg-white px-5 py-4 lg:hidden">
          {children}
        </div>
      )}
    </>
  );
}

export const Default = SiteHeaderChrome;
