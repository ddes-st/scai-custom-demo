import { Image, Link, RichText, Text, type ImageField, type LinkField, type RichTextField, type TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

export interface Fields {
  Category: TextField;
  "Product Links": RichTextField;
  "Service Links": RichTextField;
  "Feature Title": TextField;
  "Feature Link": LinkField;
  "Feature Image": ImageField;
}

type InsuranceMenuProps = ComponentProps & { fields: Fields };

export const Default = (props: InsuranceMenuProps) => {
  const { fields } = props;

  return (
    <section
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="absolute left-0 right-0 top-full z-30 border-t border-slate-200 bg-white px-5 py-6 text-[#00008f] shadow-sm md:px-10 lg:px-12"
    >
      <div className="mx-auto grid max-w-[1110px] grid-cols-1 gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <Text field={fields.Category} tag="h2" className="font-publico text-xl font-light text-[#00008f]" />
          <RichText
            field={fields["Product Links"]}
            className="mt-4 border-l border-[#00008f]/20 pl-4 font-source text-base leading-8 [&_a]:text-[#00008f] [&_a]:no-underline [&_a]:hover:underline [&_li]:list-none"
          />
        </div>

        <div className="grid gap-6 rounded-sm bg-[#eef3ff] p-5 md:grid-cols-2 md:p-6">
          <div>
            <h3 className="font-publico text-lg font-light text-[#00008f]">Beschikbare diensten en voordelen</h3>
            <RichText
              field={fields["Service Links"]}
              className="mt-3 font-source text-base leading-8 text-[#00008f] [&_a]:text-[#00008f] [&_a]:no-underline [&_a]:hover:underline [&_li]:list-none"
            />
          </div>

          <article className="overflow-hidden rounded-sm bg-white">
            <div className="relative h-40 bg-[#5f5f5f] md:h-48">
              <Image field={fields["Feature Image"]} className="h-full w-full object-cover" />
              <div className="absolute inset-x-3 bottom-3 flex items-end gap-3 bg-black/60 p-3 text-white">
                <Text field={fields["Feature Title"]} tag="h3" className="flex-1 font-publico text-lg font-light" />
                <Link field={fields["Feature Link"]} className="shrink-0 text-xl text-white no-underline" aria-label="Meer informatie">
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};
