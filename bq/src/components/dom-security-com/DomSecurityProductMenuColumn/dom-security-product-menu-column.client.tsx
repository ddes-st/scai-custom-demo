'use client';

import { useState } from "react";
import type { ReactNode } from "react";

type ColumnChromeProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function ColumnChrome({ title, children }: ColumnChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="menu-lvl-container font-light lg:font-normal">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left lg:pointer-events-none lg:block"
      >
        {title}
        <span
          aria-hidden="true"
          className={`ml-2 inline-block text-[0.8rem] text-[#00a0de] transition-transform duration-300 lg:hidden ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>
      <div className={`${open ? "block" : "hidden"} mt-2 lg:block lg:mt-0`}>{children}</div>
    </div>
  );
}
