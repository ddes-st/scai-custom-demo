import React, { JSX } from 'react';
import { AppPlaceholder, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-studio-extensibility-tabs.client';

interface Fields {
  Heading: Field<string>;
  Intro: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const studioTabsBase = 'studio-tabs';
  const studioTabsName = phKey ? `${studioTabsBase}-${phKey}` : studioTabsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const tabs = (
    <AppPlaceholder
      name={studioTabsName}
      rendering={rendering}
      page={page}
      componentMap={componentMap}
    />
  );

  return (
    <section id="extensibility" className="bg-white text-[#1e1c22]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="relative mx-0 border-x border-b border-[#e4e2e8] px-[19px] py-10 sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:px-[clamp(1.1875rem,-.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-.8571rem+4.4643vw,4.5rem)] lg:px-[clamp(2rem,.8571rem+1.7857vw,3rem)]">
          <header className="flex flex-col items-center pb-8 text-center">
            <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-.195px] sm:text-[clamp(1.625rem,.998rem+1.565vw,2.25rem)] lg:text-[clamp(2.25rem,.75rem+1.875vw,3rem)]">
              <Text field={fields.Heading} />
            </h2>
            <div className="mx-auto mt-4 max-w-2xl text-center text-base leading-[1.75] tracking-[.16px] sm:text-[17px] lg:text-lg">
              <RichText field={fields.Intro} />
            </div>
          </header>
          <Chrome>{tabs}</Chrome>
        </div>
      </div>
    </section>
  );
};

export default Default;
