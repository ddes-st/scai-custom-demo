import React, { JSX } from 'react';
import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Index: Field<string>;
  Title: Field<string>;
  Logo: ImageField;
  Thumbnail: ImageField;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) return <div>Missing Component Datasource.</div>;
  return (
    <article
      data-story-index={fields.Index?.value || '0'}
      className="overflow-hidden rounded-lg border border-[#e4e2e8] bg-white shadow-[0_4px_16px_rgba(147,51,234,.15)] lg:rounded-lg"
    >
      <div className="flex w-full items-center justify-between p-4 text-left lg:hidden">
        <span className="text-sm font-semibold sm:text-base">
          <Text field={fields.Title} />
        </span>
        <span className="text-xl" aria-hidden="true">
          ⌄
        </span>
      </div>
      <div className="px-4 pb-4 lg:px-0 lg:pb-0">
        <button
          type="button"
          className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-[#f1f0f3]"
          aria-label="Play video: Customer story"
        >
          <Image
            field={fields.Thumbnail}
            className="h-full w-full rounded-lg object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-black/10 shadow-lg">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[15px] border-y-transparent border-l-white" />
            </span>
          </span>
        </button>
      </div>
    </article>
  );
};

export default Default;
