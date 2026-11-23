'use client';

import React, { JSX, useMemo, useState } from 'react';
import { ChevronDown, Home, Search, X } from 'lucide-react';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';

type LinkItem = { label: string; href: string };
type Column = { title: string; links: LinkItem[] };
type Group = { label: string; columns: Column[] };

interface Fields {
  'Menu Groups': Field<string>;
  'Search Heading': Field<string>;
  'Search Placeholder': Field<string>;
  'Search Description': Field<string>;
  'Home Link': LinkField;
}

type Props = { fields: Fields };

const value = (field: Field<string> | undefined) => String(field?.value ?? '');
const json = <T,>(field: Field<string> | undefined, fallback: T): T => {
  try {
    return JSON.parse(value(field)) as T;
  } catch {
    return fallback;
  }
};

/**
 * Placeholder chrome for the header menu band child.
 * Full visual fidelity comes from section codegen / build-repair re-emit.
 */
export default function MenuBand({ fields }: Props): JSX.Element {
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const groups = useMemo(() => json<Group[]>(fields['Menu Groups'], []), [fields]);
  const panel = activeGroup === null ? null : groups[activeGroup];

  return (
    <div className="relative w-full font-['Geologica',sans-serif] text-[#043572]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {groups.map((group, i) => (
          <button
            type="button"
            key={`${group.label}-${i}`}
            aria-expanded={activeGroup === i}
            className="flex h-12 items-center gap-2 rounded-lg px-4 text-sm font-medium hover:bg-[#f0f7fe]"
            onClick={() => setActiveGroup(activeGroup === i ? null : i)}
          >
            {group.label}
            <ChevronDown className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          aria-label="Zoeken"
          className="flex h-12 items-center gap-2 rounded-lg border border-[#043572] px-4 text-sm font-bold"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
          Zoeken
        </button>
      </div>
      {panel ? (
        <div className="absolute right-0 top-14 z-40 w-[min(960px,calc(100vw-32px))] rounded-xl bg-white p-8 shadow-2xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
            {panel.columns.map((column, i) => (
              <div key={`${column.title}-${i}`}>
                <h3 className="mb-3 text-lg font-bold">{column.title}</h3>
                <ul className="space-y-2">
                  {column.links.map((link, j) => (
                    <li key={`${link.label}-${j}`}>
                      <a className="text-sm hover:underline" href={link.href}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {searchOpen ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-white/95 p-6 pt-24">
          <div className="w-full max-w-[1180px]">
            <button
              type="button"
              aria-label="Sluiten"
              className="float-right"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="mb-6 pt-4 text-2xl font-bold">{value(fields['Search Heading'])}</h2>
            <form className="flex max-w-3xl flex-col gap-4 sm:flex-row">
              <input
                aria-label="Ik zoek"
                className="min-h-12 flex-1 rounded border border-[#406391] px-4"
                name="term"
                placeholder={value(fields['Search Placeholder'])}
                type="search"
              />
              <button
                className="rounded-lg bg-[#fec352] px-6 py-3 font-bold text-[#1e1400]"
                type="submit"
              >
                Zoeken
              </button>
            </form>
            <p className="mt-6">{value(fields['Search Description'])}</p>
            <a
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium"
              href={fields['Home Link']?.value?.href || '/'}
            >
              <Home className="h-4 w-4" />
              Home
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
