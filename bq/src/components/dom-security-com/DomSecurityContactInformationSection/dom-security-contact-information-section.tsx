import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  "Section Title": TextField;
  Organization: TextField;
  "Contact Heading": TextField;
  Phone: LinkField;
  Email: LinkField;
  "Address Heading": TextField;
  Address: RichTextField;
  "Directions Link": LinkField;
  "Call Me Back": LinkField;
  "Fill Out The Form": LinkField;
}

type ContactInformationSectionProps = ComponentProps & { fields: Fields };

export const Default = (props: ContactInformationSectionProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#00a0de] px-[15px] pt-5 pb-[36px] font-['Source_Sans_Pro',sans-serif] font-light text-[#333] lg:pb-[90px]"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <Text
          field={fields["Section Title"]}
          tag="h2"
          className="mb-8 text-center text-[28px] font-light leading-[34px] text-[#333] lg:mb-[18px] lg:text-[45.9px] lg:leading-[50.04px]"
        />
        <div className="mx-auto w-[90%] border border-[#e9e9e9] bg-white p-4 text-[#7e7c7c] lg:p-12">
          <Text
            field={fields.Organization}
            tag="h4"
            className="mb-6 text-[1.15rem] font-light leading-none text-[#d51130] lg:mb-5 lg:text-[1.33rem]"
          />
          <div className="grid grid-cols-1 gap-y-5 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-0">
            <div className="min-w-0">
              <Text
                field={fields["Contact Heading"]}
                tag="h5"
                className="mb-2 text-[0.78rem] font-semibold leading-none text-black lg:text-[1rem]"
              />
              <Link
                field={fields.Phone}
                className="mb-2 block text-[0.78rem] font-normal leading-[1.05rem] text-[#00a0de] underline lg:text-[1rem] lg:leading-normal"
              >
                <span aria-hidden="true" className="mr-3 inline-block text-[1rem] text-black no-underline">☎</span>
              </Link>
              <Link
                field={fields.Email}
                className="block text-[0.78rem] font-normal leading-[1.05rem] text-[#00a0de] underline lg:text-[1rem] lg:leading-normal"
              >
                <span aria-hidden="true" className="mr-3 inline-block text-[1rem] text-black no-underline">✉</span>
              </Link>
            </div>

            <div className="min-w-0 text-[0.78rem] leading-[1.05rem] text-black lg:text-[1rem] lg:leading-normal">
              <Text
                field={fields["Address Heading"]}
                tag="h4"
                className="mb-2 text-[0.78rem] font-semibold leading-none text-black lg:text-[1rem]"
              />
              <RichText field={fields.Address} className="mb-1 whitespace-pre-line font-normal" />
              <Link
                field={fields["Directions Link"]}
                className="font-normal text-[#00a0de] underline"
              />
            </div>

            <div className="-mb-8 min-w-0 lg:col-span-1 lg:mb-0 lg:-mr-20 lg:mt-[-0.3rem]">
              <div className="rounded-[5px] bg-white text-left shadow-[7px_7px_65px_-16px_rgba(0,0,0,0.75)]">
                <Link
                  field={fields["Call Me Back"]}
                  className="block border-b border-[#f3f3f3] px-3 py-3 text-[0.78rem] font-normal text-[#00a0de] underline lg:px-4 lg:py-4 lg:text-[1.1rem]"
                  showLinkTextWithChildrenPresent
                >
                  <span aria-hidden="true" className="float-right ml-4 no-underline">→</span>
                </Link>
                <Link
                  field={fields["Fill Out The Form"]}
                  className="block px-3 py-3 text-[0.78rem] font-normal text-[#00a0de] underline lg:px-4 lg:py-4 lg:text-[1.1rem]"
                  showLinkTextWithChildrenPresent
                >
                  <span aria-hidden="true" className="float-right ml-4 no-underline">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
