import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Label: TextField;
}

type DomSecurityCategoryTagProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityCategoryTagProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <h3
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="absolute left-0 top-0 z-[4] m-0 bg-[#d51130] px-2 py-[0.2rem] text-base font-normal leading-normal text-white max-md:px-[0.3rem] max-md:py-[0.1rem] max-md:text-[0.7rem]"
    >
      <Text field={fields.Label} />
    </h3>
  );
};
