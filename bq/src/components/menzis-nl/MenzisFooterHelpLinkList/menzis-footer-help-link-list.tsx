import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface LinkItem {
  field?: { link?: LinkField };
}

interface LinkListFields {
  data?: {
    datasource?: {
      field?: { title?: TextField };
      children?: { results?: LinkItem[] };
    };
  };
}

type Props = Omit<ComponentWithContextProps, 'fields'> & { fields?: LinkListFields };

export const Default = (props: Props): JSX.Element => {
  const datasource = props.fields?.data?.datasource;
  const title = datasource?.field?.title;
  const items = datasource?.children?.results ?? [];

  return (
    <section className="col-span-12 text-center lg:text-center">
      {title ? (
        <h3 className="mb-2 pt-4 font-['Geologica',Arial,sans-serif] text-xl font-bold leading-7 text-[#043572] md:text-[22px] md:leading-7">
          <Text field={title} />
        </h3>
      ) : null}
      <nav aria-label={typeof title?.value === 'string' ? title.value : undefined}>
        <ul className="mb-6 list-none p-0 text-center">
          {items.map((item: LinkItem, index: number) => (
            <li className="mb-2 list-none" key={index}>
              {item.field?.link ? (
                <Link
                  field={item.field.link}
                  className="flex items-center justify-center font-['Geologica',Arial,sans-serif] text-base font-normal leading-6 text-[#043572] no-underline hover:underline"
                />
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
};

export default Default;
