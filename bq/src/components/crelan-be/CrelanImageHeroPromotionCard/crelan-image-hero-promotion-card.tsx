import React, { JSX } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Body: RichTextField;
  Image: ImageField;
  'Mobile Image': ImageField;
  Tone: Field<string>;
  'Show CTA': Field<boolean>;
  CTA: LinkField;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const tone = String(fields.Tone?.value || '').toLowerCase();
  const showCta = fields['Show CTA']?.value === true || String(fields['Show CTA']?.value) === '1';

  return (
    <article
      className={`flex w-full flex-col gap-6 rounded-lg p-6 shadow-[0_0_20px_rgba(0,0,0,0.1)] md:flex-row md:items-stretch md:gap-10 ${tone === 'green' ? 'bg-[#ecf8ea]' : 'bg-white'}`}
    >
      <div className="order-2 flex min-w-0 flex-1 flex-col justify-center gap-4 md:order-1">
        <div>
          <h2 className="m-0 font-['CrelanSunset',sans-serif] text-lg font-medium leading-[1.2] text-[#3c3c3c]">
            <Text field={fields.Title} />
          </h2>
        </div>
        <div className="flex flex-1 flex-col gap-2 text-base leading-6 text-[#3c3c3c]">
          <RichText field={fields.Body} />
        </div>
        {showCta ? (
          <div className="mt-auto flex items-center">
            <Link
              field={fields.CTA}
              className="inline-flex rounded-[200px] bg-white px-6 py-[0.775rem] font-['CrelanSunset',sans-serif] text-base leading-[1.2] text-[#3c3c3c] no-underline transition-colors hover:bg-[#6e5ae6] hover:text-white"
            />
          </div>
        ) : null}
      </div>
      <picture className="order-1 block aspect-[16/9] w-full overflow-hidden rounded-lg bg-[#d3d3d3] md:order-2 md:h-[172px] md:w-[172px] md:flex-none md:aspect-square">
        <span className="hidden h-full w-full md:block">
          <Image field={fields.Image} className="block h-full w-full object-cover" />
        </span>
        <span className="block h-full w-full md:hidden">
          <Image field={fields['Mobile Image']} className="block h-full w-full object-cover" />
        </span>
      </picture>
    </article>
  );
};

export default Default;
