import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Icon: Field<string>;
  Title: Field<string>;
  Link: LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

const iconPaths: Record<string, string> = {
  account: 'M3 5h18v4H3zM3 11h18v8H3zM6 15h4M12 15h5',
  piggy: 'M4 11c0-3 3-5 7-5 4 0 7 2 7 5v5H7c-2 0-3-2-3-5Zm3-5V4m10 3 2-2M18 12h.01',
  chart: 'M4 19V15h3v4H4Zm6 0V10h3v9h-3Zm6 0V5h3v14h-3Z',
  handshake: 'M4 8h5l3 3 3-3h5v8h-5l-3-3-3 3H4V8Zm5 3 3 3 3-3',
  home: 'm3 11 9-7 9 7v8H3v-8Zm5 8v-5h8v5',
  building: 'M4 20V5h16v15M8 9h2m4 0h2M8 13h2m4 0h2M8 17h2m4 0h2',
  car: 'M5 16h14l-1-6H6l-1 6Zm2-6 2-4h6l2 4M8 18h.01M16 18h.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
};

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  const icon = (fields.Icon?.value || '').toLowerCase();
  const path = iconPaths[icon] || iconPaths.account;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <Link
      field={fields.Link}
      className="flex min-h-[67px] items-center justify-between gap-4 rounded-lg bg-white px-4 py-5 text-[#3c3c3c] shadow-[0_0_20px_rgba(0,0,0,0.1)] transition hover:underline"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#00ae53]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6 fill-none stroke-current stroke-[1.8]"
            focusable="false"
          >
            <path d={path} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 font-['CrelanSunset',sans-serif] text-lg font-medium leading-[1.5rem]">
          <Text field={fields.Title} />
        </span>
      </span>
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[#6e6e6e]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px] fill-none stroke-current stroke-[2]"
        >
          <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
};
