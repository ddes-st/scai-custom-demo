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

type SocialLinkListProps = ComponentProps & {
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

export const Default = (props: SocialLinkListProps) => {
  const datasource = getDatasource<LinkListDatasource>(props.fields);
  const results = datasource?.children?.results ?? [];
  const titleField = getFieldValue(datasource?.field?.title);
  const titleText =
    typeof titleField?.value === 'string' ? titleField.value : undefined;

  return (
    <section
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="bg-[#080b4f] text-white"
      aria-label={titleText}
    >
      <div className="mx-auto flex max-w-[1110px] items-center justify-between px-5 py-8 md:px-0 md:py-12">
        <Text
          field={titleField}
          tag="h2"
          className="hidden font-sans text-base font-bold lg:block"
        />
        <ul className="flex items-center gap-7 md:gap-8" aria-label={titleText}>
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
                  className="flex h-6 w-6 items-center justify-center text-xl text-white no-underline"
                >
                  {icon ? <SocialFaGlyph name={icon} /> : null}
                  <span className="sr-only">{link.value?.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
