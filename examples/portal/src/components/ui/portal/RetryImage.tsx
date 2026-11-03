"use client";
import React, { useEffect, useRef, useState } from "react";
import { imageFromOrigin } from "src/lib/ch/fileUrl";

/**
 * <img> that retries with a cache-busting query param when loading fails.
 *
 * Signed delivery URLs can 403 transiently right after issuance; the browser then caches the
 * broken image for that exact URL. A retry with a changed query string bypasses that cache
 * entry and succeeds once the signature has propagated.
 */
export function RetryImage({ src: given, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) {
  // the brand book's images (logos, personas, do & don't): on an editing host from the live portal (fileUrl.imageOrigin)
  const src = typeof given === "string" ? imageFromOrigin(given) : given;
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setAttempt(0);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [src]);

  if (!src) return null;
  const effectiveSrc = attempt === 0 ? src : `${src}${String(src).includes("?") ? "&" : "?"}r=${attempt}`;

  return (
    <img
      {...rest}
      alt={alt || ""}
      src={effectiveSrc}
      onError={() => {
        if (attempt < 2) {
          timer.current = window.setTimeout(() => setAttempt((a) => a + 1), 700 * (attempt + 1));
        }
      }}
    />
  );
}
