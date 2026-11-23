import { Link } from "@sitecore-content-sdk/nextjs";
import type { LinkField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Link: LinkField;
}

type AudienceLinkProps = ComponentProps & { fields: Fields };

export const Default = (props: AudienceLinkProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <li
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative list-none border-t border-[#ee2b4a] first:border-t-0"
    >
      <Link
        field={fields.Link}
        className="relative block w-full py-4 pr-10 text-left text-[0.8rem] font-light leading-[1.25] text-white no-underline transition-colors hover:text-white hover:no-underline focus:text-white focus:no-underline lg:py-6 lg:text-base lg:leading-[1.2]"
        showLinkTextWithChildrenPresent
      >
        <span aria-hidden="true" className="absolute right-0 top-1/2 -translate-y-1/2 text-xl leading-none text-white lg:text-2xl">
          →
        </span>
      </Link>
    </li>
  );
};
