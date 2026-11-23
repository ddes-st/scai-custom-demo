import React, { type JSX } from 'react';
import { AppPlaceholder, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Heading: Field<string>;
  Description: RichTextField;
  'All Reports Link': LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

const Arrow = () => (
  <span
    aria-hidden="true"
    className="ml-2 block h-[22px] w-[22px] bg-[#4e06c2] group-hover:bg-white"
    style={{
      maskImage: 'url(https://www.sitecore.com/static/cta-arrow.svg)',
      maskPosition: 'center',
      maskRepeat: 'no-repeat',
      maskSize: '22px auto',
    }}
  />
);

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const reportCardsBase = 'report-cards';
  const reportCardsName = phKey ? `${reportCardsBase}-${phKey}` : reportCardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="bg-[#f9f9fa]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid border-x border-b border-[#e4e2e8] bg-[#f9f9fa] px-[19px] py-0 sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:gap-[clamp(2rem,0.8571rem+1.7857vw,3rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)]">
          <div className="col-span-12 flex w-full flex-col items-center px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] py-6 text-center sm:max-w-full lg:py-8 xl:py-10">
            <div className="flex flex-1 flex-col gap-4 text-left">
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] text-[#1e1c22] sm:text-[clamp(1.625rem,0.998rem+1.565vw,2.25rem)] lg:text-[clamp(2.25rem,0.75rem+1.875vw,3rem)]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center text-[16px] leading-[1.5] tracking-[0.16px] text-[#1e1c22] sm:text-[17px] sm:leading-[1.42] lg:text-[18px] lg:leading-[1.5] lg:tracking-normal">
                <RichText field={fields.Description} />
              </div>
            </div>
          </div>
          <div className="col-span-12 flex flex-col items-center bg-transparent px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] pb-8 lg:pb-10">
            <div className="flex w-full max-w-4xl flex-col gap-3">
              <AppPlaceholder
                name={reportCardsName}
                rendering={rendering}
                page={page}
                componentMap={componentMap}
              />
            </div>
            <div className="mt-4 flex flex-col items-center justify-center gap-4 pt-0 md:flex-row md:flex-wrap md:items-start md:pt-6">
              <Link
                field={fields['All Reports Link']}
                className="group flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 pr-4 font-medium leading-6 text-[#1e1c22] no-underline transition-colors duration-200 hover:border-[#4e06c2] hover:bg-[#4e06c2] hover:text-white"
              >
                <span className="flex items-center">
                  {fields['All Reports Link']?.value?.text ||
                    fields['All Reports Link']?.value?.href ||
                    ''}
                  <Arrow />
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
