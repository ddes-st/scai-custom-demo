import React, { JSX } from 'react';
import { Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  'Background Image': ImageField;
  Logo: ImageField;
  Eyebrow: Field<string>;
  Title: Field<string>;
  Description: Field<string>;
  Link: LinkField;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;
  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const hasBackground = Boolean(fields['Background Image']?.value?.src);
  const hasTitle = Boolean(fields.Title?.value);

  return (
    <div className="h-full">
      <Link
        field={fields.Link}
        className="relative block min-h-[320px] overflow-hidden rounded-lg bg-cover bg-center shadow-[0_4px_12px_rgba(0,0,0,0.15)] sm:min-h-[360px] md:min-h-[380px] lg:min-h-[420px]"
      >
        {hasBackground ? (
          <Image
            field={fields['Background Image']}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/80"
          aria-hidden="true"
        />
        <div className="relative z-10 flex min-h-[320px] flex-col justify-between p-5 text-white sm:min-h-[360px] md:min-h-[380px] lg:min-h-[420px] lg:p-5">
          <Image
            field={fields.Logo}
            className="h-auto max-h-10 w-auto max-w-[140px] object-contain lg:max-h-11 lg:max-w-[160px]"
          />
          <div className="mt-auto">
            <small className="mb-1 block text-[12px] font-medium uppercase leading-none tracking-[0.1em] text-white sm:text-[13px] lg:text-sm">
              <Text field={fields.Eyebrow} />
            </small>
            {hasTitle ? (
              <h3 className="mb-1 text-xl font-medium leading-tight tracking-[-0.05px] text-white sm:text-[22px] lg:text-[26px]">
                <Text field={fields.Title} />
              </h3>
            ) : null}
            <p className="text-base leading-tight text-white sm:text-[17px] lg:text-lg">
              <Text field={fields.Description} />
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default Default;
