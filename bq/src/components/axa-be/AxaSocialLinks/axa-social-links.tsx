import { Link, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps, getDatasource, getFieldValue } from "lib/component-props";
import { FaIcon } from "components/icons/fa-icon";
import { resolveSocialFaIconName } from '../social-fa-icon.util';

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

type SocialLinksProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: SocialLinksProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="footer__menu footer__menu--icons flex-grow-0 text-white lg:px-[15px]"
    >
      <p className="footer__menu__title mb-0 hidden text-base font-semibold text-white lg:mb-6 lg:block">
        <Text field={titleField} />
      </p>
      <ul className="footer__menu__items list-none p-[5px_30px] text-center lg:p-0">
        {results.map((child, index) => {
          const linkField = getFieldValue(child.link ?? child.field?.link);
          if (!linkField) return null;
          const icon = resolveSocialFaIconName({
            iconField: child.icon ?? child.field?.icon,
            linkField,
          });
          return (
            <li
              key={index}
              className="footer__menu__item m-0 inline-block border-0 text-[24px] text-white lg:mr-4 last:mr-0"
            >
              <Link
                field={linkField}
                className="block p-[15px] text-white no-underline hover:no-underline lg:p-0"
              >
                {icon ? (
                  <FaIcon
                    name={icon}
                    faStyle="brands"
                    className="!static !inset-auto !m-0 inline-block h-[1.25em] w-[1.25em]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
