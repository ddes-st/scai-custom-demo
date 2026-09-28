'use client';
import { useEffect } from 'react';

/**
 * Read a query-string parameter once, for initial-state hydration.
 * SSR-safe: returns the fallback on the server.
 */
export const readUrlParam = (name: string, fallback = ''): string => {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(name) ?? fallback;
};

/**
 * Mirror state into the URL as a write-only reflection via the native
 * history.replaceState — no router navigation, no server round-trip.
 * Empty values remove their parameter. Pass null to disable (editing/preview).
 *
 * Deliberately write-only: nothing subscribes to popstate. Shareable links and
 * refresh-restore come from readUrlParam at mount; back/forward restoration of
 * intermediate states is a non-goal (see spec).
 */
export const useUrlMirror = (params: Record<string, string> | null): void => {
  const serialized = params ? JSON.stringify(params) : null;

  useEffect(() => {
    if (serialized === null || typeof window === 'undefined') return;

    const next = new URLSearchParams(window.location.search);
    for (const [name, value] of Object.entries(JSON.parse(serialized) as Record<string, string>)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }

    const query = next.toString();
    const url = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, '', url);
  }, [serialized]);
};
