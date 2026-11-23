'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type CardCarouselChromeProps = {
  children: ReactNode;
  /** Extra classes on the scroll track (flex row that holds cards). */
  trackClassName?: string;
  prevLabel?: string;
  nextLabel?: string;
  /**
   * Desktop (`lg+`) becomes a wrapping centered grid (no scroll / no arrows).
   * Below `lg` stays a horizontal carousel — matches InsuranceCategoryGrid screenshots.
   */
  wrapAtLg?: boolean;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Horizontal card carousel chrome: hides native scrollbar, scrolls by card,
 * and shows prev/next arrows only when content overflows.
 * Pass AppPlaceholder output as children from a Server Component parent.
 */
export default function CardCarouselChrome({
  children,
  trackClassName,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  wrapAtLg = false,
}: CardCarouselChromeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [needsNav, setNeedsNav] = useState(false);

  const updateNav = () => {
    const el = trackRef.current;
    if (!el) return;
    // When wrapAtLg, desktop is a grid — never show carousel chrome at lg+
    if (wrapAtLg && typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setNeedsNav(false);
      setCanPrev(false);
      setCanNext(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    const overflow = max > 8;
    setNeedsNav(overflow);
    setCanPrev(overflow && el.scrollLeft > 8);
    setCanNext(overflow && el.scrollLeft < max - 8);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateNav();
    const ro = new ResizeObserver(() => updateNav());
    ro.observe(el);
    for (const child of Array.from(el.children)) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    el.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav);
    const t = window.setTimeout(updateNav, 100);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateNav);
      window.removeEventListener('resize', updateNav);
      window.clearTimeout(t);
    };
  }, [wrapAtLg]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.querySelector(':scope > *') as HTMLElement | null;
    const gap = 30;
    const step = (first?.offsetWidth || Math.round(el.clientWidth * 0.85)) + gap;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const sideBtn =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] transition-opacity lg:flex disabled:pointer-events-none disabled:text-[#dcdde4]';
  const mobileBtn =
    'flex h-10 w-10 items-center justify-center rounded-full border border-[#dcdde4] bg-white text-2xl leading-none text-[#00008f] disabled:pointer-events-none disabled:text-[#dcdde4]';

  const showSideArrows = needsNav && !wrapAtLg;
  const showBottomArrows = needsNav;

  return (
    <div className="relative w-full">
      {showSideArrows ? (
        <button
          type="button"
          aria-label={prevLabel}
          disabled={!canPrev}
          onClick={() => scrollByDir(-1)}
          className={cn(sideBtn, 'left-0 -translate-x-1/2')}
        >
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}

      <div
        ref={trackRef}
        className={cn(
          'flex items-stretch gap-4 scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-5 lg:gap-[30px]',
          wrapAtLg
            ? 'max-lg:snap-x max-lg:snap-mandatory max-lg:overflow-x-auto max-lg:justify-start lg:flex-wrap lg:justify-center lg:overflow-visible lg:snap-none'
            : cn(
                'snap-x snap-mandatory overflow-x-auto',
                needsNav ? 'justify-start' : 'justify-center',
              ),
          trackClassName,
        )}
      >
        {children}
      </div>

      {showSideArrows ? (
        <button
          type="button"
          aria-label={nextLabel}
          disabled={!canNext}
          onClick={() => scrollByDir(1)}
          className={cn(sideBtn, 'right-0 translate-x-1/2')}
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : null}

      {showBottomArrows ? (
        <div className="mt-5 flex justify-center gap-5 lg:hidden">
          <button
            type="button"
            aria-label={prevLabel}
            disabled={!canPrev}
            onClick={() => scrollByDir(-1)}
            className={mobileBtn}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            disabled={!canNext}
            onClick={() => scrollByDir(1)}
            className={mobileBtn}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
