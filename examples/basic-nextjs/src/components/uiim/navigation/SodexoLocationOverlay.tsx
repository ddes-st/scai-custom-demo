'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { filterLocationMatches, SODEXO_ACTIVE_COUNTRY, SODEXO_LOCATION_REGIONS } from '@/lib/sodexo-locations';

type SodexoLocationOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export const SodexoLocationOverlay = ({ open, onClose }: SodexoLocationOverlayProps) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const matches = useMemo(() => filterLocationMatches(query), [query]);
  const matchSet = useMemo(() => new Set(matches.map((name) => name.toLowerCase())), [matches]);
  const hasQuery = query.trim().length > 0;
  const resultLabel = matches.length === 1 ? '1 result' : `${matches.length} results`;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-white [&_a]:cursor-pointer [&_button]:cursor-pointer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sodexo-location-title"
    >
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <div>
            <h2
              id="sodexo-location-title"
              className="text-3xl font-bold sm:text-4xl"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
              }}
            >
              Select your location
            </h2>
            <p
              className="mt-3 text-sm"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
              }}
            >
              You will be redirected to Sodexo local website
            </p>
          </div>

          <div className="relative">
            <label className="sr-only" htmlFor="sodexo-location-search">
              Type in your location
            </label>
            <div
              className="flex h-12 items-center rounded-full border bg-white px-5"
              style={{ borderColor: 'var(--brand-primary, #283897)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-fg, #2a295c)"
                strokeWidth="2"
                className="shrink-0 opacity-70"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="sodexo-location-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type in your location"
                className="h-full w-full bg-transparent px-3 text-sm outline-none"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                }}
              />
              {hasQuery && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear location search"
                  className="flex h-6 w-6 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
                  style={{ color: 'var(--brand-fg, #2a295c)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            {hasQuery && (
              <p
                className="mt-3 text-sm"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                }}
              >
                {resultLabel}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close location selector"
          className="fixed right-6 top-8 z-[81] flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70 sm:right-10"
          style={{ color: 'var(--brand-fg, #2a295c)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {SODEXO_LOCATION_REGIONS.map((region) => (
            <section key={region.name}>
              <h3
                className="mb-5 text-2xl font-bold"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
                }}
              >
                {region.name}
              </h3>
              <ul className="flex flex-col gap-3">
                {region.countries.map((country) => {
                  const isMatch = hasQuery && matchSet.has(country.toLowerCase());
                  const isActive = country === SODEXO_ACTIVE_COUNTRY;
                  return (
                    <li key={country}>
                      <button
                        type="button"
                        disabled={!isActive}
                        className="flex w-full items-center justify-between gap-4 text-left text-sm transition-opacity disabled:cursor-default"
                        style={{
                          color: isMatch
                            ? 'var(--brand-accent, #da2020)'
                            : 'var(--brand-fg, #2a295c)',
                          fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                        }}
                      >
                        <span>{country}</span>
                        <span aria-hidden style={{ color: isMatch ? 'var(--brand-accent, #da2020)' : 'inherit' }}>
                          →
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
