'use client';

import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { useState } from 'react';
import { ComponentProps } from 'lib/component-props';

type LinkListChild = {
  field?: {
    link?: LinkField;
  };
};

type LinkListDatasource = {
  field?: {
    title?: TextField;
  };
  children?: {
    results?: LinkListChild[];
  };
};

type InsuranceCategoryMenuFields =
  | LinkListDatasource
  | {
      data?: {
        datasource?: LinkListDatasource;
      };
    };

type InsuranceCategoryMenuProps = ComponentProps & { fields: InsuranceCategoryMenuFields };

function getDatasource(
  fields: InsuranceCategoryMenuFields | undefined,
): LinkListDatasource | undefined {
  if (!fields) return undefined;
  const wrapped = fields as { data?: { datasource?: LinkListDatasource } };
  return wrapped.data?.datasource ?? (fields as LinkListDatasource);
}

export const Default = (props: InsuranceCategoryMenuProps) => {
  const datasource = getDatasource(props.fields);
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `${props.params.RenderingIdentifier || props.rendering.uid}-products`;
  const results = datasource?.children?.results ?? [];

  return (
    <li
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="border-b border-[#d8d8df] last:border-b-0 lg:border-0"
    >
      <h3 className="m-0 font-sans text-[20px] font-semibold leading-tight text-[#111b2d] lg:text-[23px]">
        <button
          type="button"
          className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((open) => !open)}
        >
          <Text field={datasource?.field?.title} />
          <span
            aria-hidden="true"
            className={`ml-4 h-2 w-2 shrink-0 border-b border-r border-[#00008f] transition-transform lg:hidden ${isOpen ? 'rotate-[225deg] translate-y-0.5' : 'rotate-45 -translate-y-0.5'}`}
          />
        </button>
      </h3>
      <div
        id={panelId}
        className={`pt-3 pb-4 lg:block lg:pt-5 lg:pb-0 ${isOpen ? 'block' : 'hidden'}`}
      >
        <ul className="m-0 list-none space-y-4">
          {results.map((item, index) => {
            const linkField = item.field?.link;
            if (!linkField) return null;
            return (
              <li key={linkField.value?.href || index} className="m-0">
                <Link
                  field={linkField}
                  className="font-sans text-[16px] font-semibold leading-6 text-[#00008f] underline decoration-[#9ca3c7] underline-offset-4"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
};
