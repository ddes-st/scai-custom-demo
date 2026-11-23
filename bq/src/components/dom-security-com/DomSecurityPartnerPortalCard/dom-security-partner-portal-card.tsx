import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Heading: TextField;
  Description: RichTextField;
  "Card Subtitle": TextField;
  "Card Title": TextField;
  "Portal Link": LinkField;
  "Portal Image": ImageField;
}

type PartnerPortalCardProps = ComponentProps & { fields: Fields };

export const Default = (props: PartnerPortalCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white px-[15px] pt-8 pb-4 font-['Source_Sans_Pro',sans-serif] font-light text-[#333] lg:pt-[90px] lg:pb-[90px]"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <div className="w-full">
          <Text
            field={fields.Heading}
            tag="h2"
            className="dom-accent dom-accent-snug"
          />
          <RichText
            field={fields.Description}
            className="mb-7 max-w-[1140px] text-[16px] font-light leading-[22px] text-[#333] lg:mb-8 lg:text-[18px] lg:leading-[30.06px] [&_p]:m-0"
          />
        </div>

        <div className="w-full lg:w-1/2 lg:pr-[15px]">
          <article className="relative min-h-[50px] pb-2 lg:min-h-[180px] lg:pb-4">
            <Link
              field={fields["Portal Link"]}
              target="_blank"
              className="relative block text-[#333] no-underline hover:no-underline focus:no-underline"
            >
              <div className="relative overflow-hidden">
                <Image
                  field={fields["Portal Image"]}
                  className="block aspect-[1.72] h-auto w-full object-cover lg:scale-110 lg:transition-transform lg:duration-300"
                />
              </div>
              <div className="absolute bottom-0 left-[15px] w-[calc(100%-30px)] bg-white py-[18px] pr-[45px] pl-[30.6px] text-black shadow-[7px_7px_65px_-16px_rgba(0,0,0,0.75)]">
                <Text
                  field={fields["Card Subtitle"]}
                  tag="h3"
                  className="m-0 text-[14px] font-medium leading-[16px] text-[#d51130] lg:text-[19.8px] lg:leading-[25px]"
                />
                <Text
                  field={fields["Card Title"]}
                  tag="h3"
                  className="m-0 text-[15px] font-normal leading-normal text-black lg:text-[24.3px]"
                />
                <span aria-hidden="true" className="absolute right-[23.4px] bottom-[18px] text-[18px] leading-none text-[#00a0de]">
                  →
                </span>
              </div>
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
};
