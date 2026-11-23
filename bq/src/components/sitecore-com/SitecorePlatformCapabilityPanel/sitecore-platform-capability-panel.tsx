import React, { type JSX } from 'react';
import {
  Image,
  Link,
  RichText,
  Text,
  type Field,
  type ImageField,
  type LinkField,
  type RichTextField,
} from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  Title: Field<string>;
  Action: Field<string>;
  Tagline: Field<string>;
  Description: RichTextField;
  CTA: LinkField;
  Icon: ImageField;
  Foundation: Field<string>;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props): JSX.Element => {
  const { fields } = props;

  if (!fields) {
    return <div>Missing Component Datasource.</div>;
  }

  const title = fields.Title?.value || '';
  const action = fields.Action?.value || '';

  return (
    <article
      data-capability-card
      data-title={title}
      data-action={action}
      className="relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-[#e4e2e8] bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.06)] sm:min-h-[320px] sm:p-6 lg:min-h-[360px] lg:p-6"
    >
      <Image
        field={fields.Icon}
        className="pointer-events-none absolute -bottom-8 -right-12 h-64 w-64 rotate-[-9deg] opacity-[0.05]"
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <Image
            field={fields.Icon}
            className="hidden h-10 w-10 shrink-0 object-contain sm:block"
          />
          <div className="min-w-0 flex-1">
            <h3 className="bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text text-xl font-medium text-transparent sm:text-2xl">
              <Text field={fields.Title} />
            </h3>
            <p className="mt-1 text-base font-semibold leading-6 sm:text-lg">
              <Text field={fields.Tagline} />
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-4 flex flex-1 flex-col gap-3 text-sm leading-6 sm:text-base">
          <RichText field={fields.Description} />
          <div className="mt-auto pt-2">
            <Link
              field={fields.CTA}
              className="inline-flex items-center rounded-full bg-[#4e06c2] px-5 py-2 font-medium leading-6 text-white transition hover:bg-white hover:text-[#4e06c2] hover:ring-1 hover:ring-[#4e06c2]"
            >
              <span className="ml-0">
                {fields.CTA?.value?.text || fields.CTA?.value?.href || ''}
              </span>
              <span className="ml-2 text-xl leading-none">→</span>
            </Link>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-2 border-t border-[#e4e2e8] pt-3 text-sm leading-5 sm:items-center">
          <span className="h-6 w-6 shrink-0">
            <Image field={fields.Icon} className="h-6 w-6 object-contain" />
          </span>
          <p>
            <strong className="bg-gradient-to-r from-[#ff1f38] to-[#8629ff] bg-clip-text font-semibold text-transparent">
              AI stands for Already Included
            </strong>
            <span>
              — <Text field={fields.Foundation} />
            </span>
          </p>
        </div>
      </div>
    </article>
  );
};

export default Default;
