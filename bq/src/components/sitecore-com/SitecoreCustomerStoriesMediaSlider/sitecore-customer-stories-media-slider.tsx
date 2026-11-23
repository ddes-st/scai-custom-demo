import React, { JSX } from 'react';
import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Logo: ImageField;
  'Logo Alt': Field<string>;
  Thumbnail: ImageField;
  'Thumbnail Alt': Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  const title = fields.Title?.value || '';
  const thumbnail = fields.Thumbnail?.value?.src || '';
  const thumbnailAlt = fields['Thumbnail Alt']?.value || '';

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <article data-story-title={title} className="w-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="relative w-full lg:w-1/2 xl:w-[60%]">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-[#f1f0f3] shadow-[0_8px_24px_rgba(147,51,234,.15)]">
            <button
              type="button"
              data-video-src={thumbnail}
              data-video-alt={thumbnailAlt}
              data-video-title={title}
              className="group relative block h-full w-full"
              aria-label={`Play video: ${title}`}
            >
              <Image
                field={fields.Thumbnail}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span
                className="absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <svg
                    viewBox="0 0 24 24"
                    className="ml-1 h-8 w-8 fill-[#4e06c2]"
                    aria-hidden="true"
                  >
                    <path d="M8 5.5v13L18 12 8 5.5Z" />
                  </svg>
                </span>
              </span>
            </button>
          </div>
          <button
            type="button"
            data-story-select={title}
            className="mt-4 flex w-full items-center rounded-md border border-transparent bg-gradient-to-r from-[#ff1f38] to-[#8629ff] px-3 py-2 text-left text-sm font-semibold text-white sm:text-[18px] lg:hidden"
          >
            <Text field={fields.Title} />
          </button>
          <div className="mt-4 flex justify-center">
            <Image field={fields.Logo} className="h-7 w-auto max-w-[120px] object-contain" />
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-1/2 xl:w-[40%]">
          <button
            type="button"
            data-story-select={title}
            className="flex w-full items-center rounded-md border border-transparent bg-gradient-to-r from-[#ff1f38] to-[#8629ff] px-3 py-2 text-left text-sm font-semibold text-white sm:text-[18px]"
          >
            <Text field={fields.Title} />
          </button>
        </div>
      </div>
    </article>
  );
};

export default Default;
