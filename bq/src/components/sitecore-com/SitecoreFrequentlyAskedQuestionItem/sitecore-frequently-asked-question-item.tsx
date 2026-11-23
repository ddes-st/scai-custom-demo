import React, { JSX } from 'react';
import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './sitecore-frequently-asked-question-item.client';

interface Fields {
  Question: Field<string>;
  Answer: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const itemId = rendering?.uid || fields.Question?.value || 'faq-item';
  const content = (
    <div className="relative rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(147,51,234,0.15)]">
      <button
        type="button"
        data-faq-trigger={itemId}
        className="flex w-full items-start gap-3 px-6 py-3 text-left sm:items-center"
      >
        <span
          data-faq-question
          className="flex-1 text-[17px] font-normal leading-[1.5] tracking-[0.085px] text-[#1e1c22] lg:text-[22px] lg:tracking-[-0.055px]"
        >
          <Text field={fields.Question} />
        </span>
        <span
          data-faq-icon
          aria-hidden="true"
          className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-[24px] font-light leading-none text-[#c1bdc7] sm:mt-0"
        >
          +
        </span>
      </button>
      <div
        data-faq-panel
        id={`faq-panel-${itemId}`}
        role="region"
        hidden
        className="px-6 pb-5 text-[14px] leading-[1.72] tracking-[0.28px] text-[#1e1c22] sm:text-[15px] lg:text-[16px] lg:leading-[1.5] lg:tracking-[0.16px]"
      >
        <div className="max-w-3xl">
          <RichText field={fields.Answer} />
        </div>
      </div>
    </div>
  );

  return <Chrome itemId={itemId}>{content}</Chrome>;
};

export default Default;
