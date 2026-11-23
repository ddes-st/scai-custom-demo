import { Link, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentWithContextProps } from 'lib/component-props';
import NewsArticleList from '../news/news-article-list.client';
import { promotedKeysFromFields, resolveNewsTeaserMaxItems } from '../news/news-articles.util';

interface Fields {
  Heading: TextField;
  "More Link": LinkField;
}

type NewsTeasersProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: NewsTeasersProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const promotedKeys = promotedKeysFromFields(fields);
  const maxItems = resolveNewsTeaserMaxItems(params);

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white px-[15px] pt-[36px] pb-12 font-['Source_Sans_Pro',sans-serif] text-[18px] font-light text-[#333] lg:pt-[90px] lg:pb-[90px]"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <div className="flex items-start justify-between gap-4">
          <Text
            field={fields.Heading}
            tag="h2"
            className="dom-accent dom-accent-tight m-0 max-w-[70%]"
          />
          <Link
            field={fields["More Link"]}
            className="mt-[18px] shrink-0 text-[19.8px] font-normal leading-[28px] text-[#00a0de] no-underline hover:text-[#00a0de]"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-5 text-[18px] leading-none">
              →
            </span>
          </Link>
        </div>
        <NewsArticleList variant="home" promotedKeys={promotedKeys} maxItems={maxItems} />
      </div>
    </section>
  );
};
