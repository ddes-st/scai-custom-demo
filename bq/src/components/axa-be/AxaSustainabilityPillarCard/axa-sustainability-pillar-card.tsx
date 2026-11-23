import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Image: ImageField;
  Title: TextField;
  Description: RichTextField;
  Link: LinkField;
}

type SustainabilityPillarCardProps = ComponentProps & { fields: Fields };

export const Default = (props: SustainabilityPillarCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex w-[min(90%,350px)] shrink-0 snap-center flex-col overflow-hidden rounded-[8px] bg-[#fafafb] text-[#343c3d]"
    >
      <div className="relative h-[140px] shrink-0 overflow-hidden rounded-[4px] p-[15px_35px_18px] md:h-[200px] md:p-[25px_65px_30px]">
        <Image field={fields.Image} className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Text
          field={fields.Title}
          tag="h3"
          className="font-['Source_Sans_Pro'] text-[20px] font-semibold leading-6 md:text-2xl md:leading-8"
        />
        <RichText
          field={fields.Description}
          className="mt-4 break-words font-['Source_Sans_Pro'] text-base leading-6"
        />
        <div className="flex-1" />
        <div className="mt-[30px] text-left">
          <Link
            field={fields.Link}
            className="font-['Source_Sans_Pro'] text-sm font-semibold leading-6 text-[#00008f] underline decoration-[rgba(0,0,143,0.32)] underline-offset-4 md:text-base"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-4 no-underline">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
};
