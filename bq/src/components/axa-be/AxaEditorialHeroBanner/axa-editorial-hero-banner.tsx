import { Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ComponentProps } from "lib/component-props";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
  "Desktop Image": ImageField;
  "Mobile Image": ImageField;
  CTA: LinkField;
}

type EditorialHeroBannerProps = ComponentProps & { fields: Fields };

export const Default = (props: EditorialHeroBannerProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative isolate h-[250px] overflow-hidden rounded-[12px] bg-[#4a4c5a] text-white lg:h-[400px]"
    >
      <div className="absolute inset-0 hidden lg:block">
        <Image
          field={fields["Desktop Image"]}
          className="h-full w-full object-cover object-[26%_41%]"
        />
      </div>
      <div className="absolute inset-0 lg:hidden">
        <Image
          field={fields["Mobile Image"]}
          className="h-full w-full object-cover object-[37%_29%]"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-black/70" />
      <div className="relative mx-auto flex h-full w-full items-center justify-end px-5 lg:max-w-[1110px] lg:px-5">
        <div className="w-[39%] -translate-y-5 lg:-translate-y-5">
          <div className="mb-4 lg:mb-6">
            <Text
              field={fields.Heading}
              tag="h1"
              className="font-[Publico] text-[18px] font-light leading-[1.2] text-white lg:text-[32px]"
            />
          </div>
          <Link
            field={fields.CTA}
            className="inline-flex items-center text-[14px] font-semibold leading-6 text-white underline decoration-white/40 underline-offset-[0.3em] lg:text-[16px]"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-3 no-underline">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
};
