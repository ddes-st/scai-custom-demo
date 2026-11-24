import { Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Text: RichTextField;
  Image: ImageField;
  Link: LinkField;
}

type LandingCardProps = ComponentProps & { fields: Fields };

function hasLink(field: LinkField | undefined): boolean {
  const href = field?.value?.href;
  return typeof href === "string" && href.trim().length > 0;
}

export const Default = (props: LandingCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex h-full flex-col bg-white font-[Source_Sans_Pro] font-light text-[#333]"
    >
      {fields.Image?.value?.src ? (
        <Image field={fields.Image} className="mb-4 block h-40 w-full object-cover" />
      ) : null}
      <Text
        field={fields.Title}
        tag="h3"
        className="m-0 mb-3 text-[1.35rem] font-light leading-snug text-[#111]"
      />
      <RichText
        field={fields.Text}
        className="text-[1rem] leading-[1.55rem] text-[#333] [&_p]:mb-3"
      />
      {hasLink(fields.Link) ? (
        <Link
          field={fields.Link}
          className="mt-auto inline-block pt-2 text-[1rem] text-[#00a0de] no-underline hover:underline"
        />
      ) : null}
    </article>
  );
};
