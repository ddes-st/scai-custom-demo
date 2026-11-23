import React, { JSX } from 'react';
import { AppPlaceholder, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-frequently-asked-questions-accordion.client';

interface Fields {
  Heading: Field<string>;
  Intro: Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

const faqItemsBase = 'faq-items';

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const faqItemsName = phKey ? `${faqItemsBase}-${phKey}` : faqItemsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const content = (
    <section className="bg-white text-[#1e1c22] font-['DM_Sans',sans-serif]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid grid-cols-12 border-x border-b border-[#e4e2e8] px-[19px] sm:mx-[clamp(0px,calc(-3.3335rem+8.3338vw),2rem)] sm:gap-[clamp(1.1875rem,calc(-0.1667rem+3.3854vw),2rem)] sm:px-[clamp(1.1875rem,calc(-0.1667rem+3.3854vw),2rem)] lg:mx-[clamp(2rem,calc(-0.8571rem+4.4643vw),4.5rem)] lg:gap-[clamp(2rem,calc(0.8571rem+1.7857vw),3rem)] lg:px-[clamp(2rem,calc(0.8571rem+1.7857vw),3rem)]">
          <div className="col-span-12 flex w-full flex-col items-center py-6 text-center lg:py-8 xl:py-10">
            <div className="flex max-w-5xl flex-1 flex-col gap-4">
              <h2 className="text-[26px] font-normal leading-normal tracking-[-0.195px] sm:text-[clamp(1.625rem,calc(0.998rem+1.565vw),2.25rem)] lg:text-[clamp(2.25rem,calc(0.75rem+1.875vw),3rem)]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center text-[16px] leading-[1.75] tracking-[0.16px] sm:text-[17px] lg:text-[18px]">
                <RichText field={fields.Intro} />
              </div>
            </div>
          </div>
          <div className="col-span-12 mx-auto flex w-full max-w-4xl flex-col gap-3 pb-8 lg:pb-10">
            <AppPlaceholder
              name={faqItemsName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </div>
    </section>
  );

  return <Chrome>{content}</Chrome>;
};

export default Default;
