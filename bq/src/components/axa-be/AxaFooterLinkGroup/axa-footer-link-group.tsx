import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import { ComponentProps, getDatasource, getFieldValue } from 'lib/component-props';
import FooterLinkGroupChrome from './axa-footer-link-group.client';
import SocialFaGlyph from '../social-fa-glyph.client';
import { resolveSocialFaIconName } from '../social-fa-icon.util';

type FooterLinkChild = {
  link?: LinkField | { jsonValue?: LinkField };
  icon?: TextField | { jsonValue?: TextField };
  field?: {
    link?: LinkField | { jsonValue?: LinkField };
    icon?: TextField | { jsonValue?: TextField };
  };
};

type FooterDatasource = {
  field?: {
    title?: TextField | { jsonValue?: TextField };
  };
  children?: {
    results?: FooterLinkChild[];
  };
};

type FooterLinkGroupProps = ComponentProps & {
  fields?:
    | FooterDatasource
    | {
        data?: {
          datasource?: FooterDatasource;
        };
      };
};

export const Default = (props: FooterLinkGroupProps) => {
  const datasource = getDatasource<FooterDatasource>(props.fields);
  const titleField = getFieldValue(datasource?.field?.title);
  const results = datasource?.children?.results ?? [];
  const hasIcons = results.some((child) =>
    Boolean(
      resolveSocialFaIconName({
        iconField: child.icon ?? child.field?.icon,
        linkField: child.link ?? child.field?.link,
      }),
    ),
  );
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={`flex-grow px-0 lg:px-[15px] ${hasIcons ? 'lg:flex-grow-0' : ''}`}
    >
      <FooterLinkGroupChrome isSocial={hasIcons} title={<Text field={titleField} tag="h3" />}>
        <ul
          className={
            hasIcons
              ? 'flex items-center justify-center gap-2.5 px-[30px] py-[5px] lg:justify-start lg:p-0'
              : 'list-none'
          }
        >
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
                className={
                  hasIcons
                    ? 'inline-block text-2xl lg:mr-4 last:lg:mr-0'
                    : 'mb-0 border-t border-white/20 leading-6 lg:mb-4 lg:border-t-0'
                }
              >
                <Link
                  field={linkField}
                  className={
                    hasIcons
                      ? 'block p-[15px] no-underline hover:no-underline'
                      : 'block px-5 py-4 lg:p-0 hover:underline'
                  }
                  showLinkTextWithChildrenPresent
                >
                  {icon ? <SocialFaGlyph name={icon} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </FooterLinkGroupChrome>
    </section>
  );
};
