import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import {
  ComponentProps,
  getDatasource,
  getFieldValue,
} from 'lib/component-props';
import SocialFaGlyph from '../social-fa-glyph.client';
import { resolveSocialFaIconName } from '../social-fa-icon.util';

type CompatibleField<T> = T | { jsonValue?: T };

type LinkListChild = {
  link?: CompatibleField<LinkField>;
  icon?: CompatibleField<TextField>;
  field?: {
    link?: CompatibleField<LinkField>;
    icon?: CompatibleField<TextField>;
  };
};

type LinkListDatasource = {
  field?: {
    title?: CompatibleField<TextField>;
  };
  children?: {
    results?: LinkListChild[];
  };
};

type SocialLinkGroupProps = ComponentProps & {
  fields?:
    | LinkListDatasource
    | {
        data?: {
          datasource?: LinkListDatasource;
        };
      };
};

function childLink(child: LinkListChild) {
  return getFieldValue(child.link ?? child.field?.link);
}

function childIcon(child: LinkListChild) {
  return child.icon ?? child.field?.icon;
}

export const Default = (props: SocialLinkGroupProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const key = renderingId || props.rendering?.uid || 'social-link-group';
  const results = datasource?.children?.results ?? [];
  const titleField = getFieldValue(datasource?.field?.title);
  const titleText =
    typeof titleField?.value === 'string' ? titleField.value : undefined;

  return (
    <section
      key={key}
      id={renderingId || undefined}
      className="w-full bg-[#0c0d4d] text-white"
    >
      <div className="mx-auto max-w-[1110px] px-5 py-8 md:px-10 md:py-12 lg:px-0">
        <Text
          field={titleField}
          tag="h2"
          className="mb-6 text-base font-semibold leading-tight"
        />
        <ul className="flex items-center gap-7" aria-label={titleText}>
          {results.map((item, index) => {
            const link = childLink(item);
            if (!link) return null;
            const icon = resolveSocialFaIconName({
              iconField: childIcon(item),
              linkField: link,
            });
            return (
              <li key={link.value?.href || index}>
                <Link
                  field={link}
                  className="flex h-8 w-8 items-center justify-center text-2xl transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                  aria-label={
                    typeof link.value?.text === 'string'
                      ? link.value.text
                      : undefined
                  }
                >
                  {icon ? <SocialFaGlyph name={icon} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
