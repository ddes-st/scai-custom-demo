"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "components/lib/utils";

type NavMegaColumnChromeProps = {
  title: ReactNode;
  titleText: string;
  children: ReactNode;
};

/**
 * Desktop: red column title always visible.
 * Mobile (inside Products drill-down): accordion with blue chevron.
 */
export default function NavMegaColumnChrome({
  title,
  titleText,
  children,
}: NavMegaColumnChromeProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const label = titleText.trim();
  const hasTitle = Boolean(label || title);

  return (
    <div className="px-0 font-[Source_Sans_Pro] text-[14px] text-[#333] lg:border-r lg:border-[#e3e2e2] lg:px-4 lg:last:border-r-0">
      {hasTitle ? (
        <>
          <h3 className="m-0 mb-0 text-[15px] font-semibold text-[#d51130] max-lg:hidden lg:mb-6">
            {label || title}
          </h3>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between py-2 text-left text-[1.28rem] font-light leading-normal text-black lg:hidden",
            )}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span>{label || title}</span>
            <span aria-hidden="true" className="ml-2 text-[0.85rem] text-[#00a0de]">
              {open ? "↑" : "↓"}
            </span>
          </button>
        </>
      ) : null}
      {/* Untitled columns still show links (always on desktop; always on mobile if no title). */}
      <div
        id={panelId}
        className={cn(!hasTitle || open ? "block" : "hidden", "lg:block")}
      >
        {children}
      </div>
    </div>
  );
}
