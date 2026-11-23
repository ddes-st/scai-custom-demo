import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ComponentProps } from "lib/component-props";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
  Benefits: RichTextField;
  CTA: LinkField;
  "Broker Logo": ImageField;
  "Desktop Image": ImageField;
  "Mobile Image": ImageField;
}

type BrokerCalloutProps = ComponentProps & { fields: Fields };

export const Default = (props: BrokerCalloutProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative w-full rounded-[12px] bg-[#e2efff] p-2 font-[Source_Sans_Pro] text-[#20212c]"
    >
      <div className="mx-auto flex w-full max-w-[1110px] flex-col-reverse items-stretch rounded-[12px] lg:flex-row">
        <div className="relative flex w-full shrink-0 flex-wrap rounded-[8px] pt-8 pb-12 lg:w-1/2 lg:pt-16 lg:pb-20">
          <div className="relative z-10 w-full px-5 lg:pr-[85px] lg:pl-0">
            <Text
              field={fields.Heading}
              tag="h3"
              className="font-['Publico'] text-[26px] font-light leading-[1.2] lg:text-[32px]"
            />
            <RichText
              field={fields.Benefits}
              className="mt-4 w-full text-[16px] leading-[1.5] [&_ul]:mt-4 [&_ul]:list-none [&_ul]:p-0 lg:[&_ul]:mt-[30px] [&_li]:relative [&_li]:pl-7 [&_li+li]:mt-[0.9em] [&_li::before]:absolute [&_li::before]:left-0 [&_li::before]:top-0 [&_li::before]:text-[20px] [&_li::before]:leading-6 [&_li::before]:text-[#00008f] [&_li::before]:content-['✓']"
            />
            <div className="mt-6 w-full">
              <Link
                field={fields.CTA}
                className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(0,0,143,0.32)] px-5 py-[11px] text-center font-semibold leading-6 text-[#00008f] lg:w-auto"
              />
            </div>
            <Image
              field={fields["Broker Logo"]}
              className="mt-6 block h-auto w-full max-w-[314px]"
            />
          </div>
        </div>

        <div className="relative flex w-full shrink-0 flex-wrap rounded-[8px] lg:min-h-full lg:w-1/2">
          <div className="relative flex w-full overflow-hidden rounded-[8px] lg:absolute lg:inset-0">
            <Image
              field={fields["Desktop Image"]}
              className="hidden h-full w-full object-cover lg:block"
            />
            <Image
              field={fields["Mobile Image"]}
              className="block aspect-square h-auto max-h-[234px] w-full object-cover md:aspect-auto md:h-auto lg:hidden"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
