'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type CatalogChromeProps = {
  children: ReactNode;
};

export default function CatalogChrome({ children }: CatalogChromeProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[data-insurance-category-toggle]'),
    );

    const toggle = (button: HTMLButtonElement) => {
      const panelId = button.getAttribute('aria-controls');
      const panel = panelId ? root.querySelector<HTMLElement>(`#${panelId}`) : null;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.classList.toggle('is-open', !expanded);
      if (panel) {
        panel.hidden = expanded;
        panel.classList.toggle('is-open', !expanded);
      }
    };

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>('[data-insurance-category-toggle]');
      if (button && root.contains(button)) toggle(button);
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  return (
    <div
      ref={rootRef}
      className="rounded-[12px] bg-[#f2f2f6] px-5 py-0 md:px-5 lg:px-8 lg:pb-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-x-[104px] lg:gap-y-4">
        {children}
      </div>
    </div>
  );
}
