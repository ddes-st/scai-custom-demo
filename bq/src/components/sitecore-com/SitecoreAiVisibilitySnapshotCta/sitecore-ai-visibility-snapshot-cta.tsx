import React, { JSX } from 'react';
import { Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: Field<string>;
  Body: Field<string>;
  'CTA Label': Field<string>;
  'CTA Link': LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="w-full bg-transparent font-['DM_Sans',sans-serif] text-[#1e1c22]">
      <div className="mx-auto w-full">
        <div
          className="mx-0 grid grid-cols-12 border-b border-x border-[#e4e2e8] bg-white px-[19px] md:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] md:px-[clamp(1.1875rem,-.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-.8571rem+4.4643vw,4.5rem)] lg:px-[clamp(2rem,.8571rem+1.7857vw,3rem)]"
          style={{
            background:
              'radial-gradient(circle at 0 100%, rgb(255 31 56 / 0.12) 0%, rgb(255 31 56 / 0) 25%), radial-gradient(circle at 100% 0, rgb(134 41 255 / 0.12) 0%, rgb(134 41 255 / 0) 25%), #fff',
          }}
        >
          <div className="col-span-12 flex w-full flex-col items-center py-6 text-center lg:py-8 xl:py-10">
            <div className="flex max-w-[900px] flex-1 flex-col gap-4 text-left">
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] md:text-[clamp(1.625rem,.998rem+1.565vw,2.25rem)] md:tracking-[-0.45px] lg:text-[clamp(2.25rem,.75rem+1.875vw,3rem)] lg:tracking-[-0.84px]">
                <Text field={fields.Heading} />
              </h2>
              <div className="mx-auto max-w-2xl text-center">
                <div className="mb-0 text-[16px] leading-[150%] tracking-[0.16px] md:text-[17px] md:leading-[142%] md:tracking-[0.085px] lg:text-[18px] lg:leading-[150%] lg:tracking-normal">
                  <RichText field={fields.Body} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-start">
              <div className="w-fit text-center">
                <Link
                  field={fields['CTA Link']}
                  className="relative flex items-center justify-between rounded-full bg-[linear-gradient(90deg,#ff1f38_0%,#7c25df_100%)] px-5 py-2 text-[16px] font-medium leading-6 text-white no-underline transition-[background-image,box-shadow] duration-200 hover:bg-[linear-gradient(90deg,#7c25df_0%,#ff1f38_100%)] md:text-[17px] md:tracking-[0.085px] lg:text-[18px] lg:tracking-normal"
                >
                  <Text field={fields['CTA Label']} />
                  <span
                    aria-hidden="true"
                    className="ml-[10px] block h-[22px] w-[22px] bg-current [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:22px_auto]"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
