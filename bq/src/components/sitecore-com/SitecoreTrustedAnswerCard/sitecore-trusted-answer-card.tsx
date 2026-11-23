import React, { JSX } from 'react';
import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Eyebrow: Field<string>;
  Title: Field<string>;
  Description: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <div className="min-w-0 px-2">
      <article className="h-full rounded-lg border border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] lg:rounded-[9px]">
        <div className="flex h-full flex-col overflow-hidden rounded-lg lg:rounded-[9px]">
          <div className="flex flex-1 flex-col p-5">
            <p className="mb-2 w-fit bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-xs font-bold uppercase leading-4 tracking-wide text-transparent">
              <Text field={fields.Eyebrow} />
            </p>
            <h3 className="mb-2 text-[20px] font-semibold leading-[1.5] tracking-[-0.05px] sm:text-[22px] sm:leading-[1.375] lg:text-[22px] lg:leading-normal lg:tracking-[-0.055px]">
              <Text field={fields.Title} />
            </h3>
            <div className="text-sm leading-[1.625] text-[#4b5563]">
              <RichText field={fields.Description} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default Default;
