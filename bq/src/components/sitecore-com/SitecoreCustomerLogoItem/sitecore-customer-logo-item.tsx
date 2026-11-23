import React, { JSX } from 'react';
import { Image, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Name: Field<string>;
  Logo: ImageField;
  Height: Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  const height = Number(fields.Height?.value || 44);

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={fields.Name?.value || ''}
      className="flex shrink-0 items-center outline-2 outline-offset-2 outline-indigo-600 focus-within:outline"
    >
      <div className="flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <Image
            field={fields.Logo}
            alt={fields.Name?.value || ''}
            loading="lazy"
            decoding="async"
            className="h-auto w-auto max-w-[160px] object-contain transition-opacity duration-300 sm:max-w-[180px] md:max-w-[200px] lg:max-w-[220px]"
            style={{ height: `${height}px` }}
          />
        </div>
        <span className="sr-only">
          <Text field={fields.Name} />
        </span>
      </div>
    </div>
  );
};
