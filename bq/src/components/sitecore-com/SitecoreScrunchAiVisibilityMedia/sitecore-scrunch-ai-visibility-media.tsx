import React, { type JSX } from 'react';
import { Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import VideoChrome from './sitecore-scrunch-ai-visibility-media.client';

import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';

interface Fields {
  Heading: Field<string>;
  Body: Field<string>;
  CTA: LinkField;
  'Video Thumbnail': ImageField;
  'Close Icon': ImageField;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_82%_20%,rgba(119,79,255,0.22),transparent_30%),radial-gradient(circle_at_12%_88%,rgba(255,74,109,0.14),transparent_28%),linear-gradient(135deg,#06162f_0%,#071b39_48%,#051329_100%)] py-14 text-white sm:py-12 lg:py-12">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18] [mask-image:linear-gradient(to_right,transparent,black_20%,black_85%,transparent)] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="pointer-events-none absolute -bottom-96 -right-48 z-0 h-[46rem] w-[46rem] rounded-full border border-[rgba(175,155,255,0.18)] shadow-[0_0_0_5rem_rgba(175,155,255,0.035),0_0_0_10rem_rgba(175,155,255,0.024)]" />
      <div className="relative z-10 mx-auto w-full max-w-[1440px]">
        <div className="grid w-full grid-cols-1 items-start gap-6 px-5 sm:gap-8 sm:px-8 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)] lg:grid-rows-[auto_auto] lg:items-center lg:gap-x-[clamp(3rem,6vw,7rem)] lg:gap-y-7 lg:px-16">
          <div className="flex w-full max-w-[38rem] flex-col items-start gap-5 lg:col-start-1 lg:row-start-1 lg:self-end">
            <h2 className="m-0 max-w-5xl text-balance text-[2.25rem] font-normal leading-normal tracking-[-0.84px] sm:text-[clamp(2.25rem,0.75rem+1.875vw,3rem)]">
              <Text field={fields.Heading} />
            </h2>
            <div className="w-full max-w-[36rem] text-[clamp(1rem,1.2vw,1.18rem)] leading-[1.65] text-[rgba(250,250,251,0.91)]">
              <RichText field={fields.Body} />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-3 lg:col-start-1 lg:row-start-2 lg:self-start">
            <Link
              field={fields.CTA}
              className="group relative flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 pr-4 font-medium leading-6 text-[#1e1c22] no-underline transition duration-200 hover:-translate-y-0.5 hover:border-[#4e06c2] hover:bg-[#4e06c2] hover:text-white"
            >
              {fields.CTA?.value?.text || fields.CTA?.value?.href || ''}
              <span
                aria-hidden="true"
                className="ml-2.5 block h-[22px] w-[22px] bg-[#4e06c2] transition-colors group-hover:bg-white"
                style={{
                  maskImage: 'url(https://www.sitecore.com/static/cta-arrow.svg)',
                  maskPosition: 'center',
                  maskRepeat: 'no-repeat',
                  maskSize: '22px auto',
                  WebkitMaskImage: 'url(https://www.sitecore.com/static/cta-arrow.svg)',
                  WebkitMaskPosition: 'center',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskSize: '22px auto',
                }}
              />
            </Link>
          </div>
          <figure className="relative m-0 w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <VideoChrome fields={fields} />
          </figure>
        </div>
      </div>
    </section>
  );
};

export default Default;
