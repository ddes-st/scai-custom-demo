import { Link } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import { normalizeLinkListTitle } from "../footer-link-title.util";
import NavMegaColumnChrome from "./dom-security-footer-link-list-nav-mega.client";

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

type FooterLinkListProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

function useLinkList(props: FooterLinkListProps) {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = (datasource?.children?.results ?? []).filter((child) =>
    Boolean(getFieldValue(child.link ?? child.field?.link)),
  );
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  return { titleField, results, renderingId, uid: props.rendering?.uid };
}

/** Primary footer columns — vertical list with trailing arrows (desktop). */
export const Default = (props: FooterLinkListProps) => {
  const { titleField, results, renderingId, uid } = useLinkList(props);
  const titleValue = normalizeLinkListTitle(
    typeof titleField?.value === "string" ? titleField.value : "",
  );

  // Always render the column + links (empty title must not hide subitems).
  return (
    <div
      key={renderingId || uid}
      id={renderingId || undefined}
      className="h-full w-full py-0 font-[Source_Sans_Pro] text-[0.9rem] font-normal leading-[1.35] text-[#cac9c9] sm:py-8 lg:text-base"
    >
      {titleValue ? (
        <div className="mb-2 text-left font-normal text-white lg:mb-3">
          {titleValue}
        </div>
      ) : null}
      <div className="flex flex-col gap-0">
        {results.map((child, index) => {
          const linkField = getFieldValue(child.link ?? child.field?.link);
          if (!linkField) return null;
          return (
            <Link
              key={index}
              field={linkField}
              className="block py-1 text-left font-normal text-[#cac9c9] no-underline transition-colors after:ml-2 after:inline-block after:content-['→'] hover:text-white focus:text-white max-lg:after:hidden lg:py-1"
            />
          );
        })}
      </div>
    </div>
  );
};

/** Products mega-menu column — red title on desktop; accordion on mobile. */
export const NavMega = (props: FooterLinkListProps) => {
  const { titleField, results, renderingId, uid } = useLinkList(props);
  const titleValue = normalizeLinkListTitle(
    typeof titleField?.value === "string" ? titleField.value : "",
  );

  return (
    <div key={renderingId || uid} id={renderingId || undefined}>
      <NavMegaColumnChrome
        titleText={titleValue}
        title={titleValue || null}
      >
        <ul className="m-0 list-none space-y-1 p-0 max-lg:pb-2">
          {results.map((child, index) => {
            const linkField = getFieldValue(child.link ?? child.field?.link);
            if (!linkField) return null;
            return (
              <li key={index}>
                <Link
                  field={linkField}
                  className="block py-1 text-[#646363] no-underline transition-colors hover:text-[#e30613] max-lg:text-[0.95rem]"
                />
              </li>
            );
          })}
        </ul>
      </NavMegaColumnChrome>
    </div>
  );
};

/** Legal / meta row — horizontal, muted, no arrows. */
export const Horizontal = (props: FooterLinkListProps) => {
  const { results, renderingId, uid } = useLinkList(props);

  return (
    <div
      key={renderingId || uid}
      id={renderingId || undefined}
      className="flex flex-wrap items-center gap-x-8 gap-y-1 py-1 font-[Source_Sans_Pro] text-[0.78rem] font-normal leading-[1.35] text-[#b0b0b0] lg:py-[0.55rem] lg:text-base"
    >
      {results.map((child, index) => {
        const linkField = getFieldValue(child.link ?? child.field?.link);
        if (!linkField) return null;
        return (
          <Link
            key={index}
            field={linkField}
            className="block py-[5px] text-[#b0b0b0] no-underline transition-colors hover:text-white focus:text-white lg:py-[0.55rem]"
          />
        );
      })}
    </div>
  );
};
