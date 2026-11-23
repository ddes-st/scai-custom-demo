import React, { JSX } from 'react';
import { AppPlaceholder, Image, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  'Hero Image': ImageField;
  'Hero Image Tablet': ImageField;
  'Hero Image Mobile': ImageField;
  Heading: Field<string>;
  Body: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

const heroCardsBase = 'hero-cards';

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const heroCardsName = phKey ? `${heroCardsBase}-${phKey}` : heroCardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="relative mx-auto mb-8 grid w-full max-w-[1336px] grid-cols-1 px-4 text-[#3c3c3c] md:mb-20 md:px-8 lg:grid-rows-[auto_5.25rem_auto] lg:px-8">
      <div className="relative z-0 -mx-4 overflow-hidden rounded-b-lg shadow-[0_4px_20px_rgba(60,60,60,0.15)] md:-mx-8 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:-mx-[4.375rem]">
        <picture className="block h-full w-full">
          <span className="hidden h-full w-full lg:block">
            <Image
              field={fields['Hero Image']}
              className="block aspect-[2/1] h-auto w-full object-cover lg:absolute lg:h-full lg:aspect-auto"
            />
          </span>
          <span className="hidden h-full w-full min-[392px]:block lg:hidden">
            <Image
              field={fields['Hero Image Tablet']}
              className="block aspect-[2/1] h-auto w-full object-cover"
            />
          </span>
          <span className="block h-full w-full min-[392px]:hidden">
            <Image
              field={fields['Hero Image Mobile']}
              className="block aspect-[2/1] h-auto w-full object-cover"
            />
          </span>
        </picture>
      </div>
      <div className="relative z-10 flex w-full items-center py-10 lg:col-start-1 lg:row-start-1 lg:min-h-[23rem] lg:px-[4.375rem] lg:py-16">
        <div className="flex w-full max-w-[31.875rem] flex-col gap-4">
          <h1 className="m-0 font-['CrelanSunset',sans-serif] text-[1.75rem] font-normal leading-[1.2] text-[#00ae53] lg:text-[2rem]">
            <Text field={fields.Heading} />
          </h1>
          <div className="max-w-[24.875rem] text-base leading-6 text-[#3c3c3c]">
            <RichText field={fields.Body} />
          </div>
        </div>
      </div>
      <div className="relative z-20 grid w-full gap-6 lg:col-start-1 lg:row-start-2 lg:row-span-2 lg:grid-cols-2">
        <AppPlaceholder
          name={heroCardsName}
          rendering={rendering}
          page={page}
          componentMap={componentMap}
        />
      </div>
    </section>
  );
};

export default Default;
