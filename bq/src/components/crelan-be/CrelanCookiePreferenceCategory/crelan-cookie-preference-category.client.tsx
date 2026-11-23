'use client';

import { useState } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Title: Field<string>;
  Description: Field<string>;
  Required: Field<boolean>;
  'Initial Enabled': Field<boolean>;
}

type Props = { fields: Fields };

export default function CookieCategoryChrome({ fields }: Props) {
  const required = fields.Required?.value === true || String(fields.Required?.value) === '1';
  const initiallyEnabled =
    fields['Initial Enabled']?.value === true || String(fields['Initial Enabled']?.value) === '1';
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(required || initiallyEnabled);

  return (
    <div className="relative w-full border-x border-b border-[#d8d8d8] first:border-t first:mt-[10px]">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="absolute inset-0 z-0 h-full w-full border-0 bg-transparent p-0"
      />
      <div className="relative z-[1] flex min-h-[50px] w-full items-center justify-between px-2 py-[0.7rem]">
        <div className="flex min-w-0 flex-1 items-center">
          <span className="relative inline-block h-5 w-5 shrink-0">
            <span
              className={`absolute left-[45%] top-[25%] h-[50%] w-[10%] rounded-sm bg-[#27455c] ${isOpen ? 'opacity-0' : 'opacity-100'}`}
            />
            <span className="absolute left-[25%] top-[45%] h-[10%] w-[50%] rounded-sm bg-[#27455c]" />
          </span>
          <h4 className="mx-2 flex-1 text-left text-[0.875em] font-semibold leading-[1.5] text-[#2e3644]">
            <Text field={fields.Title} />
          </h4>
        </div>
        {required ? (
          <span className="ml-2 shrink-0 text-[0.813em] font-bold text-[#3860be]">
            Altijd actief
          </span>
        ) : (
          <label
            className="relative z-[2] ml-2 inline-flex h-[25px] w-[45px] shrink-0 cursor-pointer"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              role="switch"
              aria-label={fields.Title?.value || ''}
              checked={enabled}
              onChange={() => setEnabled((current) => !current)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-[20px] border border-[#ddd] bg-[#f2f1f1] transition peer-checked:border-[#3860be] peer-checked:bg-[#cddcf2] after:absolute after:bottom-px after:left-px after:h-[21px] after:w-[21px] after:rounded-full after:bg-[#7d7d7d] after:transition-all peer-checked:after:translate-x-5 peer-checked:after:bg-[#3860be]" />
          </label>
        )}
      </div>
      {isOpen ? (
        <div className="relative z-[1] w-full bg-[#f8f8f8] px-5 py-[15px] text-[0.812em] leading-[1.5] text-[#696969]">
          <p className="m-0">
            <Text field={fields.Description} />
          </p>
        </div>
      ) : null}
    </div>
  );
}
