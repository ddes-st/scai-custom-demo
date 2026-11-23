import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Heading: RichTextField;
  CTA: LinkField;
  "Desktop Image": ImageField;
  "Tablet Image": ImageField;
  "Mobile Image": ImageField;
  Alignment: TextField;
}

type EditorialHeroProps = ComponentProps & { fields: Fields };

export const Default = (props: EditorialHeroProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative mx-auto mt-2 h-[250px] w-full max-w-[1920px] overflow-hidden rounded-[12px] bg-[#4a4c5a] text-white lg:h-[400px]"
    >
      <div className="absolute inset-0">
        <Image
          field={fields["Mobile Image"]}
          className="block h-full w-full object-cover object-[37%_29%] md:hidden"
        />
        <Image
          field={fields["Tablet Image"]}
          className="hidden h-full w-full object-cover object-[37%_29%] md:max-lg:block"
        />
        <Image
          field={fields["Desktop Image"]}
          className="hidden h-full w-full object-cover object-[26%_41%] lg:block"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-black/75" />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-[1110px] items-center justify-end px-5">
        <div className="w-[39%] min-w-0 -translate-y-1 lg:-translate-y-10">
          <div className="mb-6">
            <RichText
              field={fields.Heading}
              tag="h1"
              className="font-['Publico'] text-[26px] font-light leading-[1.2] lg:text-[32px]"
            />
          </div>
          <Link
            field={fields.CTA}
            className="group inline-flex items-center font-['Source_Sans_Pro'] text-[14px] font-semibold text-white lg:text-base"
            showLinkTextWithChildrenPresent
          >
            <span className="ml-4 no-underline transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </Link>
          <Text field={fields.Alignment} className="sr-only" />
        </div>
      </div>
    </section>
  );
};
