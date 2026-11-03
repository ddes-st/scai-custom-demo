"use client";
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour for an overlay rendered into document.body: focus moves into it on
 * open (the first focusable element, or `initial`), Tab and Shift+Tab stay inside, Esc closes,
 * the page behind doesn't scroll, and focus returns to what was focused before on close.
 */
export function useDialog(onClose: () => void, initial?: React.RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first = initial?.current ?? root?.querySelector<HTMLElement>(FOCUSABLE) ?? root;
    first?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && (document.activeElement === a || !root.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !root.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
    // once per open dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
