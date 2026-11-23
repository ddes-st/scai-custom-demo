import React, { JSX } from 'react';
import { Image, Link } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface LinkItem {
  id?: string;
  name?: string;
  field?: {
    link?: LinkField;
  };
  fields?: {
    Link?: LinkField;
  };
}

interface Fields {
  data?: {
    datasource?: {
      field?: {
        title?: Field<string>;
        logo?: ImageField;
      };
      children?: {
        results?: LinkItem[];
      };
    };
  };
}

type Props = ComponentWithContextProps & {
  fields?: Fields;
};

const Default = (props: Props): JSX.Element => {
  const datasource = props.fields?.data?.datasource;
  const logo = datasource?.field?.logo;
  const items = datasource?.children?.results ?? [];

  return (
    <nav aria-label="Global navigation">
      {logo ? <Image field={logo} className="mb-4 h-auto max-w-full" /> : null}
      <ul className="list-none space-y-2">
        {items.map((item, index) => {
          const link = item.field?.link ?? item.fields?.Link;

          return link ? (
            <li key={item.id ?? item.name ?? index}>
              <Link
                field={link}
                className="block px-2 py-1 text-[#043572] hover:underline"
              />
            </li>
          ) : null;
        })}
      </ul>
    </nav>
  );
};

export default Default;
