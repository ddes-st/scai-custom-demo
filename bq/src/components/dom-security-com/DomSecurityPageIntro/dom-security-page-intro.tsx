import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Subtitle: TextField;
}

type DomSecurityPageIntroProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityPageIntroProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-white font-[Source_Sans_Pro] font-light text-black"
    >
      <div className="mx-auto max-w-[1170px] px-[15px]">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12">
          <div className="min-w-0 md:col-span-1 lg:col-span-8">
            <div className="mb-4 md:mb-[5rem]">
              <Text
                field={fields.Title}
                tag="h1"
                className="m-0 text-[1.56rem] leading-[1.67rem] font-light md:text-[3.9rem] md:leading-[1.1]"
              />
              <Text
                field={fields.Subtitle}
                tag="h2"
                className="m-0 mt-1 text-[0.83rem] leading-normal font-light text-[#646363] md:mt-0 md:text-[1.67rem] md:leading-[2rem] md:text-black"
              />
            </div>
          </div>
          <div className="min-w-0 md:col-span-1 lg:col-span-4" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};
