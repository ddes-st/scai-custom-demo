import type { ComponentWithContextProps } from 'lib/component-props';
import NewsArticleList from '../news/news-article-list.client';
import { promotedKeysFromFields } from '../news/news-articles.util';

type Props = ComponentWithContextProps & { fields?: unknown };

export const Default = (props: Props) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const promotedKeys = promotedKeysFromFields(props.fields);

  return (
    <section
      key={renderingId || props.rendering?.uid || 'DomSecurityNewsGrid'}
      id={renderingId || undefined}
      className="w-full bg-white px-[15px] pb-16 font-['Source_Sans_Pro',sans-serif]"
      data-component="DomSecurityNewsGrid"
    >
      <div className="mx-auto w-full max-w-[1170px]">
        <NewsArticleList variant="newsroom" promotedKeys={promotedKeys} />
      </div>
    </section>
  );
};
