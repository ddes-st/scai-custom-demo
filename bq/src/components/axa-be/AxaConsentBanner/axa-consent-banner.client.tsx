'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

type ConsentBannerChromeProps = {
  children: ReactNode;
};

export default function ConsentBannerChrome({ children }: ConsentBannerChromeProps) {
  const [open, setOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-consent-close]") || target.closest("[data-consent-action]")) {
        setOpen(false);
      }
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);

  if (!open) return null;

  return <div ref={containerRef} className="w-full max-w-[600px]">{children}</div>;
}
