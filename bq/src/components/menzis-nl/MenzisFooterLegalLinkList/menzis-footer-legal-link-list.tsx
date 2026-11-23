'use client';

import React, { JSX, useState } from 'react';
import { Link } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface LinkRow {
  field?: {
    link?: LinkField;
  };
}

interface Datasource {
  field?: {
    title?: TextField;
  };
  children?: {
    results?: LinkRow[];
  };
}

interface LinkListFields {
  data?: {
    datasource?: Datasource;
  };
}

type Props = ComponentWithContextProps & { fields: LinkListFields };

export const Default = (props: Props): JSX.Element => {
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const rows = props.fields?.data?.datasource?.children?.results ?? [];

  return (
    <nav aria-label="Info links" className="w-full">
      <ul className="list-none m-0 flex w-full flex-col items-center justify-center gap-0 p-0 text-sm leading-6 lg:flex-row md:flex-wrap md:justify-end md:gap-x-5">
        {rows.map((row: LinkRow, index: number) => {
          const link = row.field?.link;
          if (!link) return null;
          const href = link.value?.href ?? '';
          return (
            <li className="m-0 w-auto p-0" key={`${href}-${index}`}>
              <Link
                field={link}
                className="font-normal text-[#043572] no-underline hover:underline"
                aria-current={activeHref === href ? 'page' : undefined}
                onClick={() => setActiveHref(href)}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Default;
