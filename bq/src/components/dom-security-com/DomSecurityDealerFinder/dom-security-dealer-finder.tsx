import { Image, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";
import DealerFinderSearch from "./dom-security-dealer-finder.search";

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
  Image: ImageField;
  "Postal Code Placeholder": TextField;
  "Search Link": LinkField;
}

type DealerFinderProps = ComponentProps & { fields: Fields };

export const Default = (props: DealerFinderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const placeholder = typeof fields["Postal Code Placeholder"]?.value === "string"
    ? fields["Postal Code Placeholder"].value
    : undefined;
  const ctaText =
    typeof fields["Search Link"]?.value?.text === "string"
      ? fields["Search Link"].value.text
      : undefined;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#e3e3e3] font-['Source_Sans_Pro',sans-serif] font-light text-[#333]"
    >
      <div className="flex flex-col lg:grid lg:min-h-[338px] lg:grid-cols-2 lg:items-stretch">
        <div className="order-1 flex items-center px-[15px] py-8 lg:order-none lg:justify-end lg:py-9 lg:pr-[15px] lg:pl-[15px]">
          <div className="w-full max-w-[555px]">
            <Text
              field={fields.Heading}
              tag="h2"
              className="m-0 mb-8 text-[28px] font-light leading-[34px] text-[#333] lg:mb-[90px] lg:text-[45.9px] lg:leading-[50.04px]"
            />
            <Text
              field={fields.Subtitle}
              tag="p"
              className="m-0 mb-6 max-w-[555px] text-[14px] font-light leading-5 text-[#646363] lg:mb-[40px] lg:text-[18px] lg:leading-9"
            />
            <DealerFinderSearch
              placeholder={placeholder}
              searchLink={fields["Search Link"]}
              ctaText={ctaText}
            />
          </div>
        </div>
        <div className="relative order-none h-[193px] overflow-hidden lg:h-auto lg:min-h-[338px] lg:order-1">
          <Image
            field={fields.Image}
            className="h-full w-full object-cover lg:absolute lg:inset-0"
          />
        </div>
      </div>
    </section>
  );
};
