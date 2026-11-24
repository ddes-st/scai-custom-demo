import { RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Body: RichTextField;
}

type CenteredCopyProps = ComponentProps & { fields: Fields };

export const Default = (props: CenteredCopyProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white py-6 font-['Source_Sans_Pro',sans-serif] font-light text-[#333] md:py-[90px]"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <div className="md:px-[17%]">
          <Text
            field={fields.Title}
            tag="h2"
            className="m-0 mb-[10px] mt-5 text-[1.56rem] font-light leading-[1.67rem] text-[#333] md:text-[70.2px] md:leading-[77.22px]"
          />
          <RichText
            field={fields.Body}
            className="text-[16px] font-light leading-[1.3] text-[#333] md:text-[18px] md:leading-[30.06px] [&_p]:mb-[10px]"
          />
        </div>
      </div>
    </section>
  );
};
