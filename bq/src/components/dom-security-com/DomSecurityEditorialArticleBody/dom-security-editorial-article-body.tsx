import { Image, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";
import { fieldHasValue, preferField, routeFields } from "../news/page-fields.util";

interface Fields {
  Category: TextField;
  Introduction: RichTextField;
  Image: ImageField;
  "Article Image"?: ImageField;
  "Image Caption": TextField;
  Heading: TextField;
  Body: RichTextField;
}

type DomSecurityEditorialArticleBodyProps = ComponentProps & {
  fields: Fields;
  page?: { layout?: Parameters<typeof routeFields>[0] };
};

const bodyClassName = [
  "clear-both text-[1rem] font-light leading-[1.67rem] text-[#333]",
  "max-md:text-[0.89rem] max-md:leading-[1.15rem]",
  "[&_p]:mb-4 [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-[1.7rem] [&_h2]:font-light [&_h2]:leading-snug [&_h2]:text-[#111]",
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1 [&_strong]:font-semibold",
  "[&_a]:text-[#00a0de] [&_a]:no-underline hover:[&_a]:underline",
  "[&_img]:my-6 [&_img]:block [&_img]:h-auto [&_img]:w-full",
].join(" ");

export const Default = (props: DomSecurityEditorialArticleBodyProps) => {
  const route = routeFields(props.page?.layout);
  const own = props.fields || ({} as Fields);
  const fields: Fields = {
    Category: preferField(own.Category, route.Category as TextField | undefined) as TextField,
    Introduction: preferField(own.Introduction, route.Introduction as RichTextField | undefined) as RichTextField,
    Image: preferField(own.Image, route.Image as ImageField | undefined) as ImageField,
    "Article Image": own["Article Image"],
    "Image Caption": preferField(own["Image Caption"], route["Image Caption"] as TextField | undefined) as TextField,
    Heading: preferField(own.Heading, route.Heading as TextField | undefined) as TextField,
    Body: preferField(own.Body, route.Body as RichTextField | undefined) as RichTextField,
  };
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const articleImage = fieldHasValue(fields["Article Image"]) ? fields["Article Image"] : fields.Image;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white pb-8 font-[Source_Sans_Pro] text-[18px] font-light leading-[1.67rem] text-[#333] md:pb-20"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <div className="px-0 min-[1200px]:px-[17%]">
          {fieldHasValue(fields.Category) ? (
            <div className="mb-4 inline-block clear-both bg-[#d51130] px-4 py-[0.3rem] text-white relative after:absolute after:bottom-[-1rem] after:left-0 after:h-0 after:w-0 after:border-l-[1rem] after:border-l-transparent after:border-t-[1rem] after:border-t-[#77091b]">
              <Text field={fields.Category} />
            </div>
          ) : null}
          <div className={bodyClassName}>
            <RichText field={fields.Introduction} />
            {fieldHasValue(articleImage) ? (
              <div className="mt-8 max-md:mt-5">
                <Image field={articleImage} className="h-auto max-w-full align-middle" />
                {fieldHasValue(fields["Image Caption"]) ? (
                  <div className="text-[1rem] leading-[1.67rem] max-md:text-[0.89rem] max-md:leading-[1.15rem]">
                    <Text field={fields["Image Caption"]} />
                  </div>
                ) : null}
              </div>
            ) : null}
            {fieldHasValue(fields.Heading) ? (
              <h2 className="mb-10 mt-6 text-[2.55rem] font-light leading-[2.78rem] text-[#111] max-md:mb-8 max-md:mt-5 max-md:text-[1.278rem] max-md:leading-[1.39rem]">
                <Text field={fields.Heading} />
              </h2>
            ) : null}
            <RichText field={fields.Body} />
          </div>
        </div>
      </div>
    </section>
  );
};
