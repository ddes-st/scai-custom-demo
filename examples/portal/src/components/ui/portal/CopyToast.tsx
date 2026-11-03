"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useUi } from "src/lib/portal/ui-text-client";

/** Copy-to-clipboard with the design's toast: 1600ms, single timeout, aria-live. */
export function useCopyToClipboard(): { copied: string | null; copy: (value: string) => void } {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const copy = useCallback((value: string) => {
    try {
      void navigator.clipboard?.writeText(value);
    } catch {
      return; // clipboard unsupported/denied — fail silently per spec
    }
    setCopied(value);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  return { copied, copy };
}

export function CopyToast({ copied }: { copied: string | null }) {
  const t = useUi();
  if (!copied) return null;
  return ReactDOM.createPortal(
    <div className="bgl-root">
      <div className="bgd-toast" role="status" aria-live="polite">
        <span className="check">✓</span>
        <span>{t("bbCopied", { value: copied })}</span>
      </div>
    </div>,
    document.body
  );
}
