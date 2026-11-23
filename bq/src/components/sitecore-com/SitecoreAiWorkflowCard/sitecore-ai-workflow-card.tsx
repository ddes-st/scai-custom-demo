import React, { JSX } from 'react';
import { Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';
import type { Field } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Eyebrow: Field<string>;
  Title: Field<string>;
  Description: Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <div className="px-2">
      <article className="h-full rounded-lg border border-gray-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] lg:rounded-[9px]">
        <div className="flex h-full flex-col overflow-hidden rounded-lg lg:rounded-[9px]">
          <div className="flex flex-1 flex-col p-5">
            <p className="mb-2 w-fit text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent">
              <Text field={fields.Eyebrow} />
            </p>
            <h3 className="mb-2 text-[20px] font-semibold leading-[1.5] tracking-[-0.05px] text-[#1e1c22] sm:text-[22px] sm:leading-[1.375] lg:text-[22px] lg:leading-normal">
              <Text field={fields.Title} />
            </h3>
            <div className="text-sm leading-relaxed text-gray-600">
              <Text field={fields.Description} />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default Default;
