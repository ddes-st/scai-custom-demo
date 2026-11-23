import React, { JSX } from 'react';
import { Image, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Label: Field<string>;
  Title: Field<string>;
  Description: RichTextField;
  Image: ImageField;
  'Tab Index': Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) return <div>Missing Component Datasource.</div>;
  const index = fields['Tab Index']?.value || '0';
  const label = fields.Label?.value || '';

  return (
    <article
      data-studio-tab={index}
      data-studio-label={label}
      role="tabpanel"
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      className="grid grid-cols-1 items-center gap-8 xl:grid-cols-[40%_60%] xl:gap-10"
    >
      <div className="flex flex-col xl:pr-8">
        <span className="text-lg font-semibold leading-[1.5]">
          <Text field={fields.Label} />
        </span>
        <h3 className="mt-4 bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-[24px] font-medium leading-normal tracking-[-.12px] text-transparent sm:text-[clamp(1.5rem,.9984rem+1.252vw,2rem)]">
          <Text field={fields.Title} />
        </h3>
        <div className="mt-6 text-lg leading-[1.5]">
          <RichText field={fields.Description} />
        </div>
      </div>
      <figure className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#ff1f3929] via-[#fe7dff29] to-[#4ddfff29] blur-[11px]" />
        <Image
          field={fields.Image}
          className="relative z-[1] h-auto w-full rounded-lg object-cover shadow-[0_8px_24px_rgba(147,51,234,.15)]"
        />
      </figure>
    </article>
  );
};

export default Default;
