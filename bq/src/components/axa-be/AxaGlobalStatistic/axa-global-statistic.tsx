import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Number: TextField;
  Unit: TextField;
  Title: TextField;
  Description: TextField;
}

type GlobalStatisticProps = ComponentProps & { fields: Fields };

export const Default = (props: GlobalStatisticProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative block shrink-0 px-[15px] text-center font-[Source_Sans_Pro] text-[#20212c] first:max-md:mt-0 max-md:mt-[72px] lg:w-1/3 md:w-1/3 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-black/25 lg:[&:not(:first-child)]:border-solid"
    >
      <div className="text-center">
        <div className="mb-[10px] text-center" aria-hidden="true" />
        <div className="text-center">
          <p className="mb-0 flex items-baseline justify-center whitespace-nowrap font-[Publico] text-[52px] font-light leading-none text-[#20212c] lg:text-[72px] md:text-[52px]">
            <Text field={fields.Number} />
            <span className="text-[0.6666em] leading-none">
              <Text field={fields.Unit} />
            </span>
          </p>
          <Text
            field={fields.Title}
            tag="h3"
            className="mt-[22px] text-center font-[Source_Sans_Pro] text-[20px] font-semibold leading-6 text-[#20212c] lg:mt-[22px] lg:text-[24px] lg:leading-8 md:mt-[22px] md:text-[20px] md:leading-6"
          />
          <Text
            field={fields.Description}
            tag="p"
            className="mt-[20px] text-center font-[Source_Sans_Pro] text-[16px] leading-6 text-[#20212c] lg:mt-[20px] md:mt-[20px]"
          />
        </div>
      </div>
    </article>
  );
};
