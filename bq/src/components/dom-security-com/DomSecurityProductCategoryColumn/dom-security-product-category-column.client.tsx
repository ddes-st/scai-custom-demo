'use client';

import type { ReactNode } from "react";
import { useState } from "react";

type ProductCategoryColumnChromeProps = {
  title: ReactNode;
  links: ReactNode;
};

export default function ProductCategoryColumnChrome({
  title,
  links,
}: ProductCategoryColumnChromeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left font-[Source_Sans_Pro] text-[1.28rem] font-light leading-normal text-black lg:hidden"
      >
        <span>{title}</span>
        <span
          aria-hidden="true"
          className={`ml-2 text-[0.8rem] text-[#00a0de] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
         ⌄
        </span>
      </button>
      <div className="hidden lg:block">
        <div className="mb-6 text-[1.67rem] font-light leading-8 text-[#d51130]">
          {title}
        </div>
        {links}
      </div>
      <div className={open ? "block lg:hidden" : "hidden lg:hidden"}>{links}</div>
    </div>
  );
}
