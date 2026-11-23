import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import SocialFaGlyph from '../social-fa-glyph.client';
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

type FooterSocialLinksProps = ComponentProps & {
  fields?: LinkListDatasource | { data?: { datasource?: LinkListDatasource } };
};

export const Default = (props: FooterSocialLinksProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const results = datasource?.children?.results ?? [];
  const titleField = getFieldValue(datasource?.field?.title);
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="footer__menu footer__menu--icons w-full flex-grow-0 px-0 lg:w-auto lg:px-[15px]"
    >
      <p className="footer__menu__title hidden font-['Source_Sans_Pro'] text-base font-semibold text-white lg:mb-6 lg:block">
        <Text field={titleField} />
      </p>
      <ul className="footer__menu__items m-0 list-none p-[5px_30px] text-center lg:p-0 lg:text-left">
        {results.map((child, index) => {
          const linkField = getFieldValue(child.link ?? child.field?.link);
          if (!linkField) return null;

          const iconName = resolveSocialFaIconName({
            iconField: child.icon ?? child.field?.icon,
            linkField,
          });

          return (
            <li
              key={index}
              className="mx-0 inline-block text-2xl text-white lg:mr-4 last:lg:mr-0"
            >
              <Link
                field={linkField}
                className="block px-[15px] text-white no-underline hover:no-underline focus:no-underline lg:px-0"
              >
                {iconName ? <SocialFaGlyph name={iconName} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
