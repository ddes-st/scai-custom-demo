import { Link } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import { normalizeLinkListTitle } from "../footer-link-title.util";

type LinkListChild = {
  link?: LinkField | { jsonValue?: LinkField };
  field?: {
    link?: LinkField | { jsonValue?: LinkField };
  };
};

type LinkListDatasource = {
  field?: {
    title?: TextField | { jsonValue?: TextField };
  };
  children?: {
    results?: LinkListChild[];
  };
};

type DomSecurityFooterLinkGroupProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: DomSecurityFooterLinkGroupProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const titleValue = normalizeLinkListTitle(
    typeof titleField?.value === "string" ? titleField.value : "",
  );
  const results = (datasource?.children?.results ?? []).filter((child) =>
    Boolean(getFieldValue(child.link ?? child.field?.link)),
  );
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  // Always render links; title is optional (never show quote-only leftovers).
  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="min-w-0 flex-1 font-[Source_Sans_Pro]"
    >
      {titleValue ? (
        <h3 className="mb-2 text-left text-[0.9rem] font-normal text-white lg:mb-3 lg:text-base">
          {titleValue}
        </h3>
      ) : null}
      <nav aria-label={titleValue || "Footer navigation"}>
        <div className="flex flex-col gap-0">
          {results.map((child, index) => {
            const linkField = getFieldValue(child.link ?? child.field?.link);
            if (!linkField) return null;
            return (
              <Link
                key={index}
                field={linkField}
                className="group block py-1 text-left text-[0.9rem] font-normal leading-[1.35rem] text-[#cac9c9] no-underline transition-colors hover:text-white hover:underline focus:text-white focus:underline lg:py-1 lg:text-[1rem] lg:leading-[1.67rem]"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true" className="ml-4 text-[#cac9c9] group-hover:text-white">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
