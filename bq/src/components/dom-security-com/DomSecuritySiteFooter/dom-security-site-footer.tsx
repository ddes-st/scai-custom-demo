import { AppPlaceholder, Image, Link } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ImageField, LinkField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import { CountrySwitchButton } from "./country-chooser.client";
import {
  FooterSocialFallback,
  hasFooterSocialPlaceholders,
} from "./footer-social-fallback";

interface Fields {
  "Brand Image": ImageField;
  "Brand Link": LinkField;
  "Country Link": LinkField;
  "Scroll To Top Link": LinkField;
}

type SiteFooterProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SiteFooterProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const navPh = dynId ? `footer-nav-${dynId}` : "footer-nav";
  const legalPh = dynId ? `footer-legal-${dynId}` : "footer-legal";
  const socialPh = dynId ? `footer-social-${dynId}` : "footer-social";
  const countryLabel =
    String(fields["Country Link"]?.value?.text || "BE").trim() || "BE";
  const showAuthoredSocial = hasFooterSocialPlaceholders(
    props.rendering,
    socialPh,
  );

  return (
    <footer
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#646363] font-[Source_Sans_Pro] text-[#cac9c9]"
    >
      <div className="mx-auto w-full max-w-[1170px] px-[15px]">
        <div className="flex flex-col gap-4 py-6 lg:flex-row lg:items-stretch lg:gap-0 lg:py-6">
          <div className="flex items-start justify-between gap-4 lg:w-[170px] lg:shrink-0 lg:pr-[15px]">
            <Link
              field={fields["Brand Link"]}
              className="inline-block no-underline"
              showLinkTextWithChildrenPresent={false}
            >
              <Image
                field={fields["Brand Image"]}
                className="h-auto w-[160px] max-w-full object-contain object-left"
              />
            </Link>
            <div className="shrink-0 lg:hidden">
              <CountrySwitchButton label={countryLabel} />
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-0 sm:grid-cols-2 sm:divide-x sm:divide-[#696868] lg:min-h-[180px]">
            <AppPlaceholder
              name={navPh}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-[#696868]">
        <div className="mx-auto flex w-full max-w-[1170px] flex-col gap-4 px-[15px] py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:py-0">
          <div className="min-w-0 flex-1">
            <AppPlaceholder
              name={legalPh}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
          <div className="flex items-center gap-6 lg:gap-8">
            {showAuthoredSocial ? (
              <AppPlaceholder
                name={socialPh}
                rendering={props.rendering}
                page={props.page}
                componentMap={componentMap}
              />
            ) : (
              <FooterSocialFallback />
            )}
            <div className="hidden lg:block">
              <CountrySwitchButton label={countryLabel} />
            </div>
          </div>
        </div>
      </div>

      <div className="sr-only">
        <Link field={fields["Scroll To Top Link"]} />
      </div>
    </footer>
  );
};
