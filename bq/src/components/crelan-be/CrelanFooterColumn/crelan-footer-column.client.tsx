'use client';

import React from 'react';

type Props = {
  showPreferences: boolean;
  children: React.ReactNode;
};

export default function CrelanFooterColumnChrome({ showPreferences, children }: Props) {
  return (
    <>
      {children}
      {showPreferences ? (
        <li className="m-0">
          <button
            type="button"
            onClick={() => {
              const oneTrust = (
                window as Window & { OneTrust?: { ToggleInfoDisplay?: () => void } }
              ).OneTrust;
              if (oneTrust?.ToggleInfoDisplay) {
                oneTrust.ToggleInfoDisplay();
              }
            }}
            className="group flex w-fit items-center gap-2 py-3 font-['CrelanSunset',sans-serif] text-sm leading-none text-[#3c3c3c] hover:text-[#00ae53] hover:underline"
          >
            <span>Voorkeurenmenu</span>
            <span aria-hidden="true" className="text-base leading-none">
              →
            </span>
          </button>
        </li>
      ) : null}
    </>
  );
}
