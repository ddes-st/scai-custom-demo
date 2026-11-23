'use client';

import { RichText, Text, type Field, type RichTextField, type TextField } from '@sitecore-content-sdk/nextjs';
import { useState } from 'react';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: TextField;
  'Menu Content': RichTextField;
  Expandable: Field<boolean>;
}

type InsuranceNavigationProps = ComponentProps & { fields: Fields };

export const Default = (props: InsuranceNavigationProps) => {
  const { fields } = props;
  const [isOpen, setIsOpen] = useState(false);
  const isExpandable = fields.Expandable?.value !== false;

  return (
    <li key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined} className="relative">
      <button
        type="button"
        className="flex items-center gap-2 border-b-2 border-transparent px-5 py-4 text-base font-semibold text-[#00008f] transition-colors hover:border-[#00008f]"
        aria-expanded={isExpandable ? isOpen : undefined}
        onClick={() => isExpandable && setIsOpen((open) => !open)}
      >
        <Text field={fields.Title} />
        {isExpandable && <span aria-hidden="true" className="text-sm">⌄</span>}
      </button>
      {isExpandable && isOpen && (
        <div className="absolute left-0 top-full z-20 grid min-w-[min(100vw,1100px)] grid-cols-1 gap-8 border-t border-slate-200 bg-white p-8 shadow-lg md:grid-cols-[minmax(220px,1fr)_minmax(360px,1.5fr)]">
          <RichText field={fields['Menu Content']} />
        </div>
      )}
    </li>
  );
};
