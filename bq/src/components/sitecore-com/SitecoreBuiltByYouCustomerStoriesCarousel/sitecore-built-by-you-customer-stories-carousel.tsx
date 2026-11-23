import React, { JSX } from 'react';
import { AppPlaceholder, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-built-by-you-customer-stories-carousel.client';

interface Fields {
  Heading: Field<string>;
  CTA: LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const pillarCardsBase = 'pillar-cards';
  const pillarCardsName = phKey ? `${pillarCardsBase}-${phKey}` : pillarCardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="bg-white font-['DM_Sans',sans-serif] text-[#1e1c22]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 border-x border-b border-[#e4e2e8] bg-[radial-gradient(circle_at_0_100%,rgba(255,31,56,0.12),transparent_25%),radial-gradient(circle_at_100%_0,rgba(134,41,255,0.12),transparent_25%),#fff] px-[19px] sm:mx-[clamp(0px,calc(-3.3335rem+8.3338vw),2rem)] sm:px-[clamp(1.1875rem,calc(-0.1667rem+3.3854vw),2rem)] lg:mx-[clamp(2rem,calc(-0.8571rem+4.4643vw),4.5rem)] lg:px-[clamp(2rem,calc(0.8571rem+1.7857vw),3rem)]">
          <div className="flex flex-col items-center py-6 text-center lg:py-8 xl:py-10">
            <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] sm:text-[clamp(1.625rem,calc(0.998rem+1.565vw),2.25rem)] lg:text-[clamp(2.25rem,calc(0.75rem+1.875vw),3rem)]">
              <Text field={fields.Heading} />
            </h2>
          </div>
          <div className="relative grid gap-4 overflow-visible pb-6 sm:gap-6 lg:gap-8 lg:pb-8 xl:pb-10">
            <Chrome>
              <AppPlaceholder
                name={pillarCardsName}
                rendering={rendering}
                page={page}
                componentMap={componentMap}
              />
            </Chrome>
            <div className="mt-4 flex justify-center lg:mt-5 xl:mt-6">
              <Link
                field={fields.CTA}
                className="flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 font-medium leading-6 text-[#1e1c22] transition-colors hover:border-[#4e06c2] hover:bg-[#4e06c2] hover:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
