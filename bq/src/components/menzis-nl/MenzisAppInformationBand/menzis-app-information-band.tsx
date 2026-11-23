import { JSX } from 'react';
import { Text, RichText, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields {
  Heading: Field<string>;
  Intro: RichTextField;
  Benefits: RichTextField;
  Body: RichTextField;
  Image: ImageField;
  IOS: LinkField;
  Android: LinkField;
  More: LinkField;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => (
  <section className="px-4 py-6 md:px-8">
    <div className="mx-auto grid max-w-[118rem] items-center gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <h2 className="mb-4 pt-2 text-2xl font-bold md:text-[2.8rem]">
          <Text field={props.fields.Heading} />
        </h2>
        <RichText field={props.fields.Intro} />
        <RichText field={props.fields.Benefits} />
        <RichText field={props.fields.Body} />
        <Link
          field={props.fields.IOS}
          className="my-[1.1rem] mr-2 inline-block rounded-lg px-5 py-4 font-bold text-[#043572] shadow-[inset_0_0_0_1px_#043572]"
        />
        <Link
          field={props.fields.Android}
          className="my-[1.1rem] mr-2 inline-block rounded-lg px-5 py-4 font-bold text-[#043572] shadow-[inset_0_0_0_1px_#043572]"
        />
        <p>
          <Link field={props.fields.More} className="underline" />
        </p>
      </div>
      <div className="lg:col-span-4">
        <Image field={props.fields.Image} />
      </div>
    </div>
  </section>
);
