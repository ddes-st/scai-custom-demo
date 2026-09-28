'use client';
import { useEffect, useState } from 'react';
import { DEBOUNCE_MS } from './constants';

/**
 * Returns a value that trails the input by `delay` ms. The search query is
 * derived from this, so the search API is called once per pause in typing —
 * never per keystroke, and never via a router navigation.
 */
export const useDebouncedValue = <T>(value: T, delay: number = DEBOUNCE_MS): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
};
