'use client';

import { RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { useState } from 'react';

interface Fields {
  Heading: TextField;
  Products: RichTextField;
}

type InsuranceCategoryGroupProps = ComponentProps & { fields: Fields };

export const Default = (props: InsuranceCategoryGroupProps) => {
  const { fields } = props;
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `${props.params.RenderingIdentifier || props.rendering.uid}-products`;

  return (
    <article
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="border-b border-slate-300 last:border-b-0 lg:border-0"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between py-3 text-left lg:hidden"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Text field={fields.Heading} tag="h3" className="font-sans text-xl font-semibold text-slate-950" />
        <span
          aria-hidden="true"
          className={`ml-4 text-sm text-[#00008f] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          ˅
        </span>
      </button>

      <Text
        field={fields.Heading}
        tag="h3"
        className="hidden pb-4 font-sans text-xl font-semibold text-slate-950 lg:block"
      />

      <div id={panelId} className={`${isOpen ? 'block' : 'hidden'} lg:block`}>
        <RichText
          field={fields.Products}
          className="catalog-category-products space-y-3 pb-3 font-sans text-base leading-6 text-[#00008f] lg:pb-0 [&_a]:underline [&_a]:decoration-slate-400 [&_a]:underline-offset-4"
        />
      </div>
    </article>
  );
};
