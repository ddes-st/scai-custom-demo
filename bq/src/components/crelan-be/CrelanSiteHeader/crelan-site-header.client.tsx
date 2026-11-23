'use client';

import React, { JSX, useState } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import { ChevronDown, ChevronRight, Menu, Search, User, X } from 'lucide-react';

export interface Fields {
  Logo: ImageField;
  'Home Link': LinkField;
  'Site Links': Field<string>;
  Categories: Field<string>;
  'Language Links': Field<string>;
  'Current Language': Field<string>;
  'Search Label': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Action': Field<string>;
  'Sign In Link': LinkField;
  'Become Customer Link': LinkField;
  'Office Finder Link': LinkField;
  'Contact Link': LinkField;
  'Jobs Link': LinkField;
}

type Category = {
  label?: string;
  href?: string;
  items?: { label?: string; href?: string }[];
};

type SimpleLink = { text?: string; url?: string };

const parseJson = <T,>(field: Field<string> | undefined, fallback: T): T => {
  try {
    const value = field?.value;
    const parsed = typeof value === 'string' ? JSON.parse(value) : fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
};

export default function CrelanSiteHeaderChrome({ fields }: { fields: Fields }): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const categories = parseJson<Category[]>(fields.Categories, []);
  const siteLinks = parseJson<SimpleLink[]>(fields['Site Links'], []);
  const languageLinks = parseJson<SimpleLink[]>(fields['Language Links'], []);
  const currentLanguage = String(fields['Current Language']?.value || 'nl');

  const toggleMenu = () => {
    setMenuOpen((open) => !open);
    setActiveCategory(null);
    setActiveItem(null);
  };

  const activeCategoryData = activeCategory === null ? undefined : categories[activeCategory];
  const activeItemData = activeCategoryData?.items?.find((item) => item.label === activeItem);

  return (
    <header className="relative z-[501] w-full bg-white font-['Open_Sans',sans-serif] text-[#3c3c3c] shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="hidden border-b border-[#3c3c3c]/10 py-1.5 lg:block">
        <div className="mx-auto flex max-w-[1336px] items-center gap-4 px-8 text-sm">
          <nav className="mr-auto flex gap-5 font-['CrelanSunset',sans-serif]">
            {siteLinks.map((link, index) => (
              <a
                key={index}
                className={index === 0 ? 'font-medium' : undefined}
                href={link.url || '#'}
              >
                {link.text || ''}
              </a>
            ))}
          </nav>
          <form
            action={String(fields['Search Action']?.value || '')}
            method="get"
            className="flex items-center"
          >
            <label className="sr-only" htmlFor="desktop-search">
              <Text field={fields['Search Label']} />
            </label>
            <input
              id="desktop-search"
              name="keywords"
              placeholder={String(fields['Search Placeholder']?.value || '')}
              className="h-9 w-56 border-0 border-b border-transparent px-1 text-sm outline-none focus:border-[#84bd00]"
            />
            <button
              type="submit"
              aria-label={String(fields['Search Label']?.value || '')}
              className="p-2 text-[#00ae53]"
            >
              <Search size={21} />
            </button>
          </form>
          <div className="relative border-l border-[#e9e9e9] pl-3">
            <button
              type="button"
              aria-expanded={languageOpen}
              onClick={() => setLanguageOpen((open) => !open)}
              className="flex items-center gap-2 font-['CrelanSunset',sans-serif] uppercase"
            >
              {currentLanguage} <ChevronDown size={14} />
            </button>
            {languageOpen && (
              <div className="absolute right-0 top-8 z-20 min-w-36 rounded border border-[#ccc] bg-white p-2 shadow-lg">
                {languageLinks.map((link, index) => (
                  <a key={index} className="block px-3 py-2 text-sm" href={link.url || '#'}>
                    {link.text || ''}
                  </a>
                ))}
              </div>
            )}
          </div>
          <Link
            field={fields['Sign In Link']}
            className="flex items-center gap-2 border-l border-[#e9e9e9] pl-3 font-['CrelanSunset',sans-serif]"
          >
            <User size={19} />
            <span>{fields['Sign In Link']?.value?.text || ''}</span>
          </Link>
        </div>
      </div>
      <div className="mx-auto flex min-h-[61px] max-w-[1336px] items-center px-4 lg:px-8">
        <Link field={fields['Home Link']} className="mr-6 block w-[109px] shrink-0 lg:w-[134px]">
          <Image field={fields.Logo} />
        </Link>
        <nav className="hidden flex-1 items-stretch lg:flex" aria-label="Products navigation">
          {categories.map((category, index) => (
            <div key={index} className="group relative">
              <a
                href={category.href || '#'}
                className="block whitespace-nowrap px-4 py-7 font-['CrelanSunset',sans-serif] text-[#3c3c3c] hover:text-[#00ae53]"
              >
                {category.label || ''}
              </a>
              <div className="invisible absolute left-0 top-full z-[201] w-[min(900px,80vw)] rounded-b-lg bg-white p-7 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,.12)] transition group-hover:visible group-hover:opacity-100">
                <h2 className="mb-4 font-['CrelanSunset',sans-serif] text-xl font-medium">
                  {category.label || ''}
                </h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  {(category.items || []).map((item, itemIndex) => (
                    <a
                      key={itemIndex}
                      href={item.href || category.href || '#'}
                      className="flex items-center gap-2 border-b border-[#3c3c3c]/10 py-3 text-sm hover:text-[#00ae53]"
                    >
                      <span className="text-[#00ae53]">›</span>
                      {item.label || ''}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center lg:hidden">
          <Link
            field={fields['Sign In Link']}
            aria-label="Aanmelden"
            className="flex h-[61px] w-[58px] items-center justify-center"
          >
            <User size={22} />
          </Link>
          <button
            id="mobile-menu-anchor"
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
            className={`flex h-[61px] w-[61px] items-center justify-center ${menuOpen ? 'bg-[#f4f4f4]' : ''}`}
          >
            {menuOpen ? <X size={27} /> : <Menu size={27} />}
          </button>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            field={fields['Become Customer Link']}
            className="rounded-full border-2 border-[#3c3c3c] px-5 py-3 font-['CrelanSunset',sans-serif] text-sm"
          />
          <Link
            field={fields['Office Finder Link']}
            className="rounded-full bg-[#6e5ae6] px-5 py-3 font-['CrelanSunset',sans-serif] text-sm text-white"
          />
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          className="absolute left-0 top-full z-[100] block h-[calc(100vh-61px)] w-full overflow-y-auto border-t-4 border-transparent bg-[#f5f5f5] shadow-[4px_4px_12px_rgba(0,0,0,.1)] lg:hidden"
        >
          <div className="min-h-full bg-[#f5f5f5] pb-56 text-lg">
            <div className="flex gap-4 bg-[#f5f5f5] p-4">
              <button
                type="button"
                className="flex min-h-11 flex-1 items-center justify-between rounded border border-[#d3d3d3] bg-white px-4 py-2 font-['CrelanSunset',sans-serif]"
              >
                Particulieren <ChevronDown size={18} />
              </button>
              <button
                type="button"
                onClick={() => setLanguageOpen((open) => !open)}
                className="flex min-h-11 w-24 items-center justify-between rounded border border-[#d3d3d3] bg-white px-4 py-2 font-['CrelanSunset',sans-serif] uppercase"
              >
                {currentLanguage} <ChevronDown size={18} />
              </button>
            </div>
            {languageOpen && (
              <div className="mx-4 mb-3 rounded border border-[#d3d3d3] bg-white text-base">
                {languageLinks.map((link, index) => (
                  <a key={index} className="block px-4 py-3" href={link.url || '#'}>
                    {link.text || ''}
                  </a>
                ))}
              </div>
            )}
            <div className="bg-white">
              {activeCategory === null ? (
                categories.map((category, index) => (
                  <div key={index} className="border-b border-[#3c3c3c]/10">
                    <button
                      type="button"
                      onClick={() => setActiveCategory(index)}
                      className="flex w-full items-center justify-between px-4 py-4 text-left font-['CrelanSunset',sans-serif]"
                    >
                      {category.label || ''}
                      <ChevronRight size={20} />
                    </button>
                  </div>
                ))
              ) : activeItem === null ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className="flex w-full items-center gap-2 px-4 py-3 font-['CrelanSunset',sans-serif] text-sm underline"
                  >
                    <span>←</span>Alle categorieën
                  </button>
                  <h2 className="px-4 py-3 font-['CrelanSunset',sans-serif] text-xl font-medium">
                    {activeCategoryData?.label || ''}
                  </h2>
                  {(activeCategoryData?.items || []).map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveItem(item.label || null)}
                      className="flex w-full items-center justify-between border-b border-[#3c3c3c]/10 px-4 py-4 text-left"
                    >
                      {item.label || ''}
                      <ChevronRight size={20} className="text-[#00ae53]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setActiveItem(null)}
                    className="flex w-full items-center gap-2 px-4 py-3 font-['CrelanSunset',sans-serif] text-sm underline"
                  >
                    <span>←</span>
                    {activeCategoryData?.label || ''}
                  </button>
                  <h2 className="px-4 py-3 font-['CrelanSunset',sans-serif] text-xl font-medium">
                    {activeItem || ''}
                  </h2>
                  {['Productinformatie', 'Veelgestelde vragen', 'Ontdek meer'].map(
                    (label, index) => (
                      <a
                        key={index}
                        href={activeItemData?.href || '#'}
                        className="flex items-center gap-2 border-b border-[#3c3c3c]/10 px-4 py-3 text-base"
                      >
                        <span className="text-[#00ae53]">›</span>
                        {label}
                      </a>
                    ),
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 bg-[#f5f5f5] px-4 py-5">
              <Link
                field={fields['Contact Link']}
                className="block py-2 font-['CrelanSunset',sans-serif]"
              />
              <Link
                field={fields['Jobs Link']}
                className="block py-2 font-['CrelanSunset',sans-serif]"
              />
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white p-4 shadow-[0_0_20px_rgba(0,0,0,.1)]">
              <div className="flex gap-3">
                <Link
                  field={fields['Become Customer Link']}
                  className="flex-1 rounded-full border-2 border-[#3c3c3c] px-3 py-3 text-center font-['CrelanSunset',sans-serif] text-sm"
                />
                <Link
                  field={fields['Office Finder Link']}
                  className="flex-1 rounded-full bg-[#6e5ae6] px-3 py-3 text-center font-['CrelanSunset',sans-serif] text-sm text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="h-1 bg-[linear-gradient(120deg,#00ae53_0%,#00ae53_33%,#84bd00_33%,#84bd00_67%,#c4d600_67%,#c4d600_100%)]" />
    </header>
  );
}
