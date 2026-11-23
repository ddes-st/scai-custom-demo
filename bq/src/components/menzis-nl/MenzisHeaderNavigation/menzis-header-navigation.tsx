'use client';

import React, { JSX, useState } from 'react';
import { Image } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

type MenuLink = { label: string; href: string };
type MenuColumn = { title: string; links: MenuLink[] };
type MenuGroup = { label: string; columns: MenuColumn[] };
type Fields = {
  Logo: ImageField;
  'Context Links': Field<string>;
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Description': Field<string>;
  'Search Placeholder': Field<string>;
};
type Props = ComponentWithContextProps & { fields: Fields };

const parse = <T,>(field: Field<string> | undefined, fallback: T): T => {
  try {
    return JSON.parse(String(field?.value || '')) as T;
  } catch {
    return fallback;
  }
};

export const Default = (props: Props): JSX.Element => {
  const fields = props.fields;
  const [contextOpen, setContextOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const contextLinks = parse<MenuLink[]>(fields?.['Context Links'], []);
  const menuGroups = parse<MenuGroup[]>(fields?.['Menu Groups'], []);
  const toggleGroup = (index: number): void =>
    setActiveGroup((current: number | null) => (current === index ? null : index));

  return (
    <header className="relative z-30 w-full bg-white text-[#043572] shadow-sm">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="grid min-h-[126px] grid-cols-[auto_1fr] grid-rows-[56px_70px] items-center">
          <div className="relative self-stretch pt-2">
            <button
              type="button"
              aria-expanded={contextOpen}
              aria-haspopup="true"
              onClick={() => setContextOpen((value: boolean) => !value)}
              className="flex items-center py-4 text-sm font-medium md:text-base"
            >
              Voor consumenten
              <span
                aria-hidden="true"
                className="ml-2 inline-block h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-[#043572]"
              />
            </button>
            {contextOpen ? (
              <div className="absolute left-0 top-[54px] z-[790] min-w-[240px] rounded-2xl border border-[#abcffc] bg-white p-4 shadow-xl">
                <nav aria-label="Context selector">
                  <ul className="list-none space-y-1">
                    {contextLinks.map((link: MenuLink) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="flex items-center gap-3 px-2 py-2 text-sm hover:underline"
                        >
                          <span className="text-lg text-[#075ed4]">›</span>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-4 self-stretch border-b border-[#c1d8f0]">
            <button
              type="button"
              className="hidden rounded-lg border border-[#043572] px-4 py-2 text-sm font-bold lg:inline-flex"
              onClick={() => setSearchOpen(true)}
            >
              ⌕&nbsp; Zoeken
            </button>
            <a
              href="https://www.menzis.nl/oauth/login?returnUrl=%2f"
              className="hidden rounded-lg bg-[#043572] px-5 py-3 text-sm font-bold text-white lg:inline-flex"
            >
              ◉&nbsp; Inloggen
            </a>
          </div>
          <div className="relative z-10 self-end">
            <a href="https://www.menzis.nl/" aria-label="Naar de homepage" className="block">
              <Image field={fields?.Logo} />
            </a>
          </div>
          <div className="flex items-center justify-end gap-2 self-end pb-2 lg:pb-0">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Sluit menu' : 'Open menu'}
              onClick={() => setMenuOpen((value: boolean) => !value)}
              className="flex h-12 min-w-12 flex-col items-center justify-center rounded-lg border border-[#043572] lg:hidden"
            >
              <span className="text-2xl leading-4">{menuOpen ? '×' : '☰'}</span>
              <span className="text-[11px] font-bold">menu</span>
            </button>
            <nav
              className={`${menuOpen ? 'fixed' : 'hidden'} inset-x-0 top-[126px] z-40 min-h-[calc(100vh-126px)] overflow-y-auto bg-gradient-to-b from-[#f0f7fe] to-white px-5 pb-10 pt-4 lg:static lg:block lg:min-h-0 lg:overflow-visible lg:bg-none lg:p-0`}
              aria-label="Hoofdmenu"
            >
              <a href="https://www.menzis.nl/" className="mb-3 block text-sm font-medium lg:hidden">
                ⌂&nbsp; Terug naar de homepage
              </a>
              <ul className="list-none flex flex-col lg:flex-row lg:items-end lg:gap-1">
                {menuGroups.map((group: MenuGroup, index: number) => (
                  <li key={group.label} className="border-b border-[#abcffc] lg:border-0">
                    <button
                      type="button"
                      aria-expanded={activeGroup === index}
                      onClick={() => toggleGroup(index)}
                      className="flex w-full items-center justify-between rounded-lg px-4 py-4 text-left text-base font-medium lg:h-[50px] lg:w-auto lg:px-4 lg:py-2"
                    >
                      {group.label}
                      <span
                        className={`${activeGroup === index ? 'rotate-[225deg]' : 'rotate-45'} inline-block h-2.5 w-2.5 border-b-2 border-r-2 border-[#043572] transition-transform`}
                      />
                    </button>
                    {activeGroup === index ? (
                      <div className="grid gap-6 px-4 pb-5 pt-2 lg:absolute lg:right-0 lg:top-[126px] lg:z-50 lg:min-w-[900px] lg:grid-cols-3 lg:bg-white lg:p-14 lg:shadow-2xl">
                        {group.columns.map((column: MenuColumn) => (
                          <section key={column.title}>
                            <h2 className="mb-3 text-lg font-bold">{column.title}</h2>
                            <ul className="list-none space-y-2">
                              {column.links.map((link: MenuLink) => (
                                <li key={link.label}>
                                  <a href={link.href} className="text-sm hover:underline">
                                    {link.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </nav>
            <button
              type="button"
              aria-label="Zoeken"
              onClick={() => setSearchOpen(true)}
              className="flex h-12 min-w-12 flex-col items-center justify-center rounded-lg border border-[#043572] lg:hidden"
            >
              <span className="text-2xl leading-4">⌕</span>
              <span className="text-[11px] font-bold">Zoeken</span>
            </button>
          </div>
        </div>
      </div>
      {searchOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-black/60 p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-label="Zoeken"
        >
          <div className="mx-auto mt-10 max-w-[1180px] rounded-xl bg-gradient-to-b from-white to-[#f0f7fe] p-6 md:p-12">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => setSearchOpen(false)}
                className="text-3xl"
              >
                ×
              </button>
            </div>
            <h2 className="mb-6 text-2xl font-bold">
              {String(fields?.['Search Heading']?.value || 'Zoek binnen menzis.nl')}
            </h2>
            <form
              action="/zoek-resultaten"
              method="get"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="search"
                name="term"
                placeholder={String(fields?.['Search Placeholder']?.value || '')}
                className="min-h-12 flex-1 rounded border border-[#406391] px-4"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#fec352] px-6 py-3 font-bold text-[#1e1400]"
              >
                Zoeken&nbsp; ›
              </button>
            </form>
            <p className="mt-6 text-sm">{String(fields?.['Search Description']?.value || '')}</p>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Default;
