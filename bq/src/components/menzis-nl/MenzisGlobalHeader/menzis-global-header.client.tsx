'use client';

import { useState, JSX } from 'react';
import { Image } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';

interface LinkItem {
  label: string;
  href: string;
}
interface MenuColumn {
  title: string;
  links: LinkItem[];
}
interface MenuGroup {
  label: string;
  columns: MenuColumn[];
}
interface Fields {
  Logo: ImageField;
  'Context Links': Field<string>;
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Description': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Action': Field<string>;
  Login: Field<string>;
  'Login Url': Field<string>;
  'Language Image': ImageField;
}
type Props = { fields: Fields };

const readJson = <T,>(field: Field<string> | undefined, fallback: T): T => {
  try {
    return JSON.parse(String(field?.value ?? '')) as T;
  } catch {
    return fallback;
  }
};

const Chevron = ({ open }: { open: boolean }): JSX.Element => (
  <span
    aria-hidden="true"
    className={`ml-auto inline-block h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-[#043572] transition-transform ${open ? '-rotate-[135deg]' : '-rotate-[45deg]'}`}
  />
);

export default function HeaderNavigationClient(props: Props): JSX.Element {
  const [contextOpen, setContextOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const contextLinks = readJson<LinkItem[]>(props.fields['Context Links'], []);
  const menuGroups = readJson<MenuGroup[]>(props.fields['Menu Groups'], []);

  return (
    <header className="relative z-30 w-full bg-white font-['Geologica',sans-serif] text-[#043572]">
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="grid min-h-[126px] grid-cols-[auto_1fr] grid-rows-[56px_48px] items-center">
          <div className="relative row-start-1 flex h-14 items-center">
            <button
              type="button"
              aria-label="Knop context selector"
              aria-expanded={contextOpen}
              onClick={() => setContextOpen(!contextOpen)}
              className="flex items-center gap-2 px-1 py-4 text-base font-medium text-[#043572]"
            >
              Voor consumenten <Chevron open={contextOpen} />
            </button>
            {contextOpen ? (
              <div className="absolute left-0 top-[64px] z-[790] min-w-60 rounded-2xl border border-[#abcffc] bg-white p-4 shadow-[0_16px_32px_-4px_rgba(0,47,108,.1)]">
                <nav aria-label="Context selector">
                  <ul className="list-none space-y-1">
                    {contextLinks.map((link: LinkItem) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="flex items-center gap-3 px-2 py-1.5 text-[#043572] hover:underline"
                        >
                          <span className="text-xl text-[#075fd4]">›</span>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            ) : null}
          </div>
          <div className="row-start-1 flex items-center justify-end gap-4">
            <Image field={props.fields['Language Image']} />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden rounded-lg px-4 py-2.5 font-bold shadow-[inset_0_0_0_1px_#043572] lg:flex"
            >
              ⌕&nbsp; Zoeken
            </button>
            <a
              href={String(props.fields['Login Url']?.value ?? '')}
              className="hidden rounded-lg bg-[#043572] px-5 py-3 font-bold text-white lg:flex"
            >
              ♙&nbsp; {String(props.fields.Login?.value ?? '')}
            </a>
          </div>
          <a href="/" className="row-start-2 self-start">
            <Image field={props.fields.Logo} />
          </a>
          <div className="row-start-2 flex justify-end">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-[#043572] lg:hidden"
            >
              <span className="block h-0.5 w-5 bg-[#043572]" />
              <span className="my-1 block h-0.5 w-5 bg-[#043572]" />
              <span className="block h-0.5 w-5 bg-[#043572]" />
              <span className="sr-only">Menu</span>
            </button>
            <div
              className={`${menuOpen ? 'block' : 'hidden lg:block'} absolute left-0 right-0 top-[104px] z-30 bg-gradient-to-b from-[#f0f7fe] to-white px-4 pb-8 pt-4 lg:static lg:bg-none lg:p-0`}
            >
              <nav aria-label="Hoofdmenu">
                <a href="/" className="mb-2 block px-4 py-3 text-sm font-medium lg:hidden">
                  ⌂&nbsp; Terug naar de homepage
                </a>
                <ul className="list-none flex flex-col lg:flex-row lg:justify-end lg:gap-1">
                  {menuGroups.map((group: MenuGroup) => {
                    const expanded = openGroup === group.label;
                    return (
                      <li
                        key={group.label}
                        className="relative border-b border-[#abcffc] lg:border-0"
                      >
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpenGroup(expanded ? null : group.label)}
                          className={`flex w-full items-center px-4 py-4 text-left text-base font-medium lg:w-auto lg:rounded-lg ${expanded ? 'bg-[#f0f7fe] text-[#0057c2]' : ''}`}
                        >
                          {group.label}
                          <Chevron open={expanded} />
                        </button>
                        {expanded ? (
                          <div className="grid gap-6 px-4 pb-4 pt-2 lg:absolute lg:right-0 lg:top-[58px] lg:z-40 lg:min-w-[760px] lg:grid-cols-3 lg:bg-white lg:p-12 lg:shadow-[0_16px_32px_-4px_rgba(0,47,108,.16)]">
                            {group.columns.map((column: MenuColumn) => (
                              <div key={column.title}>
                                <h3 className="mb-3 pt-0 text-lg font-bold">{column.title}</h3>
                                <ul className="list-none space-y-2">
                                  {column.links.map((link: LinkItem) => (
                                    <li key={link.label}>
                                      <a
                                        href={link.href}
                                        className="text-sm text-[#043572] hover:underline"
                                      >
                                        {link.label}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
      {searchOpen ? (
        <div
          className="fixed inset-0 z-[790] bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="header-search-form"
        >
          <div className="mx-auto min-h-[360px] bg-gradient-to-b from-white to-[#f0f7fe] p-6 md:p-12">
            <button
              type="button"
              aria-label="Sluiten"
              onClick={() => setSearchOpen(false)}
              className="float-right text-3xl"
            >
              ×
            </button>
            <div className="mx-auto max-w-[1180px] pt-10">
              <h2 className="mb-8 text-2xl font-bold">
                {String(props.fields['Search Heading']?.value ?? '')}
              </h2>
              <form
                action={String(props.fields['Search Action']?.value ?? '')}
                method="get"
                className="flex max-w-3xl flex-col gap-4 sm:flex-row"
              >
                <input
                  type="search"
                  name="term"
                  placeholder={String(props.fields['Search Placeholder']?.value ?? '')}
                  className="min-h-14 flex-1 rounded border border-[#406391] bg-white px-4"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#fec352] px-7 py-4 font-bold text-[#1e1400]"
                >
                  Zoeken ›
                </button>
              </form>
              <p className="mt-6">{String(props.fields['Search Description']?.value ?? '')}</p>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
