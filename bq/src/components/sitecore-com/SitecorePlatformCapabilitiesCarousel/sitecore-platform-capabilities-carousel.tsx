import React, { JSX } from 'react';
import { Text, AppPlaceholder } from '@sitecore-content-sdk/nextjs';
import type { Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import componentMap from '.sitecore/component-map';
import Chrome from './sitecore-platform-capabilities-carousel.client';

interface Fields {
  Heading: Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields, rendering, page } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const phKey = params.DynamicPlaceholderId;
  const capabilityCardsBase = 'capability-cards';
  const capabilityCardsName = phKey ? `${capabilityCardsBase}-${phKey}` : capabilityCardsBase;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section id="tiles-capabilities" className="bg-transparent font-sans text-[#1e1c22]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid grid-cols-12 border-x border-b border-[#e4e2e8] bg-[radial-gradient(circle_at_0%_100%,rgba(255,31,56,0.12),transparent_25%),radial-gradient(circle_at_100%_0%,rgba(134,41,255,0.12),transparent_25%),#fff] px-[19px] sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)]">
          <div className="col-span-12 flex flex-col items-center border-b border-[#e4e2e8] py-6 text-center lg:py-8 xl:py-10">
            <div className="flex w-full flex-1 flex-col gap-4 text-left">
              <h2 className="mx-auto max-w-5xl text-center text-[14px] font-semibold uppercase leading-[115%] tracking-[0.5px] sm:text-[15px] lg:text-[16px] lg:leading-[120%]">
                <Text field={fields.Heading} />
              </h2>
            </div>
          </div>
          <div className="col-span-12 flex flex-col">
            <Chrome>
              <AppPlaceholder
                name={capabilityCardsName}
                rendering={rendering}
                page={page}
                componentMap={componentMap}
              />
            </Chrome>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
