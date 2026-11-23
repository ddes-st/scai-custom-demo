import React, { type JSX } from 'react';
import {
  AppPlaceholder,
  RichText,
  Text,
  type Field,
  type RichTextField,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-workflow-ai-cards-carousel.client';

interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

const carouselCardsBase = 'carousel-cards';

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const carouselCardsName = phKey ? `${carouselCardsBase}-${phKey}` : carouselCardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="bg-[radial-gradient(circle_at_0%_100%,rgba(255,31,56,0.12),transparent_25%),radial-gradient(circle_at_100%_0%,rgba(134,41,255,0.12),transparent_25%)] font-['DM_Sans',sans-serif]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 border-x border-b border-[#e4e2e8] bg-white px-[19px] sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)]">
          <div className="flex flex-col items-center border-b border-[#e4e2e8] py-6 text-center sm:py-8 xl:py-10">
            <div className="flex w-full max-w-5xl flex-1 flex-col gap-4 text-left">
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] text-[#1e1c22] sm:text-[clamp(1.625rem,0.998rem+1.565vw,2.25rem)] lg:text-[36px] lg:leading-[1.15] lg:tracking-[-0.84px]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center text-[16px] leading-[1.75] tracking-[0.16px] text-[#1e1c22] sm:text-[17px] lg:text-[18px] lg:tracking-normal">
                <RichText field={fields.Body} />
              </div>
            </div>
          </div>
          <Chrome>
            <AppPlaceholder
              name={carouselCardsName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
          </Chrome>
        </div>
      </div>
    </section>
  );
};

export default Default;
