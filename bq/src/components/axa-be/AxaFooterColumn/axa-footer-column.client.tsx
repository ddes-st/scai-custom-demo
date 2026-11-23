'use client';

import { useState, type ReactNode } from "react";

interface FooterColumnChromeProps {
  title: ReactNode;
  children: ReactNode;
}

export default function FooterColumnChrome({ title, children }: FooterColumnChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-6 font-semibold max-lg:hidden">{title}</div>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold leading-6"
        >
          {title}
          <span
            aria-hidden="true"
            className={`ml-4 text-2xl leading-none transition-transform ${open ? "rotate-180" : ""}`}
          >
           ⌄
          </span>
        </button>
        <div className={open ? "block" : "hidden"}>{children}</div>
      </div>
      <div className="hidden lg:block">{children}</div>
    </>
  );
}
