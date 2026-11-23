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
      className="bg-[#e3e3e3] font-[Source_Sans_Pro] font-light text-black"
    >
      <div className="flex flex-col lg:grid lg:grid-cols-[3fr_2fr]">
        <div className="order-1 flex min-h-[204px] items-stretch px-[15px] py-[2rem] lg:order-none lg:min-h-[374px] lg:px-[42px]">
          <div className="flex w-full flex-col justify-between lg:mx-auto lg:max-w-[555px] lg:justify-center">
            <Text
              field={fields.Heading}
              tag="h2"
              className="m-0 text-[1.27rem] font-light leading-normal lg:text-[2.55rem] lg:leading-[2.78rem]"
            />
            <Text
              field={fields.Subtitle}
              tag="p"
              className="m-0 max-w-[390px] text-[0.67rem] font-light leading-[1.35] text-[#646363] lg:mb-[2.22rem] lg:text-[1rem] lg:leading-[1.67]"
            />
            <DealerFinderSearch
              placeholder={placeholder}
              searchLink={fields["Search Link"]}
              ctaText={ctaText}
            />
          </div>
        </div>
        <div className="order-none h-[193px] overflow-hidden lg:h-[374px] lg:order-1">
          <Image
            field={fields.Image}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};
