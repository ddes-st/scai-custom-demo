import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Logo: ImageField;
  Title: Field<string>;
  CTA: Field<string>;
  'Report Link': LinkField;
  'Open in New Window': Field<boolean>;
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
  const { fields } = props;
  const openInNewWindow =
    fields['Open in New Window']?.value === true ||
    String(fields['Open in New Window']?.value) === '1';

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  return (
    <Link
      field={fields['Report Link']}
      target={openInNewWindow ? '_blank' : undefined}
      aria-label={fields.Title?.value || undefined}
      className="group relative flex w-full cursor-pointer flex-col items-center rounded-lg bg-white px-5 py-8 text-center text-[#1e1c22] no-underline shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(147,51,234,0.15)] md:flex-row md:items-center md:rounded-[8.5px] md:px-6 md:py-4 md:text-left lg:rounded-[9px]"
    >
      <div className="flex w-auto shrink-0 items-center justify-center px-4 pb-3 md:w-[130px] md:px-3 md:pb-0 lg:w-[150px] lg:px-4">
        <Image
          field={fields.Logo}
          className="block h-auto max-h-7 max-w-[100px] md:max-h-6 md:max-w-[90px] lg:max-h-7 lg:max-w-[110px]"
        />
      </div>
      <div
        className="hidden h-10 w-px shrink-0 bg-[#e4e2e8] md:mx-3 md:block lg:mx-4"
        aria-hidden="true"
      />
      <div className="mt-3 flex min-w-0 flex-1 flex-col items-center md:my-0 md:items-start md:pr-4">
        <h3 className="m-0 text-[18px] font-medium leading-[1.5] tracking-normal text-[#1e1c22] transition-colors duration-300 group-hover:text-[#5f25e7] sm:text-[17px] sm:leading-[1.42] lg:text-[18px] lg:leading-[1.5]">
          <Text field={fields.Title} />
        </h3>
      </div>
      <div className="mt-3 shrink-0 md:ml-auto md:mt-0 md:pl-4">
        <span className="flex items-center justify-between rounded-full border border-[#c1bdc7] bg-white px-5 py-2 font-medium leading-6 text-[#1e1c22] transition-colors duration-200 group-hover:border-[#4e06c2] group-hover:bg-[#4e06c2] group-hover:text-white">
          <Text field={fields.CTA} />
          <Arrow />
        </span>
      </div>
    </Link>
  );
};
