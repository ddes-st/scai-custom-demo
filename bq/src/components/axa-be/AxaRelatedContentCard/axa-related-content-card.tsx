import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Category: TextField;
  Title: TextField;
  Description: RichTextField;
  Rating: TextField;
  "Rating Maximum": TextField;
  "Rating Summary": TextField;
  Image: ImageField;
  CTA: LinkField;
}

type RelatedContentCardProps = ComponentProps & { fields: Fields };

export const Default = (props: RelatedContentCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const hasImage = Boolean(fields.Image?.value?.src);

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex w-full min-w-0 shrink-0 flex-col rounded-[8px] bg-[#fafafb] p-1 text-[#343c3d]"
    >
      <div className="relative flex h-[140px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#e2efff] p-[15px_35px_18px] lg:h-[200px] lg:p-[25px_65px_30px]">
        <div className={hasImage ? "hidden" : "flex h-full w-full flex-col items-center justify-center text-center"}>
          <div className="flex items-end justify-center font-[Publico] font-light leading-none text-[#20212c]">
            <Text field={fields.Rating} tag="span" className="text-[46px] lg:text-[40px]" />
            <span className="mb-1 ml-2 text-[20px] font-light lg:mb-1">/</span>
            <Text field={fields["Rating Maximum"]} tag="span" className="mb-1 text-[20px] font-light" />
          </div>
          <div className="mt-2 text-[25px] leading-none tracking-[5px] text-[#fdbb30] lg:mt-[10px]">★★★★★</div>
          <div className="my-[5px] h-px w-[calc(100%-20px)] bg-[#dcdde4] lg:my-3" />
          <Text field={fields["Rating Summary"]} tag="span" className="text-[14px]" />
        </div>
        <div className={hasImage ? "h-full w-full" : "hidden"}>
          <Image field={fields.Image} className="h-full w-full rounded-[4px] object-cover" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Text field={fields.Category} tag="div" className="mb-2 text-[14px] font-semibold leading-4 text-[#64677a]" />
        <Text field={fields.Title} tag="h3" className="font-['Source_Sans_Pro'] text-[20px] font-semibold leading-6 text-[#343c3d] lg:text-[24px] lg:leading-8" />
        <RichText field={fields.Description} className="mt-4 text-[16px] leading-6 text-[#343c3d]" />
        <div className="mt-auto pt-[30px]">
          <Link
            field={fields.CTA}
            className="inline-flex items-center text-[14px] font-semibold leading-6 text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-[0.3em] lg:text-[16px]"
            showLinkTextWithChildrenPresent
          >
            <span className="no-underline">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
};
