import { Text } from "@sitecore-content-sdk/nextjs";
import type { TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";
import { preferField, routeFields } from "../news/page-fields.util";

interface Fields {
  Title: TextField;
  Date: TextField;
}

type DomSecurityArticleHeaderProps = ComponentProps & {
  fields: Fields;
  page?: { layout?: Parameters<typeof routeFields>[0] };
};

export const Default = (props: DomSecurityArticleHeaderProps) => {
  const route = routeFields(props.page?.layout);
  const title = preferField(
    props.fields?.Title,
    (route.NavigationTitle || route.Title) as TextField | undefined,
  );
  const date = preferField(props.fields?.Date, route.Date as TextField | undefined);
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="w-full bg-white"
    >
      <div className="mx-auto mb-2 w-full px-[15px] pt-6 lg:max-w-[1170px]">
        <Text
          field={title}
          tag="h1"
          className="m-0 w-full font-[Source_Sans_Pro] text-[2.2rem] font-light leading-[1.15] text-black md:text-[70px] md:leading-[77px]"
        />
        <Text
          field={date}
          tag="p"
          className="m-0 mt-5 mb-2.5 w-full font-[Source_Sans_Pro] text-[1.15rem] font-light leading-8 text-[#333] md:text-[30px] md:leading-9"
        />
      </div>
    </div>
  );
};
