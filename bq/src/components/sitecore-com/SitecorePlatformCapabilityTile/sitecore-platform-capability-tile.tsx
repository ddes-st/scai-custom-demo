import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Link: LinkField;
  'Aria Label': Field<string>;
  Icon: ImageField;
  Eyebrow: Field<string>;
  Title: Field<string>;
  Description: Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) return <div>Missing Component Datasource.</div>;

  return (
    <div className="px-2">
      <article className="relative block h-full rounded-lg border border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] lg:rounded-[9px]">
        <Link
          field={fields.Link}
          aria-label={fields['Aria Label']?.value || ''}
          className="absolute inset-0 z-10 block rounded-lg"
        >
          <span className="sr-only">
            <Text field={fields.Title} />
          </span>
        </Link>
        <div className="flex h-full flex-col overflow-hidden rounded-lg p-5 lg:rounded-[9px]">
          <div className="flex h-full flex-1 flex-row items-start gap-3 lg:flex-col lg:gap-0 2xl:flex-row 2xl:items-start 2xl:gap-3">
            <div className="mb-0 flex-shrink-0 lg:mb-3 2xl:mb-0">
              <Image field={fields.Icon} className="h-7 w-auto" />
            </div>
            <div className="flex h-full flex-1 flex-col">
              <p className="mb-2 w-fit text-xs font-bold uppercase leading-4 tracking-wide text-transparent [background:linear-gradient(90deg,#ff1f38_0%,#8629ff_100%)] bg-clip-text">
                <Text field={fields.Eyebrow} />
              </p>
              <h3 className="mb-2 text-[20px] font-semibold leading-[1.5] tracking-[-0.05px] sm:text-[22px] sm:leading-[1.375] lg:text-[22px] lg:leading-normal">
                <Text field={fields.Title} />
              </h3>
              <div className="text-sm leading-relaxed text-gray-600">
                <p>
                  <Text field={fields.Description} />
                </p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default Default;
