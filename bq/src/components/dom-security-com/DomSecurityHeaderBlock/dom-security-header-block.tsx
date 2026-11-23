import { AppPlaceholder, Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";

interface Fields {
  Heading: TextField;
  "Background Image": ImageField;
  Logo: ImageField;
  CTA: LinkField;
}

type HeaderBlockProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: HeaderBlockProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = "audience-links";
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative min-h-[calc(100vh-8rem)] overflow-hidden bg-black font-[Source_Sans_Pro] text-white lg:min-h-[900px]"
    >
      <Image
        field={fields["Background Image"]}
        className="absolute inset-0 h-full w-full object-cover object-[50%_100%] opacity-90"
      />
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[1170px] flex-col px-[15px] lg:min-h-[900px]">
        <header className="relative z-10 flex h-[3.5rem] items-center lg:h-[6.5rem]">
          <Image
            field={fields.Logo}
            className="h-[3.5rem] w-[3.5rem] object-contain lg:h-[6.5rem] lg:w-[6.5rem]"
          />
          <div className="px-2 text-[0.78rem] font-light leading-tight lg:px-6 lg:text-[1.125rem]">
            <Text field={fields.Heading} tag="span" />
          </div>
        </header>

        <div className="relative z-10 mt-auto grid grid-cols-1 pb-0 lg:grid-cols-2 lg:gap-0">
          <div className="relative flex flex-col justify-end pr-0 lg:pb-8 lg:pr-[15px]">
            <h1 className="mb-8 mt-8 max-w-[570px] text-[1.56rem] font-light leading-[1.07] lg:mb-20 lg:mt-0 lg:text-[2.55rem] lg:leading-[1.1]">
              <Text field={fields.Heading} />
            </h1>
            <div className="mb-8 hidden lg:block">
              <Link
                field={fields.CTA}
                className="relative pl-12 text-white no-underline"
                showLinkTextWithChildrenPresent
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#7e7c7c] text-xl leading-none"
                >
                  ↓
                </span>
              </Link>
            </div>
          </div>
          <div className="relative flex items-end lg:pb-0">
            <div className="w-full bg-[#d51130] px-5 py-2 lg:ml-auto lg:max-w-[432px] lg:px-10 lg:py-4">
              <ul className="m-0 flex min-h-[220px] list-none flex-col justify-center p-0">
                <AppPlaceholder
                  name={placeholderName}
                  rendering={props.rendering}
                  page={props.page}
                  componentMap={componentMap}
                />
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
