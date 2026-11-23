import React, { JSX } from 'react';
import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, Field } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: Field<string>;
  'CTA Label': Field<string>;
  CTA: LinkField;
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
          className="mx-0 grid grid-cols-12 border-x border-b border-[#e4e2e8] px-[19px] md:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] md:gap-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] md:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:gap-[clamp(2rem,0.8571rem+1.7857vw,3rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)]"
          style={{
            background:
              'radial-gradient(circle at 0% 100%, rgba(255, 31, 56, 0.12) 0%, rgba(255, 31, 56, 0) 25%), radial-gradient(circle at 100% 0%, rgba(134, 41, 255, 0.12) 0%, rgba(134, 41, 255, 0) 25%), #ffffff',
          }}
        >
          <div className="col-span-12 flex w-full flex-col items-center py-6 text-center lg:py-8 xl:py-10">
            <div className="flex max-w-5xl flex-1 flex-col gap-4 text-left">
              <h2 className="mx-auto max-w-5xl text-center text-[26px] font-normal leading-normal tracking-[-0.195px] md:text-[clamp(1.625rem,0.998rem+1.565vw,2.25rem)] md:tracking-[-0.45px] lg:text-[clamp(2.25rem,0.75rem+1.875vw,3rem)] lg:tracking-[-0.84px]">
                <Text field={fields.Heading} />
              </h2>
            </div>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-start">
              <Link
                field={fields.CTA}
                className="flex w-fit items-center justify-between rounded-full bg-[linear-gradient(90deg,#ff1f38_0%,#7c25df_100%)] px-5 py-2 text-center text-base font-medium leading-6 text-white transition-[background-color,border-color,box-shadow] duration-200 sm:text-[18px] sm:leading-[27px]"
              >
                <span>
                  <Text field={fields['CTA Label']} />
                </span>
                <span
                  aria-hidden="true"
                  className="ml-2.5 block h-[22px] w-[22px] bg-current [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:22px_auto]"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
