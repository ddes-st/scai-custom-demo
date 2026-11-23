import React, { JSX } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Type: Field<string>;
  Title: Field<string>;
  Description: Field<string>;
  Image: ImageField;
  Link: LinkField;
  Target: Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <div className="flex min-w-0 shrink-0 grow-0 basis-full px-2 md:basis-1/2 xl:basis-1/3 2xl:basis-1/4">
      <div className="group flex h-full w-full rounded-lg border border-gray-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_24px_rgba(147,51,234,0.15)]">
        <Link
          field={fields.Link}
          target={fields.Target?.value || '_self'}
          rel={fields.Target?.value === '_blank' ? 'noreferrer' : undefined}
          className="flex h-full w-full flex-col overflow-hidden rounded-lg"
        >
          <div className="overflow-hidden">
            <Image
              field={fields.Image}
              className="aspect-[1.91/1] h-fit max-h-[217px] w-full object-cover transition-transform duration-300 ease-out group-hover:rotate-[-1deg] group-hover:scale-[1.03]"
            />
          </div>
          <div className="flex grow flex-col justify-between p-5">
            <div>
              <div className="mb-3 flex justify-between sm:mb-4">
                <span className="rounded border border-[#f1f0f3] bg-[#f1f0f3] px-2 py-1 text-[14px] font-semibold leading-[172%] text-[#1e1c22] lg:text-[16px] lg:leading-[150%]">
                  <Text field={fields.Type} />
                </span>
              </div>
              <h3 className="mb-2 text-[17px] font-semibold leading-[1.5] tracking-[0.085px] transition-colors duration-300 group-hover:text-[#5f25e7] sm:text-[19px] lg:text-[22px] 2xl:text-[26px]">
                <Text field={fields.Title} />
              </h3>
              <div className="mb-6 line-clamp-3 max-w-3xl text-[14px] leading-[1.625] text-gray-600">
                <RichText field={fields.Description} />
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Default;
