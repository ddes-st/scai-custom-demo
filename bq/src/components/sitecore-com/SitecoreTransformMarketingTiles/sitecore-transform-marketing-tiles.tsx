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
  const cardsBase = 'trusted-answer-cards';
  const cardsName = phKey ? `${cardsBase}-${phKey}` : cardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section
      id="tiles-answer"
      className="bg-transparent font-['DM_Sans',sans-serif] text-[#1e1c22]"
    >
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid grid-cols-12 border-x border-b border-[#e4e2e8] bg-[radial-gradient(circle_at_0%_100%,rgba(255,31,56,0.12)_0%,rgba(255,31,56,0)_25%),radial-gradient(circle_at_100%_0%,rgba(134,41,255,0.12)_0%,rgba(134,41,255,0)_25%),#fff] px-[19px] sm:mx-[clamp(0px,calc(-3.3335rem+8.3338vw),2rem)] sm:px-[clamp(1.1875rem,calc(-0.1667rem+3.3854vw),2rem)] lg:mx-[clamp(2rem,calc(-0.8571rem+4.4643vw),4.5rem)] lg:gap-[clamp(2rem,calc(0.8571rem+1.7857vw),3rem)] lg:px-[clamp(2rem,calc(0.8571rem+1.7857vw),3rem)]">
          <div className="col-span-12 flex w-full flex-col items-center border-b border-[#e4e2e8] py-6 text-center lg:py-8 xl:py-10">
            <div className="flex max-w-5xl flex-1 flex-col gap-4 text-left">
              <small className="mx-auto block text-center text-[14px] font-semibold uppercase leading-[115%] tracking-[0.5px] sm:text-[15px] lg:text-[16px] lg:leading-[120%]">
                <Text field={fields.Eyebrow} />
              </small>
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] sm:text-[32px] lg:text-[42px] lg:tracking-[-0.84px]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center">
                <RichText field={fields.Description} />
              </div>
            </div>
          </div>
          <div className="col-span-12 mx-auto grid w-full max-w-[1530px] grid-cols-1 gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3 lg:py-10 xl:py-12">
            <AppPlaceholder
              name={cardsName}
              rendering={rendering}
              page={page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
