import React, { JSX } from 'react';
import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { Field, ImageField, RichTextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface BenefitRow {
  Heading: Field<string>;
  Body: RichTextField;
  Icon: ImageField;
}
interface Fields {
  Heading: Field<string>;
  Items: BenefitRow[];
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => (
  <section className="flex h-full flex-col px-4 py-6 md:px-8">
    <div className="mx-auto max-w-[1180px]">
      <h2 className="mb-6 text-2xl font-bold leading-tight md:text-3xl">
        <Text field={props.fields.Heading} />
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(props.fields.Items ?? []).map((benefit: BenefitRow, index: number) => (
          <button
            key={index}
            type="button"
            className="flex min-h-[220px] flex-col rounded-2xl border border-[#abcffc] bg-white p-6 text-left shadow-[inset_0_0_0_1px_#abcffc]"
          >
            <span className="mb-6 flex justify-center text-blue-950">
              <Image field={benefit.Icon} />
            </span>
            <span className="text-xl font-bold leading-tight">
              <Text field={benefit.Heading} />
            </span>
            <RichText field={benefit.Body} />
          </button>
        ))}
      </div>
    </div>
  </section>
);
export default Default;
