import React, { JSX } from 'react';
import { AppPlaceholder, Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  'Office Map': ImageField;
  Heading: Field<string>;
  Body: RichTextField;
  CTA: LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const navigationCardsBase = 'navigation-cards';
  const uspItemsBase = 'usp-items';
  const navigationCardsName = phKey ? `${navigationCardsBase}-${phKey}` : navigationCardsBase;
  const uspItemsName = phKey ? `${uspItemsBase}-${phKey}` : uspItemsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <main className="w-full bg-white font-['Open_Sans',sans-serif] text-[#3c3c3c]">
      <section className="relative left-1/2 w-screen -ml-[50vw] bg-[#f4f4f4] px-4 py-10 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1336px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1292px]:grid-cols-4">
            <AppPlaceholder
              name={navigationCardsName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1336px] px-4 md:px-8">
        <div className="my-8 flex flex-col gap-8 md:my-20 md:flex-row md:gap-8">
          <div className="flex-1 md:basis-1/2">
            <div className="bg-[#f5f5f5] px-0 py-0 text-center md:pr-[30px]">
              <Image
                field={fields['Office Map']}
                className="mx-auto h-[325px] w-auto max-w-full object-contain"
              />
            </div>
          </div>
          <div className="flex-1 md:basis-1/2 md:pl-[30px]">
            <h2 className="mb-4 font-['CrelanSunset',sans-serif] text-[1.75rem] font-normal leading-[1.2] md:text-[2rem]">
              <Text field={fields.Heading} />
            </h2>
            <div className="mb-6 leading-6">
              <RichText field={fields.Body} />
            </div>
            <Link
              field={fields.CTA}
              className="inline-block rounded-full border-2 border-transparent bg-[#6e5ae6] px-5 py-2 font-['CrelanSunset',sans-serif] text-sm leading-[1.2] text-white transition hover:bg-[#6e5ae6] md:px-6 md:py-[0.775rem] md:text-base"
            />
          </div>
        </div>
        <div className="mb-8 grid grid-cols-1 gap-6 min-[392px]:grid-cols-2 md:mb-20 xl:grid-cols-4">
          <AppPlaceholder
            name={uspItemsName}
            rendering={rendering}
            page={page}
            componentMap={componentMap}
          />
        </div>
      </section>
    </main>
  );
};
