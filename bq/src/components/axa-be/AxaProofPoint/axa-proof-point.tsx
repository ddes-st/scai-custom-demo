import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Number: TextField;
  Unit: TextField;
  Label: TextField;
}

type ProofPointProps = ComponentProps & { fields: Fields };

export const Default = (props: ProofPointProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="block w-full shrink-0 px-[15px] text-center md:w-1/3 lg:w-1/3"
    >
      <div className="text-center">
        <p className="mb-0 text-[52px] font-[Publico] font-light leading-none text-[#20212c] lg:text-[72px]">
          <Text field={fields.Number} tag="span" />{" "}
          <Text field={fields.Unit} tag="span" className="text-[0.6666em] leading-none" />
        </p>
        <p className="mt-[10px] break-words text-center font-[Source_Sans_Pro] text-[20px] font-semibold leading-6 text-[#20212c] lg:text-[24px] lg:leading-8">
          <Text field={fields.Label} />
        </p>
      </div>
    </article>
  );
};
