'use client';

import { Children, useState } from 'react';

type HeaderChromeProps = { children: React.ReactNode };

export default function HeaderChrome({ children }: HeaderChromeProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const content = Children.toArray(children);

  return (
    <div className={`${mobileOpen ? 'mobile-menu-open' : ''} ${productsOpen ? 'products-open' : ''} [&.mobile-menu-open_.navbar-navigation]:block [&.mobile-menu-open_.navbar-navigation]:absolute [&.mobile-menu-open_.navbar-navigation]:left-0 [&.mobile-menu-open_.navbar-navigation]:right-0 [&.mobile-menu-open_.navbar-navigation]:top-[50px] [&.mobile-menu-open_.navbar-navigation]:z-20 [&.mobile-menu-open_.navbar-navigation]:border-b [&.mobile-menu-open_.navbar-navigation]:border-gray-500 [&.mobile-menu-open_.navbar-navigation]:bg-white [&.products-open_.products-menu]:block [&.products-open_.products-menu]:opacity-100 [&.products-open_.products-menu]:pointer-events-auto`}>
      <div onClick={(event) => {
        const target = event.target as HTMLElement;
        const trigger = target.closest('[data-products-trigger="true"]');
        if (trigger) {
          event.preventDefault();
          setProductsOpen((open) => !open);
        }
      }}>
        {content}
      </div>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={() => { setMobileOpen(false); setProductsOpen(false); }}
        className="absolute right-[30px] top-[20px] z-30 hidden text-2xl lg:hidden"
      >
        ×
      </button>
      <div className="pointer-events-none absolute right-0 top-0 h-[50px] w-[60px] lg:hidden" onClick={() => setMobileOpen((open) => !open)} />
    </div>
  );
}
