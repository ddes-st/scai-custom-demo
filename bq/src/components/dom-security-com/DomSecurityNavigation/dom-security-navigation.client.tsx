"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { LinkField } from "@sitecore-content-sdk/nextjs";
import { cn } from "components/lib/utils";
import {
  CODE_TO_LOCALE,
  extractContentPath,
  localeToCode,
  publicHrefForLocale,
} from "../locale-href.util";
import { navItemClassName } from "./nav-item-styles.util";
import DemoAccountChrome from "../_demo/demo-account-chrome";

type LanguageOption = {
  field: LinkField;
  code: string;
  flag: "gb" | "be";
};

type NavigationChromeProps = {
  overlap: boolean;
  productsLabel: string;
  searchLabel: string;
  beforeProducts: ReactNode;
  afterProducts: ReactNode;
  mega: ReactNode;
  megaFooter: ReactNode;
  languages: LanguageOption[];
};

/** Compact flag marks — real GB/BE icons (capture `.flag-icon`). */
function Flag({ code }: { code: "gb" | "be" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny chip glyph; flagcdn CDN
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      width={14}
      height={10}
      aria-hidden="true"
      className="inline-block h-[0.75em] w-[1em] shrink-0 object-cover"
      loading="lazy"
    />
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-[0.95em] w-[0.95em] shrink-0 fill-current"
    >
      <path d="M11.5 10.4a5.5 5.5 0 1 0-1.1 1.1l3.05 3.05a.75.75 0 1 0 1.06-1.06L11.5 10.4Zm-4.5.85a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
    </svg>
  );
}

/**
 * Mobile drawer + Products mega (desktop panel / mobile drill-down).
 * Desktop language: white on hero-overlap; #646363 on solid/light bars
 * (capture `.navbar.light-bg + .top-links .language-switcher`). Search = black chip.
 */
export default function NavigationChrome({
  overlap,
  productsLabel,
  searchLabel,
  beforeProducts,
  afterProducts,
  mega,
  megaFooter,
  languages,
}: NavigationChromeProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const panelId = useId();
  const langRefDesktop = useRef<HTMLDivElement>(null);
  const langRefMobile = useRef<HTMLDivElement>(null);
  const params = useParams();
  const pathname = usePathname() || "";
  const site = String(params?.site || "domsecurity-com");
  const currentLocale = String(params?.locale || "en");
  const currentCode = localeToCode(currentLocale);
  // Public pathname is often `/homeowners` (site rewritten away); never put site in hrefs.
  const contentPath = extractContentPath(pathname, site);
  const hasProducts = Boolean(productsLabel?.trim());
  const solidBar = navOpen || productsOpen;
  const ink = overlap && !solidBar ? "text-white" : "text-black";
  // Capture default `.language-switcher` is white; only the mobile open chip is translucent.
  const activeLang =
    languages.find((l) => l.code.toLowerCase() === currentCode) ||
    languages.find((l) => /en/i.test(l.code)) ||
    languages[0] ||
    null;

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('[aria-label="Primary"]');
    if (!nav) return;
    nav.dataset.productsOpen = productsOpen ? "true" : "false";
    nav.dataset.navOpen = navOpen ? "true" : "false";
  }, [productsOpen, navOpen]);

  useEffect(() => {
    if (!navOpen && !productsOpen && !langOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        setProductsOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, productsOpen, langOpen]);

  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !langRefDesktop.current?.contains(target) &&
        !langRefMobile.current?.contains(target)
      ) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [langOpen]);

  const languageChip = (
    mobileMenuStyle: boolean,
    ref: RefObject<HTMLDivElement | null>,
  ) =>
    activeLang ? (
      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          className={cn(
            "inline-flex h-[1.85rem] items-center gap-1.5 px-2 text-[0.8rem] font-normal uppercase leading-none",
            mobileMenuStyle
              ? "rounded-[3px] bg-black/50 text-white"
              : "bg-white text-[#4d4d4d]",
          )}
          aria-expanded={langOpen}
          aria-haspopup="listbox"
          onClick={() => setLangOpen((v) => !v)}
        >
          <Flag code={activeLang.flag} />
          <span>{activeLang.code}</span>
          <span
            aria-hidden="true"
            className={cn(
              "ml-0.5 text-[0.5rem] transition-transform",
              mobileMenuStyle ? "text-white" : "text-[#808080]",
              langOpen && "rotate-180",
            )}
          >
            ▾
          </span>
        </button>
        {langOpen ? (
          <ul
            role="listbox"
            className="absolute left-0 right-auto top-full z-[60] m-0 w-max min-w-full list-none border border-[#e5e5e5] bg-white p-0 text-black shadow-none"
          >
            {languages.map((lang) => {
              const targetLocale =
                CODE_TO_LOCALE[lang.code.toLowerCase()] || lang.code;
              const href = publicHrefForLocale(targetLocale, contentPath);
              return (
                <li key={lang.code} role="option">
                  <Link
                    href={href}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[0.8rem] uppercase no-underline hover:bg-[#f5f5f5]"
                    onClick={() => setLangOpen(false)}
                    aria-current={
                      lang.code.toLowerCase() === currentCode
                        ? "true"
                        : undefined
                    }
                  >
                    <Flag code={lang.flag} />
                    <span>{lang.code}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    ) : null;

  const searchChip = (
    <button
      type="button"
      className={cn(
        "inline-flex h-[1.85rem] items-center gap-2 bg-black px-[0.8rem] text-[0.9rem] font-normal leading-none text-white",
        "max-lg:h-auto max-lg:bg-transparent max-lg:px-0 max-lg:text-[1.1rem] max-lg:text-black",
        navOpen && "max-lg:hidden",
      )}
      aria-label={searchLabel || "search"}
    >
      <SearchIcon />
      <span className="max-lg:hidden">{searchLabel}</span>
    </button>
  );

  return (
    <>
      {/* Desktop top-right utilities — capture `.top-links { top: 0; right: 15px }` (flush with logo top, not mid-bar). */}
      <div
        className={cn(
          "pointer-events-auto absolute top-0 z-50 hidden items-start gap-2 lg:flex",
          productsOpen ? "right-[56px]" : "right-[15px]",
        )}
      >
        <DemoAccountChrome />
        {languageChip(false, langRefDesktop)}
        {searchChip}
      </div>

      <button
        type="button"
        className={cn(
          "relative z-[60] ml-auto inline-flex h-10 w-10 items-center justify-center lg:hidden",
          navOpen ? "text-[#d51130]" : ink,
        )}
        aria-label="Toggle navigation"
        aria-expanded={navOpen}
        onClick={() => {
          setNavOpen((open) => !open);
          setProductsOpen(false);
          setLangOpen(false);
        }}
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          {navOpen ? "×" : "☰"}
        </span>
      </button>

      {/* Mobile menu-open language (capture `header.menu-open .language-switcher`) */}
      {navOpen ? (
        <div className="absolute right-4 top-3 z-50 flex max-w-[calc(100%-5rem)] flex-col items-end gap-2 lg:hidden">
          <DemoAccountChrome mobile />
          {languageChip(true, langRefMobile)}
        </div>
      ) : (
        <div className="ml-2 flex items-center gap-2 lg:hidden">
          <DemoAccountChrome className="max-[420px]:hidden" />
          {searchChip}
        </div>
      )}

      <div
        className={cn(
          "basis-full lg:flex lg:flex-1 lg:items-end lg:justify-between lg:pr-[14rem]",
          "[&_a]:transition-colors",
          navOpen
            ? "fixed inset-0 z-40 overflow-y-auto bg-white pt-[4.5rem] text-black shadow-[0_8px_24px_rgba(0,0,0,0.08)] [&_a]:text-black lg:static lg:inset-auto lg:z-auto lg:overflow-visible lg:bg-transparent lg:pt-0 lg:shadow-none"
            : "hidden lg:flex",
          !navOpen &&
            (overlap && !productsOpen
              ? "lg:bg-transparent lg:text-white lg:[&_a]:text-white"
              : "lg:bg-transparent lg:text-black lg:[&_a]:text-black"),
        )}
      >
        {/* L1 list — hidden on mobile while Products drill-down is open */}
        <ul
          className={cn(
            // Desktop li is static (capture `.navbar .nav > li { position: static }`) so
            // the mega panel anchors to the header bar, not under the Products label alone.
            "m-0 flex list-none flex-col gap-0 px-4 p-0 lg:flex-row lg:items-end lg:gap-0 lg:px-0 lg:[&>li]:static",
            productsOpen && "max-lg:hidden",
          )}
        >
          {beforeProducts}
          {hasProducts ? (
            <li>
              <button
                type="button"
                className={cn(
                  // Keep `block` (not inline-flex) so ::after underline stays under the label.
                  navItemClassName,
                  "w-full text-left max-lg:w-full",
                  navOpen || productsOpen ? "text-black" : ink,
                  productsOpen && "font-semibold tracking-[-0.35px] after:w-4",
                )}
                aria-expanded={productsOpen}
                aria-controls={panelId}
                onClick={() => setProductsOpen((open) => !open)}
              >
                <span className="inline-flex w-full items-center justify-between lg:inline">
                  <span>{productsLabel}</span>
                  <span
                    aria-hidden="true"
                    className="ml-3 text-[#00a0de] lg:hidden"
                  >
                    →
                  </span>
                </span>
              </button>
            </li>
          ) : null}
          {afterProducts}
        </ul>

        {/* Products panel: mobile drill-down / desktop mega (full-width under bar) */}
        {hasProducts && mega ? (
          <div
            id={panelId}
            hidden={!productsOpen}
            className={cn(
              productsOpen ? "block" : "hidden",
              "w-full bg-white text-black",
              "max-lg:absolute max-lg:inset-x-0 max-lg:top-[4.5rem] max-lg:bottom-0 max-lg:z-50 max-lg:overflow-y-auto",
              // Capture: `.navbar .dropdown .sub-parent-1` → top 100%, left 0, width 100%.
              // z above logo (z-20) so the brand never paints over the panel.
              "lg:absolute lg:inset-x-0 lg:left-0 lg:right-0 lg:top-full lg:z-[60] lg:w-full lg:max-w-none lg:translate-x-0 lg:shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 bg-[#e3e2e2] px-6 py-[0.8rem] text-left text-[0.9rem] font-normal text-black lg:hidden"
              onClick={() => setProductsOpen(false)}
            >
              <span aria-hidden="true">←</span>
              Back to menu
            </button>
            <div className="border-t border-[#e5e5e5] px-[15px] py-6 max-lg:border-0 max-lg:px-4 max-lg:py-4">
              <div className="grid grid-cols-1 items-stretch gap-0 lg:grid-cols-3 lg:divide-x lg:divide-[#e3e2e2] [&>:nth-child(n+4)]:hidden [&_header]:hidden">
                {mega}
              </div>
              {megaFooter}
            </div>
            <button
              type="button"
              className="absolute top-3 right-3 hidden h-8 w-8 items-center justify-center text-[22px] leading-none text-black lg:inline-flex lg:top-[-80px] lg:right-[8px]"
              aria-label="close"
              onClick={() => setProductsOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
