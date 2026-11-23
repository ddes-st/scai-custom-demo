import React, { JSX } from 'react';
import { Image, Link, Text, RichText } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, Field, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  'Desktop Image': ImageField;
  'Tablet Image': ImageField;
  'Mobile Image': ImageField;
  'Desktop Pebble Shape': ImageField;
  'Mobile Pebble Shape': ImageField;
  CTA: LinkField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="relative z-20 w-full overflow-hidden bg-gradient-to-b from-[#f0f7fe] from-0% to-white to-[89.56%] font-['Geologica',Arial,sans-serif] text-[#043572]">
      <div className="relative mx-auto min-h-[440px] max-w-[1180px] pb-6">
        <div className="px-[18px] pt-6 md:px-8 md:pt-16 lg:px-0">
          <div
            className="relative grid grid-cols-1 gap-0 lg:grid-cols-8 md:grid-rows-[auto_auto_auto_auto_auto] md:gap-x-8"
            aria-label={String(fields.Heading?.value ?? '')}
            role="region"
          >
            <h1 className="relative z-10 m-0 mb-6 max-w-[620px] text-[2.6rem] font-black leading-[3.6rem] text-[#043572] lg:col-span-3 md:col-start-1 md:row-start-1 md:text-[3.8rem] md:leading-[4.2rem] lg:text-[4.6rem] lg:leading-[4.8rem]">
              <Text field={fields.Heading} />
            </h1>
            <div className="relative z-10 mb-6 max-w-[590px] text-base font-normal leading-6 text-[#043572] lg:col-span-3 md:col-start-1 md:row-start-3 md:text-lg md:leading-7">
              <RichText field={fields.Body} />
            </div>
            <div className="relative z-10 mb-6 lg:col-span-3 md:col-start-1 md:row-start-5">
              <Link
                field={fields.CTA}
                className="block w-full rounded-lg bg-[#fec352] px-5 py-4 text-center text-base font-bold leading-[1.8rem] text-[#1e1400] no-underline transition-colors hover:bg-[#fcb53c] md:w-max"
              />
            </div>
            <div className="relative -mx-[18px] w-[calc(100%+36px)] overflow-hidden md:absolute md:right-0 md:top-0 lg:col-span-4 lg:col-start-5 md:row-span-5 md:row-start-1 md:mx-0 md:h-[600px] md:w-[115%] md:overflow-visible">
              <div className="relative h-full w-full md:absolute md:inset-x-0 md:top-[calc(-72%+260px)] md:h-[82%]">
                <div className="pointer-events-none absolute -inset-0.5 z-0 hidden bg-[#fbc247] md:block md:[clip-path:polygon(18%_0,100%_0,100%_100%,15%_100%,0_58%,0_39%)]" />
                <figure className="relative z-10 m-0 h-full w-full overflow-hidden rounded-2xl md:rounded-none md:[clip-path:polygon(18%_0,100%_0,100%_100%,15%_100%,0_58%,0_39%)]">
                  <div className="block h-full w-full md:flex md:items-end">
                    <Image
                      field={fields['Desktop Image']}
                      className="hidden h-auto w-full object-cover align-bottom md:block md:h-[520px] md:max-w-none"
                    />
                    <Image
                      field={fields['Tablet Image']}
                      className="hidden h-auto w-full object-cover align-bottom sm:block md:hidden"
                    />
                    <Image
                      field={fields['Mobile Image']}
                      className="block h-auto w-full object-cover align-bottom sm:hidden"
                    />
                  </div>
                </figure>
                <div className="sr-only" aria-hidden="true">
                  <Image field={fields['Desktop Pebble Shape']} />
                  <Image field={fields['Mobile Pebble Shape']} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Default;
