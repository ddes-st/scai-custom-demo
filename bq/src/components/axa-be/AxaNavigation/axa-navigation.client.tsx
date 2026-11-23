'use client';

import { useEffect, type ReactNode } from 'react';

type NavigationChromeProps = { children: ReactNode };

export default function NavigationChrome({ children }: NavigationChromeProps) {
  useEffect(() => {
    const root = document.querySelector('[data-search-toggle]')?.closest('header');
    if (!root) return;

    const searchToggle = root.querySelector('[data-search-toggle]');
    const searchPanel = root.querySelector<HTMLElement>('[data-search-panel]');
    const searchClose = root.querySelector('[data-search-close]');
    const menuToggle = root.querySelector('[data-menu-toggle]');
    const mobileMenu = root.querySelector<HTMLElement>('[data-mobile-menu]');

    const toggleSearch = () => {
      searchPanel?.classList.toggle('hidden');
      searchPanel?.classList.toggle('flex');
      if (searchPanel && !searchPanel.classList.contains('hidden')) {
        searchPanel.querySelector('input')?.focus();
      }
    };
    const closeSearch = () => {
      searchPanel?.classList.add('hidden');
      searchPanel?.classList.remove('flex');
    };
    const toggleMenu = () => {
      mobileMenu?.classList.toggle('hidden');
      menuToggle?.classList.toggle('bg-[#e2efff]');
    };

    searchToggle?.addEventListener('click', toggleSearch);
    searchClose?.addEventListener('click', closeSearch);
    menuToggle?.addEventListener('click', toggleMenu);
    return () => {
      searchToggle?.removeEventListener('click', toggleSearch);
      searchClose?.removeEventListener('click', closeSearch);
      menuToggle?.removeEventListener('click', toggleMenu);
    };
  }, []);

  return <>{children}</>;
}
