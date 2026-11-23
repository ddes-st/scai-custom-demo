import { Link, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import { FaIcon } from "components/icons/fa-icon";
import { resolveSocialFaIconName } from "../social-fa-icon.util";
import { FooterSocialFallback } from "../DomSecuritySiteFooter/footer-social-fallback";

type LinkListChild = {
  link?: LinkField | { jsonValue?: LinkField };
  icon?: TextField | { jsonValue?: TextField };
  field?: {
    link?: LinkField | { jsonValue?: LinkField };
    icon?: TextField | { jsonValue?: TextField };
  };
};

type LinkListDatasource = {
  field?: { title?: TextField | { jsonValue?: TextField } };
  children?: { results?: LinkListChild[] };
};

type FooterSocialLinksProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: FooterSocialLinksProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = (datasource?.children?.results ?? []).filter((child) =>
    Boolean(getFieldValue(child.link ?? child.field?.link)),
  );
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  // Edge sometimes mounts the rendering without ComponentQuery children — keep icons visible.
  if (!results.length) {
    return (
      <div key={renderingId || props.rendering?.uid} id={renderingId || undefined}>
        <FooterSocialFallback />
      </div>
    );
  }

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="font-[Source_Sans_Pro]"
      aria-label="social links"
    >
      {titleField ? <Text field={titleField} className="sr-only" /> : null}
      <ul className="m-0 flex list-none items-center gap-6 p-0 text-white lg:gap-8">
        {results.map((child, index) => {
          const linkField = getFieldValue(child.link ?? child.field?.link);
          if (!linkField) return null;
          const iconName = resolveSocialFaIconName({
            iconField: child.icon ?? child.field?.icon,
            linkField,
          });
          return (
            <li key={index} className="m-0 p-0">
              <Link
                field={linkField}
                className="flex h-8 w-8 items-center justify-center text-white no-underline transition-colors hover:text-[#cac9c9] focus:text-[#cac9c9]"
                aria-label={linkField.value?.text || iconName || "social"}
              >
                {iconName ? (
                  <FaIcon
                    name={iconName}
                    faStyle="brands"
                    className="!static !inset-auto !m-0 inline-block h-[1.5rem] w-[1.5rem]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
