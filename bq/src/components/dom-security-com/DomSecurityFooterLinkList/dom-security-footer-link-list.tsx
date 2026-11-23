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

/** Live products menu names for the two category links authored under older labels. */
function liveProductsLabel(href: string, text: string): string {
  const path = href.toLowerCase();
  if (path.includes("apps-software") || text === "Programming Equipment") return "Apps & Software";
  if (path.includes("transponders") || text === "Media") return "Transponders";
  return text;
}

function menuLinks(title: string, results: LinkListChild[]): LinkField[] {
  const links = results
    .map((child) => getFieldValue(child.link ?? child.field?.link))
    .filter((field): field is LinkField => Boolean(field))
    .map((field) => {
      const href = String(field.value?.href || "");
      const text = typeof field.value?.text === "string" ? field.value.text : "";
      const next = liveProductsLabel(href, text);
      if (next === text) return field;
      return { ...field, value: { ...field.value, text: next } };
    });
  const industrial = /industrial locking/i.test(title);
  const hasTrapped = links.some((field) =>
    String(field.value?.href || "").toLowerCase().includes("trapped-key"),
  );
  if (industrial && !hasTrapped) {
    links.push({
      value: {
        href: "/products/categories/trapped-key-interlocking-systems",
        text: "Trapped Key Interlocking Systems",
      },
    });
  }
  return links;
}

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
        <ul className="m-0 list-none space-y-0 p-0 max-lg:pb-2">
          {menuLinks(titleValue, results).map((linkField, index) => (
            <li key={index} className="py-[0.15rem]">
              <Link
                field={linkField}
                className="block py-1 text-[18px] font-light leading-7 text-[#333] no-underline transition-colors hover:text-[#d51130] max-lg:text-[0.95rem]"
              />
            </li>
          ))}
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
