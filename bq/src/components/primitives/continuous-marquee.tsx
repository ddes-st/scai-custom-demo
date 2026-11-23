'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from 'components/lib/utils';
import {
  BAND_LOOP_GAP_PX,
  ensureMarqueeOverflow,
  measureTrackContentWidth,
  syncBandTickerOverflow,
} from './continuous-marquee-dom';

export {
  BAND_LOOP_GAP_PX,
  clearMarqueePads,
  ensureMarqueeOverflow,
  measureTrackContentWidth,
  stripCloneIds,
  syncBandTickerOverflow,
  syncMarqueeClone,
} from './continuous-marquee-dom';

export type ContinuousMarqueeVariant = 'rail' | 'band';

export type ContinuousMarqueeProps = {
  children: ReactNode;
  className?: string;
  trackClassName?: string;
  /**
   * `rail` — logo/badge item row; pads short rails so they always loop (rAF).
   * `band` — announcement/ticker: center when fits; CSS infinite `-50%` loop when overflow.
   */
  variant?: ContinuousMarqueeVariant;
  /** Horizontal speed in CSS pixels per second. */
  speedPxPerSec?: number;
  ariaLabel?: string;
  suppressHydrationWarning?: boolean;
};

const VARIANT_DEFAULTS: Record<
  ContinuousMarqueeVariant,
  { track: string; pad: string; ariaLabel: string; speed: number }
> = {
  rail: {
    track:
      'flex shrink-0 items-center gap-8 sm:gap-10 md:gap-12 xl:gap-14 [&>*]:shrink-0',
    pad: 'py-1 pl-6 sm:pl-7 md:pl-8',
    ariaLabel: 'Logo carousel',
    speed: 34,
  },
  band: {
    track: 'flex shrink-0 items-center gap-0 [&>*]:shrink-0',
    pad: 'py-0 pl-0',
    ariaLabel: 'Announcements',
    speed: 48,
  },
};

/**
 * Continuous horizontal marquee.
 *
 * Band (`variant="band"`): CSS `@keyframes` translate to `-50%` over two equal
 * halves — true infinite loop (no one-shot rAF wrap). Centered + static when text fits.
 * Rail: rAF + DOM pads (logo rows).
 */
export function ContinuousMarquee({
  children,
  className,
  trackClassName,
  variant = 'rail',
  speedPxPerSec,
  ariaLabel,
  suppressHydrationWarning,
}: ContinuousMarqueeProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const overflowingRef = useRef(false);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const [overflowing, setOverflowing] = useState(false);
  const [bandDurationSec, setBandDurationSec] = useState(20);
  const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS.rail;
  const resolvedAria = ariaLabel || defaults.ariaLabel;
  const speed = speedPxPerSec ?? defaults.speed;
  const isBand = variant === 'band';

  const applyRailTransform = useCallback((px: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = px === 0 ? '' : `translate3d(${-px}px,0,0)`;
  }, []);

  const syncTracks = useCallback(() => {
    const viewport = viewportRef.current;
    const source = sourceRef.current;
    const clone = cloneRef.current;
    if (!viewport || !source || !clone) return;

    // Zero-width viewports (Pages editor iframe / display:none ancestors): do not
    // mutate DOM or setState — that busy-loops MutationObserver + layout effects.
    if (viewport.clientWidth <= 0) {
      overflowingRef.current = false;
      offsetRef.current = 0;
      applyRailTransform(0);
      clone.hidden = true;
      clone.replaceChildren();
      setOverflowing((prev) => (prev === false ? prev : false));
      return;
    }

    let next = false;
    if (isBand) {
      next = syncBandTickerOverflow(viewport, source, clone);
      if (next) {
        const half = measureTrackContentWidth(source);
        const duration = Math.max(8, half / Math.max(speed, 1));
        setBandDurationSec((prev) =>
          Math.abs(prev - duration) < 0.05 ? prev : duration,
        );
      }
    } else {
      ensureMarqueeOverflow(viewport, source, clone);
      next =
        (trackRef.current?.scrollWidth ?? 0) > viewport.clientWidth + 1;
    }

    overflowingRef.current = next;
    if (!next) {
      offsetRef.current = 0;
      applyRailTransform(0);
    }
    setOverflowing((prev) => (prev === next ? prev : next));
  }, [applyRailTransform, isBand, speed]);

  useLayoutEffect(() => {
    syncTracks();
  }, [syncTracks]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const source = sourceRef.current;
    if (!viewport || !source) return;

    let syncing = false;
    const sync = () => {
      if (syncing) return;
      syncing = true;
      try {
        syncTracks();
      } finally {
        requestAnimationFrame(() => {
          syncing = false;
        });
      }
    };

    const mo = new MutationObserver((mutations) => {
      const clone = cloneRef.current;
      if (
        mutations.every(
          (m) =>
            m.type === 'childList' &&
            (m.target === clone ||
              Array.from(m.addedNodes).every(
                (n) =>
                  n instanceof HTMLElement &&
                  (n.hasAttribute('data-marquee-pad') ||
                    n.hasAttribute('data-marquee-gap')),
              )),
        )
      ) {
        return;
      }
      sync();
    });
    mo.observe(source, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(sync);
    ro.observe(source);
    ro.observe(viewport);

    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [children, isBand, syncTracks]);

  // Rail only: rAF transform loop. Band uses CSS infinite animation.
  useEffect(() => {
    if (isBand) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;
    let previousTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - previousTime;
      previousTime = time;
      const source = sourceRef.current;

      if (
        !pausedRef.current &&
        !reducedMotion.matches &&
        overflowingRef.current &&
        source
      ) {
        const loopWidth = Math.max(
          source.offsetWidth || 0,
          source.scrollWidth || 0,
        );
        if (loopWidth > 0) {
          offsetRef.current += (elapsed / 1000) * speed;
          if (offsetRef.current >= loopWidth) {
            offsetRef.current %= loopWidth;
          }
          applyRailTransform(offsetRef.current);
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [applyRailTransform, isBand, speed]);

  const rowClass = cn(defaults.track, trackClassName);
  const bandStyle = {
    ['--sc-marquee-duration' as string]: `${bandDurationSec}s`,
  } as CSSProperties;

  return (
    <div
      ref={viewportRef}
      className={cn(
        'w-full min-w-0 overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        isBand && !overflowing && 'flex justify-center',
        className,
      )}
      role="region"
      aria-label={resolvedAria}
      aria-roledescription={overflowing ? 'marquee' : undefined}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      suppressHydrationWarning={suppressHydrationWarning}
    >
      <div
        ref={trackRef}
        className={cn(
          'flex w-max min-w-max shrink-0 items-center',
          isBand && overflowing && 'sc-marquee-track',
        )}
        style={isBand && overflowing ? bandStyle : undefined}
      >
        <div ref={sourceRef} className={cn(rowClass, defaults.pad)}>
          {children}
        </div>
        <div
          ref={cloneRef}
          className={cn(rowClass, defaults.pad)}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default ContinuousMarquee;
