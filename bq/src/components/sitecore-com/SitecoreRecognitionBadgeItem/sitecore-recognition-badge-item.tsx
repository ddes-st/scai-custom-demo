import React, { JSX } from 'react';
import { Image } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Image: ImageField;
  Title: Field<string>;
  Height: Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  const height = fields.Height?.value || '';

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center outline-2 outline-offset-2 outline-indigo-600 focus:outline focus:outline-indigo-600"
      title={fields.Title?.value || ''}
      tabIndex={0}
    >
      <div>
        <div className="flex flex-col items-center" title={fields.Title?.value || ''}>
          <div className="relative flex items-center justify-center">
            <Image
              field={fields.Image}
              loading="lazy"
              decoding="async"
              style={{ height: `${height}px` }}
              className="w-auto object-contain opacity-100 transition-opacity duration-300 max-w-[160px] sm:max-w-[180px] md:max-w-[200px] lg:max-w-[220px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Default;
