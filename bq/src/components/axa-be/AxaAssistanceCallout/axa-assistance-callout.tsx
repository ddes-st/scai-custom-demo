import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Description: RichTextField;
  Image: ImageField;
  CTA: LinkField;
}

type AssistanceCalloutProps = ComponentProps & { fields: Fields };

export const Default = (props: AssistanceCalloutProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative mx-0 mb-[46px] mt-[30px] overflow-hidden rounded-[12px] bg-[#e2efff] p-2 font-[Source_Sans_Pro] text-[#20212c]"
    >
      <div className="flex flex-col items-stretch lg:flex-row">
        <div className="relative flex h-[120px] w-full shrink-0 flex-wrap items-center justify-center overflow-hidden rounded-[8px] bg-white lg:h-auto lg:min-h-[334px] lg:w-1/2">
          <Image
            field={fields.Image}
            className="relative z-[1] max-w-[180px] md:max-w-[220px] lg:max-w-[calc(100%-40px)]"
          />
        </div>

        <div className="relative flex w-full shrink-0 flex-wrap items-normal rounded-[8px] lg:min-h-[334px] lg:w-1/2">
          <div className="relative z-[1] w-full break-words px-5 pb-8 pt-8 md:px-5 md:pb-12 md:pt-8 lg:py-16 lg:pl-[85px] lg:pr-5">
            <Text
              field={fields.Title}
              tag="h2"
              className="font-['Publico'] text-[1.75rem] font-light leading-[1.22] lg:text-[2rem]"
            />
            <RichText
              field={fields.Description}
              className="mt-4 text-base leading-[1.5]"
            />
            <Link
              field={fields.CTA}
              className="mt-7 inline-flex w-full items-center justify-center rounded-full border border-[#ec000a] bg-[#ec000a] px-5 py-[11px] text-center font-[Source_Sans_Pro] text-base font-semibold leading-[1.5] text-white transition-colors hover:border-[#bd0006] hover:bg-[#bd0006] lg:mt-8 lg:w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
