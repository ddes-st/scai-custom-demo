import React, { JSX } from 'react';
import { AppPlaceholder, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';

interface Fields {
  Eyebrow: Field<string>;
  Heading: Field<string>;
  Description: RichTextField;
}

type Props = ComponentWithContextProps & { fields: Fields };

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
    <section className="w-full bg-white">
      <div className="mx-auto w-full max-w-[1920px] px-0">
        <div className="mx-0 grid grid-cols-12 bg-[radial-gradient(circle_at_0%_100%,rgba(255,100,65,0.12),transparent_25%),radial-gradient(circle_at_100%_0%,rgba(120,80,255,0.12),transparent_25%),#ffffff] px-[19px] py-0 sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)]">
          <div className="col-span-12 flex w-full flex-col items-center px-0 py-6 text-center lg:py-8 xl:py-10">
            <div className="flex flex-1 flex-col gap-4 text-left">
              <small className="mx-auto block max-w-5xl text-center text-[14px] font-semibold uppercase leading-[115%] tracking-[0.5px] sm:text-[15px] sm:leading-[107%] lg:text-[16px] lg:leading-[120%]">
                <Text field={fields.Eyebrow} />
              </small>
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] text-[#1e1c22] sm:text-[clamp(1.625rem,0.998rem+1.565vw,2.25rem)] lg:text-[clamp(2.25rem,0.75rem+1.875vw,3rem)]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center text-[16px] leading-[150%] tracking-[0.16px] sm:text-[17px] sm:leading-[142%] sm:tracking-[0.085px] lg:text-[18px] lg:leading-[150%] lg:tracking-normal">
                <RichText field={fields.Description} />
              </div>
            </div>
          </div>
          <div className="col-span-12 flex flex-col items-center bg-transparent px-0 pb-8 lg:pb-10">
            <AppPlaceholder
              name={reportCardsName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
            <div className="mt-4 flex flex-col items-center justify-center gap-4 pt-0 md:flex-row md:flex-wrap md:items-start md:pt-6">
              <a
                href="https://www.sitecore.com/solutions/analyst-reports"
                className="flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 pr-4 text-[16px] font-medium leading-6 text-[#1e1c22] no-underline transition-colors duration-200 hover:border-[#4e06c2] hover:bg-[#4e06c2] hover:text-white"
              >
                See all Analyst Reports
                <span
                  aria-hidden="true"
                  className="ml-2 block h-[22px] w-[22px] bg-[#4e06c2] [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:22px_auto]"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
