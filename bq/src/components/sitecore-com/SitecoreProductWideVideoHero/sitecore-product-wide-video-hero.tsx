import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import Chrome from './sitecore-product-wide-video-hero.client';
import type { ImageField, LinkField, Field } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Logo: ImageField;
  'Heading Prefix': Field<string>;
  'Heading Highlight': Field<string>;
  'Heading Suffix': Field<string>;
  Body: Field<string>;
  'Primary CTA Label': Field<string>;
  'Primary CTA': LinkField;
  'Secondary CTA Label': Field<string>;
  'Secondary CTA': LinkField;
  'Video Thumbnail': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="bg-white text-[#1e1c22]">
      <div className="mx-auto w-full max-w-[1920px]">
        <div className="mx-0 grid grid-cols-12 gap-2 border-x border-b border-[#e4e2e8] px-[19px] py-12 sm:mx-[clamp(0rem,-3.3335rem+8.3338vw,2rem)] sm:gap-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] sm:px-[clamp(1.1875rem,-0.1667rem+3.3854vw,2rem)] lg:mx-[clamp(2rem,-0.8571rem+4.4643vw,4.5rem)] lg:gap-[clamp(2rem,0.8571rem+1.7857vw,3rem)] lg:px-[clamp(2rem,0.8571rem+1.7857vw,3rem)] lg:py-14 2xl:py-20">
          <div className="col-span-12 flex items-center xl:col-span-6 xl:col-start-1 xl:row-start-1">
            <div className="mx-auto w-full max-w-[42rem] text-center xl:mx-0 xl:max-w-none xl:text-left">
              <div className="mb-6 flex flex-col items-center justify-center gap-6 xl:items-start xl:justify-start">
                <Image field={fields.Logo} className="h-10 w-auto sm:h-12" />
              </div>
              <h1 className="text-[36px] font-semibold leading-[1.15] tracking-[-0.45px] sm:text-[clamp(2.125rem,1.2472rem+2.191vw,3rem)] sm:font-medium sm:leading-[1.34] sm:tracking-[-0.84px] lg:text-[56px] lg:leading-[1.15] lg:tracking-[-2px]">
                <Text field={fields['Heading Prefix']} />
                <span className="bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-transparent">
                  <Text field={fields['Heading Highlight']} />
                </span>
                <Text field={fields['Heading Suffix']} />
              </h1>
              <p className="mx-auto mt-4 max-w-[40rem] text-[18px] font-medium leading-normal text-[#4c4b4e] md:text-[20px] xl:mx-0 xl:max-w-2xl">
                <Text field={fields.Body} />
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center xl:items-start xl:justify-start">
                <Link
                  field={fields['Primary CTA']}
                  className="flex items-center justify-between rounded-full bg-gradient-to-r from-[#ff1f38] to-[#7c25df] px-5 py-2 text-[16px] font-medium leading-6 text-white sm:text-[18px]"
                >
                  <Text field={fields['Primary CTA Label']} />
                  <span
                    aria-hidden="true"
                    className="ml-2 block h-[22px] w-[22px] bg-current [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:22px_auto]"
                  />
                </Link>
                <Link
                  field={fields['Secondary CTA']}
                  className="flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 text-[16px] font-medium leading-6 text-[#1e1c22] sm:text-[18px]"
                >
                  <Text field={fields['Secondary CTA Label']} />
                  <span
                    aria-hidden="true"
                    className="ml-2 block h-[22px] w-[22px] bg-[#4e06c2] [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:22px_auto]"
                  />
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-12 mt-8 flex w-full flex-col items-center justify-center sm:mt-10 md:row-start-2 md:max-w-4xl lg:row-start-2 xl:col-span-6 xl:col-start-7 xl:row-start-1 xl:mt-0 xl:max-w-none">
            <Chrome thumbnail={fields['Video Thumbnail']} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
