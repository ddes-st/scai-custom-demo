import { AppPlaceholder, Text } from '@sitecore-content-sdk/nextjs';
import type { TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Title?: TextField;
}

type Props = ComponentWithContextProps & { fields?: Fields };

export const Default = (props: Props) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = props.params?.DynamicPlaceholderId;
  const baseKey = 'news-grid';
  const phName = dynId ? `${baseKey}-${dynId}` : baseKey;
  return (
    <section
      key={renderingId || props.rendering?.uid || 'DomSecurityNewsGrid'}
      id={renderingId || undefined}
      className="w-full"
      data-component="DomSecurityNewsGrid"
    >
      <Text field={props.fields?.Title} tag="h2" className="text-2xl font-semibold" />
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-[30px] [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center">
        <AppPlaceholder
          name={phName}
          rendering={props.rendering}
          page={props.page}
          componentMap={componentMap}
        />
      </div>
    </section>
  );
};
