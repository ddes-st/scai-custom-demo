import { Image, Link, RichText, Text, type ImageField, type LinkField, type RichTextField, type TextField } from '@sitecore-content-sdk/nextjs';
import type { ComponentProps } from 'lib/component-props';

interface Fields {
  "Logo Image": ImageField;
  "Logo Link": LinkField;
  "Audience Segments": RichTextField;
  "Utility Links": RichTextField;
  "Primary Navigation": RichTextField;
  "Category Navigation": RichTextField;
  Search: TextField;
  "Search Results Link": LinkField;
  "Login Link": LinkField;
  "Menu Panels": RichTextField;
}

type HeaderNavigationProps = ComponentProps & { fields: Fields };

export const Default = (props: HeaderNavigationProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const key = renderingId || props.rendering?.uid;

  return (
    <header key={key} id={renderingId || undefined} className="relative z-30 w-full bg-white font-sans text-[#00008f]">
      <div className="hidden bg-[#edf5ff] px-6 py-2 text-[12px] leading-4 lg:block">
        <div className="mx-auto flex max-w-[1392px] items-center justify-between">
          <RichText field={fields["Audience Segments"]} className="[&_ul]:m-0 [&_ul]:flex [&_ul]:items-center [&_ul]:gap-7 [&_li]:whitespace-nowrap [&_a]:text-[#00008f] [&_a]:no-underline [&_li:first-child]:border-b-2 [&_li:first-child]:border-[#00008f] [&_li:first-child]:pb-2 [&_li:first-child]:font-semibold" />
          <RichText field={fields["Utility Links"]} className="[&_ul]:m-0 [&_ul]:flex [&_ul]:items-center [&_ul]:gap-7 [&_a]:text-[#00008f] [&_a]:no-underline [&_li:first-child_a]:font-semibold [&_li:first-child_a]:text-[#d0003b]" />
        </div>
      </div>

      <div className="border-b border-[#d7dbe5] px-5 lg:rounded-2xl lg:border lg:mx-5 lg:shadow-[0_3px_12px_rgba(0,0,0,0.12)] lg:px-4">
        <div className="mx-auto flex h-[56px] max-w-[1392px] items-center gap-7 lg:h-[56px]">
          <Link field={fields["Logo Link"]} className="shrink-0">
            <Image field={fields["Logo Image"]} className="h-10 w-10 object-contain lg:h-12 lg:w-12" />
          </Link>

          <RichText field={fields["Primary Navigation"]} className="hidden h-full items-stretch lg:flex [&_ul]:m-0 [&_ul]:flex [&_ul]:items-stretch [&_li]:flex [&_a]:flex [&_a]:items-center [&_a]:border-b-2 [&_a]:border-transparent [&_a]:px-5 [&_a]:text-[14px] [&_a]:font-semibold [&_a]:text-[#00008f] [&_a]:no-underline [&_li:first-child_a]:border-[#00008f]" />

          <div className="ml-auto flex items-center gap-5">
            <div className="hidden items-center gap-2 lg:flex">
              <Text field={fields.Search} tag="span" className="sr-only" />
              <Link field={fields["Search Results Link"]} className="flex h-10 w-10 items-center justify-center text-xl text-[#00008f] no-underline" aria-label="Zoeken">
                <span aria-hidden="true">⌕</span>
              </Link>
            </div>
            <Link field={fields["Login Link"]} className="flex h-10 items-center gap-2 rounded-full bg-[#00008f] px-5 text-[14px] font-bold text-white no-underline lg:px-6">
              <span aria-hidden="true">●</span>
            </Link>
            <button type="button" aria-label="Menu" className="flex h-10 w-8 items-center justify-center text-xl text-[#00008f] lg:hidden">☰</button>
          </div>
        </div>

        <div className="hidden border-t border-[#d7dbe5] lg:block">
          <div className="mx-auto flex max-w-[1392px] items-center justify-between">
            <RichText field={fields["Category Navigation"]} className="[&_ul]:m-0 [&_ul]:flex [&_ul]:items-center [&_ul]:gap-10 [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:py-4 [&_a]:text-[14px] [&_a]:font-semibold [&_a]:text-[#00008f] [&_a]:no-underline" />
            <Link field={fields["Search Results Link"]} className="text-[14px] font-semibold text-[#00008f] underline underline-offset-4">Al onze verzekeringen&nbsp; →</Link>
          </div>
        </div>
      </div>

      <div className="hidden">
        <RichText field={fields["Menu Panels"]} />
      </div>
    </header>
  );
};
