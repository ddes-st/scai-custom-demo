import { Image, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Logo: ImageField;
  Tagline: TextField;
}

type HeaderProps = ComponentProps & { fields: Fields };

export const Default = (props: HeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="location-selection-header min-h-[3.5rem] bg-white font-[Source_Sans_Pro] font-light text-[18px] leading-normal lg:min-h-[6.5rem]"
    >
      <Image
        field={fields.Logo}
        className="float-left block h-[3.5rem] w-auto lg:h-[6.5rem]"
      />
      <Text
        field={fields.Tagline}
        tag="h2"
        className="m-0 inline-block h-[3.5rem] px-0 py-4 text-[1.278rem] font-light leading-[1.39rem] text-white lg:h-[6.5rem] lg:px-6 lg:py-8 lg:text-[2.55rem] lg:leading-[2.78rem]"
      />
    </header>
  );
};
