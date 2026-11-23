import { Link } from "@sitecore-content-sdk/nextjs";
import type { Field, LinkField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Link: LinkField;
  Active: Field<boolean>;
}

type DomSecurityNavigationItemProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityNavigationItemProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const isActive = Boolean(fields.Active.value);

  return (
    <li
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative m-0 list-none p-0"
    >
      <Link
        field={fields.Link}
        className={`relative block bg-transparent px-[15px] pt-[10px] text-[1.1rem] font-medium leading-normal text-black no-underline transition-colors after:mx-auto after:mt-[10px] after:block after:h-[0.1rem] after:w-0 after:bg-[#d51130] after:content-[''] hover:text-black hover:no-underline lg:whitespace-nowrap ${isActive ? "font-semibold tracking-[-0.35px] after:w-4" : ""}`}
      />
    </li>
  );
};
