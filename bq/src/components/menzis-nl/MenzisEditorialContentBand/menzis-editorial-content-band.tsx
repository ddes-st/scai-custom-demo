import { JSX } from 'react';
import { Text, RichText, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
interface Fields {
  Heading: Field<string>;
  Body: RichTextField;
  Image: ImageField;
  CTA: LinkField;
  Layout: Field<string>;
}
type Props = ComponentWithContextProps & { fields: Fields };
export const Default = (props: Props): JSX.Element => {
  const imageFirst = String(props.fields.Layout?.value ?? '') === 'image-text';
  return (
    <section className="px-4 py-6 md:px-8">
      <div className="mx-auto grid max-w-[118rem] items-center gap-4 lg:grid-cols-12">
        {imageFirst ? (
          <>
            <div className="lg:col-span-4">
              <Image field={props.fields.Image} />
            </div>
            <div className="lg:col-span-8">
              <h2 className="mb-4 pt-2 text-2xl font-bold leading-8 md:text-[2.8rem] md:leading-9">
                <Text field={props.fields.Heading} />
              </h2>
              <RichText field={props.fields.Body} />
              <Link
                field={props.fields.CTA}
                className="my-[1.1rem] inline-block rounded-lg px-5 py-4 font-bold text-[#043572] shadow-[inset_0_0_0_1px_#043572]"
              />
            </div>
          </>
        ) : (
          <>
            <div className="order-2 md:order-1 lg:col-span-8">
              <h2 className="mb-4 pt-2 text-2xl font-bold leading-8 md:text-[2.8rem] md:leading-9">
                <Text field={props.fields.Heading} />
              </h2>
              <RichText field={props.fields.Body} />
              <Link
                field={props.fields.CTA}
                className="my-[1.1rem] inline-block rounded-lg px-5 py-4 font-bold text-[#043572] shadow-[inset_0_0_0_1px_#043572]"
              />
            </div>
            <div className="order-1 md:order-2 lg:col-span-4">
              <Image field={props.fields.Image} />
            </div>
          </>
        )}
      </div>
    </section>
  );
};
