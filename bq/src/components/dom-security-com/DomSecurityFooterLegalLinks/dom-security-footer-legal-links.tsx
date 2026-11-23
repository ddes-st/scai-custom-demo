import { Link } from "@sitecore-content-sdk/nextjs";
import type { LinkField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Link: LinkField;
}

type FooterLegalLinksProps = ComponentProps & { fields: Fields };

export const Default = (props: FooterLegalLinksProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="font-[Source_Sans_Pro] text-[0.78rem] font-normal leading-[1.35] text-[#b0b0b0] lg:whitespace-nowrap lg:text-[1rem]"
    >
      <Link
        field={fields.Link}
        className="block py-[5px] text-[#b0b0b0] no-underline transition-colors hover:text-white focus:text-white lg:mr-8 lg:inline-block lg:py-[0.55rem]"
      />
    </div>
  );
};
