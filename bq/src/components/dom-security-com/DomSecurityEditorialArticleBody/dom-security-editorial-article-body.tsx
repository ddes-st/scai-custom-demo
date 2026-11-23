import { Image, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Category: TextField;
  Introduction: RichTextField;
  Image: ImageField;
  "Article Image"?: ImageField;
  "Image Caption": TextField;
  Heading: TextField;
  Body: RichTextField;
}

type DomSecurityEditorialArticleBodyProps = ComponentProps & { fields: Fields };

export const Default = (props: DomSecurityEditorialArticleBodyProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const articleImage = fields["Article Image"] || fields.Image;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-white pb-8 font-[Source_Sans_Pro] text-[18px] font-light leading-[1.67rem] text-[#333] md:pb-20"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <div className="px-0 min-[1200px]:px-[17%]">
          <div className="mb-4 inline-block clear-both bg-[#d51130] px-4 py-[0.3rem] text-white relative after:absolute after:bottom-[-1rem] after:left-0 after:h-0 after:w-0 after:border-l-[1rem] after:border-l-transparent after:border-t-[1rem] after:border-t-[#77091b]">
            <Text field={fields.Category} />
          </div>
          <div className="clear-both text-[1rem] font-light leading-[1.67rem] max-md:text-[0.89rem] max-md:leading-[1.15rem]">
            <RichText field={fields.Introduction} />
            <div className="mt-8 max-md:mt-5">
              <Image field={articleImage} className="h-auto max-w-full align-middle" />
              <div className="text-[1rem] leading-[1.67rem] max-md:text-[0.89rem] max-md:leading-[1.15rem]">
                <Text field={fields["Image Caption"]} />
              </div>
            </div>
            <h2 className="mb-10 mt-6 text-[2.55rem] font-light leading-[2.78rem] text-[#111] max-md:mb-8 max-md:mt-5 max-md:text-[1.278rem] max-md:leading-[1.39rem]">
              <Text field={fields.Heading} />
            </h2>
            <RichText field={fields.Body} />
          </div>
        </div>
      </div>
    </section>
  );
};
