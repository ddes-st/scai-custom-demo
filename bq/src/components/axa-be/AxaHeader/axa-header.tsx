import { AppPlaceholder, Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import HeaderChrome from './axa-header.client';

interface Fields {
  Logo: ImageField;
  Segments: RichTextField;
  "Utility Links": RichTextField;
  "Insurance Label": TextField;
  "Claims Label": TextField;
  "Search Placeholder": TextField;
  "Sign In": LinkField;
  "All Insurance Link": LinkField;
}

type HeaderProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: HeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = "header-navigation";
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;
  const searchPlaceholder = typeof fields["Search Placeholder"]?.value === "string" ? fields["Search Placeholder"].value : undefined;

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-[70] bg-[linear-gradient(180deg,#e2efff_0%,transparent_100%)] font-[Source_Sans_Pro] text-[#20212c]"
    >
      <div className="mx-auto max-w-[1960px] px-0 lg:px-5">
        <div className="hidden items-end justify-between text-[12px] text-[#4a4c5a] lg:flex">
          <RichText field={fields.Segments} className="[&_ul]:m-0 [&_ul]:flex [&_ul]:list-none [&_ul]:items-end [&_ul]:gap-4 [&_a]:inline-block [&_a]:px-1 [&_a]:py-2 [&_a]:font-semibold [&_a]:leading-4 [&_a:first-child]:text-[#00008f] [&_a:first-child]:underline [&_a:first-child]:decoration-2 [&_a:first-child]:underline-offset-[10px]" />
          <RichText field={fields["Utility Links"]} className="[&_ul]:m-0 [&_ul]:flex [&_ul]:list-none [&_ul]:items-end [&_ul]:gap-2 [&_a]:inline-block [&_a]:px-3 [&_a]:py-2 [&_a]:leading-4 [&_a:first-child]:font-semibold [&_a:first-child]:text-[#d50b3e]" />
        </div>
        <HeaderChrome
          logo={<Image field={fields.Logo} className="h-9 w-9 object-contain lg:h-12 lg:w-12" />}
          insuranceLabel={<Text field={fields["Insurance Label"]} />}
          claimsLabel={<Text field={fields["Claims Label"]} />}
          signIn={<Link field={fields["Sign In"]} showLinkTextWithChildrenPresent />}
          searchPlaceholder={searchPlaceholder}
        >
          <div className="flex flex-col lg:block">
            <nav aria-label="Verzekeringsnavigatie" className="border-t border-[#dcdde4] lg:border-0">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <AppPlaceholder
                  name={placeholderName}
                  rendering={props.rendering}
                  page={props.page}
                  componentMap={componentMap}
                />
                <Link
                  field={fields["All Insurance Link"]}
                  className="hidden whitespace-nowrap px-4 py-3 text-sm font-semibold text-[#00008f] underline underline-offset-4 lg:inline-flex"
                  showLinkTextWithChildrenPresent
                >
                  <span aria-hidden="true" className="ml-3">→</span>
                </Link>
              </div>
            </nav>
          </div>
        </HeaderChrome>
      </div>
    </header>
  );
};
