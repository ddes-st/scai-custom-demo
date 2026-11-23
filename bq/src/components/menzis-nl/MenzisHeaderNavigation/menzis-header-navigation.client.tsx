'use client';

import React, { JSX, useState } from 'react';
import { Image, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';

interface MenuLink {
  label: string;
  href: string;
}
interface MenuColumn {
  title: string;
  links: MenuLink[];
  action?: MenuLink;
}
interface MenuGroup {
  title: string;
  columns: MenuColumn[];
}
interface ContextLink {
  label: string;
  href: string;
}
interface Fields {
  Logo: ImageField;
  Flag: ImageField;
  'Home Link': LinkField;
  'Login Link': LinkField;
  'Context Links': Field<string>;
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Body': Field<string>;
}
type Props = { fields: Fields };

const parse = <T,>(field: Field<string> | undefined, fallback: T): T => {
  try {
    return JSON.parse(String(field?.value || '')) as T;
  } catch {
    return fallback;
  }
};

const Icon = ({ children }: { children: string }): JSX.Element => (
  <span aria-hidden="true" className="inline-block w-5 text-center">
    {children}
  </span>
);

export default function MenzisGlobalHeaderNavigationClient(props: Props): JSX.Element {
  const [contextOpen, setContextOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const contexts = parse<ContextLink[]>(props.fields['Context Links'], []);
  const groups = parse<MenuGroup[]>(props.fields['Menu Groups'], []);
  return (
    <header className="relative z-50 w-full bg-white font-['Geologica',Arial,sans-serif] text-[#043572] shadow-sm">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="flex h-14 items-center justify-between border-b border-[#c1d8f0]">
          <div className="relative">
            <button
              type="button"
              aria-expanded={contextOpen}
              aria-label="Knop context selector"
              onClick={() => setContextOpen(!contextOpen)}
              className="flex items-center gap-2 py-4 text-sm font-medium text-[#043572]"
            >
              Voor consumenten <span className={contextOpen ? 'rotate-180' : ''}>⌄</span>
            </button>
            {contextOpen ? (
              <div className="absolute left-0 top-14 z-[60] min-w-[250px] rounded-2xl border border-[#abcffc] bg-white p-4 shadow-xl">
                <button
                  type="button"
                  aria-label="Sluit context selector"
                  onClick={() => setContextOpen(false)}
                  className="absolute right-3 top-3 text-[#043572]"
                >
                  ×
                </button>
                <nav className="mt-5 space-y-1">
                  {contexts.map((link: ContextLink, index: number) => (
                    <a
                      key={`${link.label}-${index}`}
                      href={link.href}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#043572] hover:underline"
                    >
                      <Icon>→</Icon>
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <Image field={props.fields.Flag} />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden rounded-lg border border-[#043572] px-4 py-2 text-sm font-bold md:flex"
            >
              ⌕ Zoeken
            </button>
            <Link
              field={props.fields['Login Link']}
              className="hidden items-center rounded-lg bg-[#043572] px-4 py-2 text-sm font-bold text-white md:flex"
            />
          </div>
        </div>
        <div className="flex h-20 items-center justify-between">
          <Link field={props.fields['Home Link']} className="relative z-10">
            <Image field={props.fields.Logo} />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Zoeken"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#043572] md:hidden"
            >
              ⌕
            </button>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label="knop hoofdmenu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-12 min-w-12 flex-col items-center justify-center rounded-lg border border-[#043572] lg:hidden"
            >
              {menuOpen ? '×' : '☰'}
              <span className="mt-0.5 text-[11px] font-bold">menu</span>
            </button>
          </div>
        </div>
        <nav
          aria-label="Hoofdmenu"
          className={`${menuOpen ? 'block' : 'hidden'} absolute left-0 right-0 top-[136px] z-40 max-h-[calc(100vh-136px)] overflow-y-auto bg-gradient-to-b from-[#f0f7fe] to-white px-4 py-4 lg:static lg:block lg:max-h-none lg:overflow-visible lg:bg-transparent lg:px-0 lg:py-0`}
        >
          <Link
            field={props.fields['Home Link']}
            className="mb-2 flex items-center gap-2 py-3 text-sm font-medium lg:hidden"
          />
          <div className="flex flex-col lg:flex-row lg:justify-end">
            {groups.map((group: MenuGroup, index: number) => (
              <div key={`${group.title}-${index}`} className="relative lg:static">
                <button
                  type="button"
                  aria-expanded={activeGroup === index}
                  onClick={() => setActiveGroup(activeGroup === index ? null : index)}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-4 text-left text-base font-medium lg:w-auto lg:px-4 lg:py-3"
                >
                  <span>{group.title}</span>
                  <span>{activeGroup === index ? '⌃' : '⌄'}</span>
                </button>
                {activeGroup === index ? (
                  <div className="grid gap-6 border-t border-[#abcffc] px-4 pb-6 pt-3 lg:absolute lg:right-0 lg:top-14 lg:z-50 lg:min-w-[900px] lg:grid-cols-3 lg:rounded-lg lg:border-0 lg:bg-[#f0f7fe] lg:p-10 lg:shadow-2xl">
                    {group.columns.map((column: MenuColumn, columnIndex: number) => (
                      <section key={`${column.title}-${columnIndex}`}>
                        <h2 className="mb-3 pt-1 text-lg font-bold">{column.title}</h2>
                        <div className="space-y-1">
                          {column.links.map((link: MenuLink, linkIndex: number) => (
                            <a
                              key={`${link.label}-${linkIndex}`}
                              href={link.href}
                              className="flex items-center gap-2 py-1 text-[15px] leading-6 text-[#043572] hover:underline"
                            >
                              <Icon>→</Icon>
                              {link.label}
                            </a>
                          ))}
                        </div>
                        {column.action ? (
                          <a
                            href={column.action.href}
                            className="mt-4 inline-block rounded-lg bg-[#fec352] px-5 py-3 text-sm font-bold text-[#1e1400]"
                          >
                            {column.action.label}
                          </a>
                        ) : null}
                      </section>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </nav>
      </div>
      {searchOpen ? (
        <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => setSearchOpen(false)}>
          <div
            className="min-h-[360px] bg-gradient-to-b from-white to-[#f0f7fe] p-6 md:p-12"
            onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={() => setSearchOpen(false)}
              className="float-right"
            >
              ×
            </button>
            <h2 className="pt-8 text-2xl font-bold">
              {String(props.fields['Search Heading']?.value || '')}
            </h2>
            <form
              action="/zoek-resultaten"
              method="get"
              className="mt-6 flex max-w-3xl flex-col gap-4 sm:flex-row"
            >
              <input
                name="term"
                type="search"
                placeholder={String(props.fields['Search Placeholder']?.value || '')}
                className="min-h-14 flex-1 rounded border border-[#406391] bg-white px-4 text-[#043572]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#fec352] px-6 py-3 font-bold text-[#1e1400]"
              >
                Zoeken →
              </button>
            </form>
            <p className="mt-6 text-sm">{String(props.fields['Search Body']?.value || '')}</p>
          </div>
        </div>
      ) : null}
    </header>
  );
}
