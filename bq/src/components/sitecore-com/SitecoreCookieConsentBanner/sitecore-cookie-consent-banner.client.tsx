'use client';

import React, { JSX, ReactNode, useState } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Message: Field<string>;
  'Privacy Policy': LinkField;
  'Storage Preferences': Field<string>;
  Save: Field<string>;
  'Accept All': Field<string>;
  'Reject Non-Essential': Field<string>;
}

type Props = {
  fields: Fields;
  children: ReactNode;
};

export default function CookieConsentBannerChrome({ fields, children }: Props): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);

  if (!isVisible) {
    return null;
  }

  const closeBanner = () => setIsVisible(false);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie Consent Banner"
      className="fixed bottom-0 left-1/2 z-[50] flex w-[calc(100%-2rem)] max-w-[800px] -translate-x-1/2 flex-col items-center overflow-auto rounded-[12px] bg-white p-6 text-left font-sans text-[18px] leading-[1.25] text-[#1e1c22] shadow-[0_0_16px_rgba(0,0,0,0.2)] md:flex-row"
    >
      <button
        type="button"
        aria-label="Close this consent banner"
        onClick={closeBanner}
        className="absolute right-0 top-0 z-10 m-2 flex h-5 w-5 min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-transparent bg-transparent p-0 text-[#1e1c22] transition-transform duration-200 hover:rotate-90"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" strokeWidth="1" />
          <line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <div className="mb-1 w-full flex-[5_1_0%] md:mb-0">
        <span className="mb-4 block break-words whitespace-pre-line leading-[150%]">
          <Text field={fields.Message} />
        </span>
        <Link
          field={fields['Privacy Policy']}
          className="inline-block text-[#170697] underline transition-colors hover:text-[#2b1aab]"
        />
        <p className="mt-2">
          <button
            type="button"
            aria-expanded={showPreferences}
            onClick={() => setShowPreferences((open) => !open)}
            className="block cursor-pointer text-left text-[#170697] underline transition-colors hover:text-[#2b1aab]"
          >
            <Text field={fields['Storage Preferences']} />
          </button>
        </p>

        {showPreferences ? (
          <div role="group" aria-label="Storage Preferences" className="mt-3">
            <ul className="flex flex-col gap-2 min-[376px]:flex-row min-[376px]:flex-wrap">
              {children}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-wrap justify-end md:ml-2 md:max-w-[30vw] md:min-w-[16em] md:sticky md:top-0">
        <button
          type="button"
          onClick={closeBanner}
          className="my-0.5 w-full rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 text-center font-bold leading-none text-white transition-colors hover:bg-[#7339fb] md:mx-2 md:my-1"
        >
          <Text field={fields.Save} />
        </button>
        <button
          type="button"
          onClick={closeBanner}
          className="my-0.5 w-full rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 text-center font-bold leading-none text-white transition-colors hover:bg-[#7339fb] md:mx-2 md:my-1"
        >
          <Text field={fields['Accept All']} />
        </button>
        <button
          type="button"
          onClick={closeBanner}
          className="my-0.5 w-full rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 text-center font-bold leading-none text-white transition-colors hover:bg-[#7339fb] md:mx-2 md:my-1"
        >
          <Text field={fields['Reject Non-Essential']} />
        </button>
      </div>
    </div>
  );
}
