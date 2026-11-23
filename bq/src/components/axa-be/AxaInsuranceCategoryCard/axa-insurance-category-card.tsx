import { Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Image: ImageField;
  Link: LinkField;
  "Promo Label": TextField;
  "Promo Link": LinkField;
}

type InsuranceCategoryCardProps = ComponentProps & { fields: Fields };

const cardClassName = "relative flex w-full max-w-[255px] shrink-0 rounded-[8px] border border-[rgba(0,0,143,0.32)] bg-white text-[#20212c] transition-colors hover:border-[#00008f] hover:bg-[#f8faff] md:max-w-[255px]";
const cardContentClassName = "flex min-h-[160px] w-full flex-col items-center justify-between rounded-[6px] p-4 text-center md:min-h-[216px] md:p-6";

export const Default = (props: InsuranceCategoryCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={cardClassName}
    >
      <Link
        field={fields.Link}
        className={cardContentClassName}
        showLinkTextWithChildrenPresent={false}
      >
        <Image field={fields.Image} className="h-[75px] w-[75px] object-contain md:h-[100px] md:w-[100px]" />
        <Text field={fields.Title} tag="span" className="w-full break-words text-[20px] font-semibold leading-6" />
      </Link>
      <span className="sr-only">
        <Text field={fields["Promo Label"]} />
        <Link field={fields["Promo Link"]} />
      </span>
    </article>
  );
};

export const Promo = (props: InsuranceCategoryCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={cardClassName}
    >
      <Link
        field={fields.Link}
        className={cardContentClassName}
        showLinkTextWithChildrenPresent={false}
      >
        <Image field={fields.Image} className="h-[75px] w-[75px] object-contain md:h-[100px] md:w-[100px]" />
        <Text field={fields.Title} tag="span" className="w-full break-words text-[20px] font-semibold leading-6" />
      </Link>
      <Link
        field={fields["Promo Link"]}
        className="absolute -left-[10px] top-0 z-10 inline-flex -translate-y-1/2 items-center rounded-[4px] bg-[#ec000a] px-2 py-1 text-[14px] font-semibold leading-5 text-white"
        showLinkTextWithChildrenPresent
      >
        <span aria-hidden="true" className="ml-2">→</span>
      </Link>
      <span className="sr-only">
        <Text field={fields["Promo Label"]} />
      </span>
    </article>
  );
};

export const Teaser = (props: InsuranceCategoryCardProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={cardClassName}
    >
      <Link
        field={fields.Link}
        className="flex min-h-[160px] w-full flex-col items-center justify-center rounded-[6px] p-4 text-center md:min-h-[216px] md:p-6"
        showLinkTextWithChildrenPresent={false}
      >
        <Text field={fields.Title} tag="span" className="w-full break-words text-[20px] font-semibold leading-6" />
        <span aria-hidden="true" className="mt-6 text-[28px] leading-none text-[#00008f]">↓</span>
      </Link>
      <span className="sr-only">
        <Text field={fields["Promo Label"]} />
        <Link field={fields["Promo Link"]} />
      </span>
    </article>
  );
};
