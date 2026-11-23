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
      className="relative isolate min-h-[560px] overflow-hidden bg-white pb-8 font-[Source_Sans_Pro] text-black lg:min-h-[560px] lg:pb-20"
    >
      <div className="relative mx-auto min-h-[560px] max-w-[1170px] px-[15px] lg:min-h-[560px]">
        <Image
          field={fields["Background Image"]}
          className="pointer-events-none absolute right-[-5%] top-0 z-0 h-[470px] w-[54%] object-contain object-right-bottom max-lg:right-[-8%] max-lg:top-8 max-lg:h-[320px] max-lg:w-[62%] lg:right-[-2%] lg:top-0 lg:h-[470px] lg:w-[52%]"
        />

        <div className="relative z-10">
          <div className="mb-12 max-w-[970px] pl-[15px] lg:mb-24 lg:pl-0">
            <div className="flex items-start">
              <span aria-hidden="true" className="mt-[0.2rem] mr-4 block h-[1rem] w-[3px] shrink-0 bg-[#d51130] lg:mt-[0.55rem] lg:h-[1.6rem]" />
              <Text
                field={fields.Title}
                tag="h2"
                className="m-0 max-w-[920px] text-[1.278rem] font-light leading-[1.09] text-[#222] lg:text-[2.55rem]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
            <div className="relative z-10 lg:col-span-6 lg:pr-10">
              <RichText
                field={fields.Body}
                className="max-w-[350px] text-[0.78rem] font-light leading-[1.35] text-[#646363] lg:max-w-[500px] lg:text-[1rem] lg:leading-[1.67rem]"
              />
            </div>

            <div className="relative z-10 flex flex-col items-start lg:col-span-4 lg:col-start-9 lg:pl-0">
              <div className="mt-[82px] flex items-baseline gap-3 lg:mt-0">
                <Text
                  field={fields["Dealer Count"]}
                  tag="span"
                  className="text-[1.56rem] font-light leading-[1.1] text-[#222] lg:text-[3.9rem]"
                />
                <Text
                  field={fields["Dealer Label"]}
                  tag="span"
                  className="max-w-[250px] text-[1rem] font-light leading-[1.15] text-[#333] lg:max-w-[245px] lg:text-[1.3rem] lg:leading-[1.37]"
                />
              </div>
              <Link
                field={fields.CTA}
                className="mt-8 inline-flex items-center rounded-[50px] bg-[#d51130] px-5 py-[10px] text-base font-semibold leading-[1.43] text-white no-underline transition-colors hover:bg-[#a50d25] lg:mt-4"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true" className="ml-5 text-[1.5rem] leading-none">↓</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
