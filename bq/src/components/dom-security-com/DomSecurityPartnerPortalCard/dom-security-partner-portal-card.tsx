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
      className="bg-white px-[15px] pb-4 pt-4 font-[Source_Sans_Pro] text-[#333] lg:pt-20"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <div className="w-full">
          <Text
            field={fields.Heading}
            tag="h2"
            className="relative mb-6 pl-[15px] text-[1.278rem] font-light leading-[1.39rem] before:absolute before:left-0 before:top-[0.2rem] before:h-[1rem] before:w-[3px] before:bg-[#d51130] lg:mb-8 lg:text-[2.55rem] lg:leading-[2.78rem] lg:before:top-[0.55rem] lg:before:h-[1.6rem]"
          />
          <RichText
            field={fields.Description}
            className="mb-7 text-[0.78rem] font-light leading-[1.05rem] lg:mb-8 lg:text-[1rem] lg:leading-[1.67rem]"
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
              <div className="absolute bottom-0 left-[15px] w-[calc(100%-30px)] bg-white px-3 py-[0.72rem] pr-10 text-black shadow-[7px_7px_65px_-16px_rgba(0,0,0,0.75)] lg:px-[1.7rem] lg:py-4 lg:pr-10">
                <Text
                  field={fields["Card Subtitle"]}
                  tag="h3"
                  className="text-[0.78rem] font-medium leading-[0.89rem] text-[#d51130] lg:text-[1.1rem] lg:leading-[1.4rem]"
                />
                <Text
                  field={fields["Card Title"]}
                  tag="h3"
                  className="text-[0.83rem] font-normal leading-[1.1rem] text-black lg:text-[1.35rem] lg:leading-normal"
                />
                <span aria-hidden="true" className="absolute bottom-[0.7rem] right-[0.9rem] text-[0.9rem] font-light leading-none text-[#00a0de] lg:bottom-4 lg:right-[1.3rem] lg:text-[1.35rem]">
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
