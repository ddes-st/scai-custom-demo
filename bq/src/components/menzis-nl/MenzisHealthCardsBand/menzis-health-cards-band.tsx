import { JSX } from 'react';
import { Text, RichText, Image, Link } from '@sitecore-content-sdk/nextjs';
import type { Field, RichTextField, ImageField, LinkField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import { getDatasource, getFieldValue } from 'lib/component-props';

type GqlField<T> = T | { jsonValue?: T };

type CardChild = {
  title?: GqlField<Field<string>>;
  text?: GqlField<RichTextField>;
  image?: GqlField<ImageField>;
  link?: GqlField<LinkField>;
  cta?: GqlField<LinkField>;
  fields?: {
    Title?: Field<string>;
    Text?: RichTextField;
    Image?: ImageField;
    Link?: LinkField;
    CTA?: LinkField;
  };
};

type Datasource = {
  heading?: GqlField<Field<string>>;
  Heading?: Field<string>;
  children?: { results?: CardChild[] };
};

type Props = ComponentWithContextProps & {
  fields?: Datasource | { data?: { datasource?: Datasource } };
};

export const Default = (props: Props): JSX.Element => {
  const datasource = getDatasource<Datasource>(props.fields);
  const heading =
    getFieldValue(datasource?.heading) ?? datasource?.Heading;
  const cards = datasource?.children?.results ?? [];

  return (
    <section className="px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[118rem]">
        <h2 className="mb-4 pt-2 text-2xl font-bold md:text-[2.8rem]">
          <Text field={heading} />
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {cards.map((card: CardChild, index: number) => {
            const title = getFieldValue(card.title) ?? card.fields?.Title;
            const text = getFieldValue(card.text) ?? card.fields?.Text;
            const image = getFieldValue(card.image) ?? card.fields?.Image;
            const link = getFieldValue(card.link) ?? card.fields?.Link;
            const cta = getFieldValue(card.cta) ?? card.fields?.CTA;
            return (
              <article key={index}>
                {link ? (
                  <Link field={link}>
                    <Image field={image} />
                  </Link>
                ) : (
                  <Image field={image} />
                )}
                <h3 className="mb-2 pt-2 text-xl font-bold md:text-[2.2rem]">
                  <Text field={title} />
                </h3>
                <RichText field={text} />
                {cta ? (
                  <Link
                    field={cta}
                    className="my-[1.1rem] inline-block rounded-lg px-5 py-4 font-bold text-[#043572] shadow-[inset_0_0_0_1px_#043572]"
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
