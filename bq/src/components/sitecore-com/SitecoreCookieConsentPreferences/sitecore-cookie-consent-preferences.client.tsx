'use client';

import React, { JSX, ReactNode, useState } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Message: Field<string>;
  'Privacy Link': LinkField;
  'Storage Preferences Label': Field<string>;
  'Close Label': Field<string>;
  'Dialog Label': Field<string>;
  'Save Label': Field<string>;
  'Accept All Label': Field<string>;
  'Reject Non-Essential Label': Field<string>;
}

type Props = {
  fields: Fields;
  children: ReactNode;
};

export default function CookiePreferencesBannerChrome({
  fields,
  children,
}: Props): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const closeBanner = () => setIsVisible(false);
  const acceptAll = () => setIsVisible(false);
  const rejectNonEssential = () => setIsVisible(false);
  const saveSelections = () => setIsVisible(false);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={fields['Dialog Label']?.value || 'Cookie Consent Banner'}
      className="fixed bottom-0 left-1/2 z-[2147483637] flex w-[calc(100%-2rem)] max-w-[800px] -translate-x-1/2 flex-col items-center overflow-auto rounded-xl bg-white p-6 font-sans text-[18px] leading-[1.25] text-[#1e1c22] shadow-[0_0_1em_rgba(0,0,0,0.2)]"
    >
      <button
        type="button"
        aria-label={fields['Close Label']?.value || 'Close this consent banner'}
        onClick={closeBanner}
        className="absolute right-0 top-0 z-[2] m-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-transparent bg-transparent p-0 text-[#1e1c22] transition-transform duration-200 hover:rotate-90"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
          className="stroke-current"
        >
          <line x1="2" y1="2" x2="18" y2="18" stroke="currentColor" />
          <line x1="2" y1="18" x2="18" y2="2" stroke="currentColor" />
        </svg>
      </button>
      <div className="mb-1 w-full flex-[5_1_0%] text-left">
        <span className="mb-4 block break-words leading-[150%]">
          <Text field={fields.Message} />
        </span>
        <Link
          field={fields['Privacy Link']}
          target="_blank"
          rel="noopener"
          className="inline-block text-[#170697] underline transition-colors hover:text-[#2b1aab]"
        />
        <p className="my-2">
          <button
            type="button"
            aria-expanded={isPreferencesOpen}
            onClick={() => setIsPreferencesOpen((open) => !open)}
            className="block cursor-pointer text-[#170697] underline transition-colors hover:text-[#2b1aab]"
          >
            <Text field={fields['Storage Preferences Label']} />
          </button>
        </p>

        {isPreferencesOpen ? (
          <div role="group" aria-label="Storage Preferences" className="mt-3">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 min-[376px]:flex-row min-[376px]:flex-wrap">
              {children}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-1 flex-wrap justify-end lg:ml-2 lg:max-w-[30vw] lg:min-w-[16em]">
        <button
          type="button"
          onClick={saveSelections}
          className="m-0.5 min-w-[6em] flex-1 rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 font-bold leading-none text-white transition-colors hover:bg-[#7339fb] max-[767px]:mx-auto max-[767px]:w-4/5 max-[767px]:flex-none"
        >
          <Text field={fields['Save Label']} />
        </button>
        <button
          type="button"
          onClick={acceptAll}
          className="m-0.5 min-w-[6em] flex-1 rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 font-bold leading-none text-white transition-colors hover:bg-[#7339fb] max-[767px]:mx-auto max-[767px]:w-4/5 max-[767px]:flex-none"
        >
          <Text field={fields['Accept All Label']} />
        </button>
        <button
          type="button"
          onClick={rejectNonEssential}
          className="m-0.5 min-w-[6em] flex-1 rounded-[1em] border border-white bg-[#5f25e7] px-3 py-2 font-bold leading-none text-white transition-colors hover:bg-[#7339fb] max-[767px]:mx-auto max-[767px]:w-4/5 max-[767px]:flex-none"
        >
          <Text field={fields['Reject Non-Essential Label']} />
        </button>
      </div>
    </div>
  );
}
