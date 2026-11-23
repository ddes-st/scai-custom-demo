'use client';

import React, { JSX, useState } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface CookieOptionFields {
  Label: Field<string>;
  Value: Field<string>;
  Help: Field<string>;
}

interface CookieOptionItem {
  id?: string;
  name?: string;
  fields: CookieOptionFields;
}

interface Fields {
  Heading: Field<string>;
  Description: Field<string>;
  'Settings Label': Field<string>;
  'Decline Label': Field<string>;
  'Accept Label': Field<string>;
  'Save Label': Field<string>;
  children?: { results?: CookieOptionItem[] };
}

type Props = { fields: Fields };

const fieldValue = (field: Field<string> | undefined): string => String(field?.value ?? '');

export default function CookiePreferenceModalClient(props: Props): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOption, setSelectedOption] = useState('4');
  const options = props.fields.children?.results ?? [];

  const closeCookies = (): void => {
    setIsOpen(false);
    setShowSettings(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60 px-4 font-['Geologica',Arial,sans-serif] text-[#043572]">
      {!showSettings ? (
        <section
          aria-label="cookiewall"
          aria-modal="true"
          className="relative flex w-full max-w-[60rem] flex-col rounded-[1rem] bg-white px-6 py-6 shadow-[inset_0_0_0_1px_rgb(171,207,252)] md:px-10 md:py-8"
          role="dialog"
        >
          <h3 className="mb-4 pt-2 text-[2rem] font-bold leading-[2.4rem] md:text-[2.2rem] md:leading-[2.8rem]">
            <Text field={props.fields.Heading} />
          </h3>
          <p className="mb-6 text-base leading-6">
            <Text field={props.fields.Description} />
          </p>
          <div className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              className="w-full rounded-[0.8rem] px-5 py-4 text-base font-bold text-[#043572] underline sm:w-auto"
              onClick={() => setShowSettings(true)}
              type="button"
            >
              <Text field={props.fields['Settings Label']} />
            </button>
            <button
              className="w-full rounded-[0.8rem] px-5 py-4 text-base font-bold text-[#043572] underline sm:w-auto"
              onClick={closeCookies}
              type="button"
            >
              <Text field={props.fields['Decline Label']} />
            </button>
            <button
              className="w-full rounded-[0.8rem] bg-[#fec352] px-5 py-4 text-base font-bold leading-[1.8rem] text-[#1e1400] sm:w-auto"
              onClick={closeCookies}
              type="button"
            >
              <Text field={props.fields['Accept Label']} />
            </button>
          </div>
        </section>
      ) : (
        <section
          aria-label="Cookie instellingen"
          aria-modal="true"
          className="relative flex max-h-[90vh] w-full max-w-[60rem] flex-col rounded-[1rem] bg-white shadow-[inset_0_0_0_1px_rgb(171,207,252)] md:max-h-[70vh]"
          role="dialog"
        >
          <header className="shrink-0 p-6 md:px-10 md:py-8">
            <h3 className="m-0 pt-2 text-[2rem] font-bold leading-[2.4rem] md:text-[2.2rem] md:leading-[2.8rem]">
              <Text field={props.fields.Heading} />
            </h3>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 md:px-10">
            <p className="mb-6 text-base leading-6">
              <Text field={props.fields.Description} />
            </p>
            <div className="mb-6">
              {options.map((option: CookieOptionItem, index: number) => {
                const optionId = option.id || `cookie-option-${index}`;
                const value = fieldValue(option.fields.Value);
                return (
                  <div className="mb-3 last:mb-0" key={`${optionId}-${index}`}>
                    <label
                      className="relative flex cursor-pointer items-start py-1 pl-8 text-base font-normal leading-6"
                      htmlFor={optionId}
                    >
                      <span className="absolute left-0 top-[0.35rem] inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#043572] bg-white">
                        <input
                          checked={selectedOption === value}
                          className="peer sr-only"
                          id={optionId}
                          name="CookieOptions.Value"
                          onChange={() => setSelectedOption(value)}
                          type="radio"
                          value={value}
                        />
                        <span className="h-2/3 w-2/3 scale-0 rounded-full bg-[#1a1a1a] transition-transform peer-checked:scale-100" />
                      </span>
                      <span>
                        <Text field={option.fields.Label} />
                      </span>
                    </label>
                    <span className="ml-8 block text-sm leading-6 text-[#043572]">
                      <Text field={option.fields.Help} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <footer className="flex shrink-0 justify-center p-6 md:px-10 md:pb-8 md:pt-6">
            <button
              className="rounded-[0.8rem] bg-[#fec352] px-5 py-4 text-center text-base font-bold leading-[1.8rem] text-[#1e1400]"
              onClick={closeCookies}
              type="button"
            >
              <Text field={props.fields['Save Label']} />
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
