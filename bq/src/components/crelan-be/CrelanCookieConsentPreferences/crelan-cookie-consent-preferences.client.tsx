'use client';

import { useState, type ReactNode } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field, RichTextField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Logo: ImageField;
  Heading: Field<string>;
  Intro: RichTextField;
  'Privacy Link': LinkField;
  'Categories Heading': Field<string>;
  'Refuse Button': Field<string>;
  'Manage Button': Field<string>;
  'Powered By Logo': ImageField;
  'Powered By Link': LinkField;
}

type Props = {
  fields: Fields;
  categoryItems: ReactNode;
  children: ReactNode;
};

export default function CookieConsentPreferencesChrome({ fields, children }: Props) {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] bg-transparent font-['Open_Sans',sans-serif] text-[16px] text-[#696969]">
      <section
        role="region"
        aria-label="Voorkeur centrum"
        className="absolute left-1/2 top-[5%] flex h-[675px] w-full max-w-[575px] -translate-x-1/2 flex-col overflow-hidden rounded-[2.5px] bg-white shadow-[0_2px_10px_-3px_rgb(153,153,153)] max-[600px]:left-0 max-[600px]:top-0 max-[600px]:h-screen max-[600px]:max-w-none max-[600px]:translate-x-0 max-[600px]:rounded-none"
      >
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#e9e9e9] pl-[30px] max-[600px]:pl-[10px]">
          <div className="flex h-10 w-[120px] items-center justify-center">
            <Image field={fields.Logo} className="block max-h-full max-w-full" />
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={() => setClosed(true)}
            className="absolute right-0 top-[10px] flex h-11 w-11 items-center justify-center border-0 bg-transparent p-0 max-[600px]:right-[17px]"
          >
            <span
              aria-hidden="true"
              className="relative block h-3 w-3 before:absolute before:left-1/2 before:top-0 before:h-3 before:w-px before:-rotate-45 before:bg-[#555] after:absolute after:left-1/2 after:top-0 after:h-3 after:w-px after:rotate-45 after:bg-[#555]"
            />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-[30px] pb-4 pt-[10px] max-[600px]:mx-[3px] max-[600px]:ml-[10px] max-[600px]:w-[calc(100%-23px)] max-[600px]:px-[10px]">
          <h2 className="mb-[10px] mt-[10px] w-full text-left text-base font-bold leading-6 text-[#696969]">
            <Text field={fields.Heading} />
          </h2>
          <div className="mb-[25px] w-full clear-both text-[0.812em] leading-[1.5] text-[#696969]">
            <RichText field={fields.Intro} />
            <Link field={fields['Privacy Link']} className="text-[#3860be] underline" />
          </div>
          <section className="mt-[10px]">
            <h3 className="mb-[10px] w-full pb-[10px] text-base font-bold leading-6 text-[#696969]">
              <Text field={fields['Categories Heading']} />
            </h3>
            <div className="w-full">{children}</div>
          </section>
        </div>
        <footer className="shrink-0 border-t border-[#d8d8d8] bg-white">
          <div className="flex justify-end gap-[10px] px-5 pt-[19px] max-[476px]:flex-col max-[476px]:px-[10px]">
            <button
              type="button"
              onClick={() => setClosed(true)}
              className="rounded-[2px] border border-[#00ae53] bg-[#00ae53] px-[30px] py-3 text-[0.75em] font-bold tracking-[0.08em] text-white max-[476px]:w-full"
            >
              <Text field={fields['Refuse Button']} />
            </button>
            <button
              type="button"
              onClick={() => setClosed(true)}
              className="rounded-[2px] border border-[#00ae53] bg-[#00ae53] px-[30px] py-3 text-[0.75em] font-bold tracking-[0.08em] text-white max-[476px]:w-full"
            >
              <Text field={fields['Manage Button']} />
            </button>
          </div>
          <div className="flex h-[30px] items-center justify-end bg-[#f4f4f4] pr-[10px]">
            <Link
              field={fields['Powered By Link']}
              aria-label="Powered by OneTrust Opent in een nieuw tabblad"
            >
              <Image field={fields['Powered By Logo']} className="h-4 w-[136px]" />
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
