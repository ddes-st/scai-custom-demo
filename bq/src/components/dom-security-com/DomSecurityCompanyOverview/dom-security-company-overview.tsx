import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  "Background Image": ImageField;
  Title: TextField;
  Body: RichTextField;
  "Dealer Count": TextField;
  "Dealer Label": TextField;
  CTA: LinkField;
}

type CompanyOverviewProps = ComponentProps & { fields: Fields };

export const Default = (props: CompanyOverviewProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative isolate overflow-hidden bg-white pb-[90px] font-['Source_Sans_Pro',sans-serif] font-light text-[#333]"
    >
      <div className="relative mx-auto min-h-[441px] max-w-[1170px] px-[15px]">
        <Image
          field={fields["Background Image"]}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-contain object-[90%_100%]"
        />

        <div className="relative z-10">
          <Text
            field={fields.Title}
            tag="h2"
            className="dom-accent max-w-[1140px]"
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
            <div className="relative z-10 lg:col-span-6 lg:pr-10">
              <RichText
                field={fields.Body}
                className="max-w-[555px] text-[18px] font-light leading-[30.06px] text-[#333] [&_p]:m-0"
              />
            </div>

            <div className="relative z-10 flex flex-col items-start lg:col-span-4 lg:col-start-8">
              <Text
                field={fields["Dealer Count"]}
                tag="span"
                className="block text-[70.2px] font-light leading-[77.22px] text-[#333]"
              />
              <Text
                field={fields["Dealer Label"]}
                tag="span"
                className="block max-w-[360px] text-[23.4px] font-light leading-[32.04px] text-[#333]"
              />
              <Link
                field={fields.CTA}
                className="mt-[10px] inline-flex items-center rounded-[50px] bg-[#d51130] px-5 py-[10px] text-[18px] font-normal leading-[25.7px] text-white no-underline transition-colors hover:bg-[#a50d25]"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true" className="ml-5 text-[18px] leading-none">↓</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
