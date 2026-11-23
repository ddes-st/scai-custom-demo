import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Heading: TextField;
  Subtitle: TextField;
  Quote: RichTextField;
  "Primary CTA": LinkField;
  "Secondary CTA": LinkField;
}

type NewsroomQuoteProps = ComponentProps & { fields: Fields };

export const Default = (props: NewsroomQuoteProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative rounded-[12px] bg-[#e2efff] px-5 py-8 font-[Source_Sans_Pro] text-[#20212c] lg:pt-16 lg:pb-20"
    >
      <div className="relative mx-auto w-full max-w-[920px]">
        <div className="mb-4 text-center lg:mb-10">
          <Text
            field={fields.Heading}
            tag="h2"
            className="font-['Publico'] text-[28px] font-light leading-[1.22] lg:text-4xl"
          />
        </div>

        <Text
          field={fields.Subtitle}
          tag="p"
          className="mb-10 text-center text-[18px] font-semibold leading-6 text-[#4a4c5a] lg:mb-14"
        />

        <figure className="relative z-[1] px-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-8 left-0 -z-10 font-['Publico'] text-[96px] font-light leading-[64px] text-[#b4c2d2]"
          >
            “
          </span>
          <RichText
            field={fields.Quote}
            tag="blockquote"
            className="text-[18px] font-semibold leading-[1.5] lg:text-2xl"
          />
        </figure>

        <div className="mt-8 flex flex-col items-center justify-center gap-8 text-center lg:flex-row lg:gap-8">
          <Link
            field={fields["Primary CTA"]}
            className="inline-flex w-full items-center justify-center rounded-full border border-[#00008f] bg-[#00008f] px-5 py-[11px] text-base font-semibold leading-6 text-white lg:w-auto"
          />
          <Link
            field={fields["Secondary CTA"]}
            className="inline-block text-[14px] font-semibold leading-6 text-[#00008f] underline decoration-[#00008f]/[0.32] underline-offset-[0.3em] lg:text-base"
            showLinkTextWithChildrenPresent
          >
            <span aria-hidden="true" className="ml-4 no-underline">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
