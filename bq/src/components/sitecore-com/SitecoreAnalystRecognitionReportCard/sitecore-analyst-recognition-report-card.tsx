import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Logo: ImageField;
  Title: Field<string>;
  'CTA Label': Field<string>;
  Link: LinkField;
  Target: Field<string>;
}

type Props = ComponentWithContextProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const target = fields.Target?.value || undefined;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-3">
      <Link
        field={fields.Link}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        aria-label={fields.Title?.value || undefined}
        className="group relative flex w-full cursor-pointer flex-col items-center rounded-lg bg-white px-5 py-8 text-center text-[#1e1c22] no-underline shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(147,51,234,0.15)] md:flex-row md:items-center md:rounded-[8.5px] md:px-6 md:py-4 md:text-left lg:rounded-[9px]"
      >
        <div className="flex w-auto shrink-0 items-center justify-center px-4 pb-3 md:w-[130px] md:px-3 md:pb-0 lg:w-[150px] lg:px-4">
          <Image
            field={fields.Logo}
            className="block max-h-7 max-w-[100px] object-contain md:max-h-6 md:max-w-[90px] lg:max-h-7 lg:max-w-[110px]"
          />
        </div>
        <div
          className="hidden h-10 w-px shrink-0 bg-[#e4e2e8] md:block md:mx-3 lg:mx-4"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col items-center py-3 md:items-start md:py-0 md:pr-4">
          <h3 className="m-0 text-[18px] font-medium leading-[1.5] tracking-normal transition-colors duration-300 group-hover:text-[#5f25e7] md:text-[17px] md:leading-[142%] lg:text-[18px] lg:leading-[150%]">
            <Text field={fields.Title} />
          </h3>
        </div>
        <div className="shrink-0 md:ml-auto md:pl-4">
          <span className="mt-3 flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 pr-4 text-[16px] font-medium leading-6 text-[#1e1c22] transition-colors duration-200 group-hover:border-[#4e06c2] group-hover:bg-[#4e06c2] group-hover:text-white md:mt-0">
            <Text field={fields['CTA Label']} />
            <span
              aria-hidden="true"
              className="ml-2 block h-[22px] w-[22px] bg-[#4e06c2] [mask-image:url('https://www.sitecore.com/static/cta-arrow.svg')] [mask-position:50%_center] [mask-repeat:no-repeat] [mask-size:22px_auto] group-hover:bg-white"
            />
          </span>
        </div>
      </Link>
    </div>
  );
};

export default Default;
