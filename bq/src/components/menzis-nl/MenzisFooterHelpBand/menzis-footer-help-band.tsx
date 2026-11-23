import React, { JSX } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  CTA: LinkField;
  'Pebble Line': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const fields = props.fields;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="relative col-span-12 flex min-h-[300px] flex-col justify-center overflow-visible pr-0 lg:col-span-7 lg:pr-32">
      <div className="pointer-events-none absolute -left-[100px] -top-[60px] -z-0 hidden h-[360px] w-[650px] lg:block">
        <Image
          field={fields['Pebble Line']}
          className="h-full w-full object-contain object-right-bottom"
        />
      </div>
      <div className="pointer-events-none absolute -bottom-9 -left-40 -z-0 h-[140%] min-h-[390px] w-[140%] md:hidden">
        <Image
          field={fields['Pebble Line']}
          className="h-full w-full object-contain object-right-bottom"
        />
      </div>
      <div className="relative z-10 text-left">
        <h2 className="mb-4 pt-2 font-['Geologica',Arial,sans-serif] text-2xl font-bold leading-8 text-[#043572] md:text-[28px] md:leading-9">
          <Text field={fields.Heading} />
        </h2>
        <div className="mb-6 max-w-[620px] font-['Geologica',Arial,sans-serif] text-base font-normal leading-6 text-[#043572] lg:text-lg lg:leading-7">
          <RichText field={fields.Body} />
          <Link
            field={fields.CTA}
            className="text-[#0057c2] underline decoration-1 underline-offset-2 hover:text-[#064ca3]"
          />
        </div>
      </div>
    </section>
  );
};

export default Default;
