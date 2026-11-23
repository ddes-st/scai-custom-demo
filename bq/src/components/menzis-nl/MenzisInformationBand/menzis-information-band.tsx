import { JSX } from 'react';
import { Text, RichText, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  CTA: LinkField;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => (
  <section className="px-4 py-6 md:px-8">
    <div className="mx-auto grid max-w-[118rem] lg:grid-cols-12">
      <div className="lg:col-span-8">
        <h2 className="mb-4 pt-2 text-2xl font-bold md:text-[2.8rem]">
          <Text field={props.fields.Heading} />
        </h2>
        <RichText field={props.fields.Body} />
        <Link field={props.fields.CTA} className="underline" />
      </div>
    </div>
  </section>
);
