import { AppPlaceholder, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import RecommendationGridChrome from './dom-security-recommendation-grid.client';
import type { TextField } from "@sitecore-content-sdk/nextjs";

interface Fields {
  Heading: TextField;
}

type RecommendationGridProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: RecommendationGridProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = "recommendation-cards";
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-white px-[15px] py-[36px] font-['Source_Sans_Pro',sans-serif] font-light text-[#333] lg:py-[90px]"
    >
      <div className="mx-auto grid w-full max-w-[1170px] grid-cols-1 items-start gap-8 lg:grid-cols-[351px_minmax(0,1fr)] lg:gap-x-[15px]">
        <Text
          field={fields.Heading}
          tag="h2"
          className="dom-accent dom-accent-aside"
        />
        <div className="relative min-w-0">
          <RecommendationGridChrome>
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </RecommendationGridChrome>
        </div>
      </div>
    </section>
  );
};
