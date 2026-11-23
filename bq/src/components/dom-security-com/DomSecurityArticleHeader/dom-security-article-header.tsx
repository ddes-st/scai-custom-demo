import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Date: TextField;
}

type DomSecurityArticleHeaderProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityArticleHeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="mx-auto w-full px-[15px] pb-0 lg:max-w-[1170px]"
    >
      <div className="mb-4 md:mb-20 lg:mb-20">
        <Text
          field={fields.Title}
          tag="h1"
          className="m-0 w-full font-[Source_Sans_Pro] text-[1.56rem] font-light leading-[1.56rem] text-black md:text-[3.9rem] md:leading-[1.1]"
        />
        <Text
          field={fields.Date}
          tag="p"
          className="m-0 mt-5 w-full font-[Source_Sans_Pro] text-[0.83rem] font-light leading-normal text-black md:mt-[1.1rem] md:text-[1.67rem] md:leading-normal"
        />
      </div>
    </div>
  );
};
