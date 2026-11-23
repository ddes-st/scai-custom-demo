import { AppPlaceholder, Image, Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import type { ImageField, LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import HeaderChrome from "./dom-security-site-header.client";

interface Fields {
  Logo: ImageField;
  "Home Link": LinkField;
  Heading: TextField;
  Navigation: RichTextField;
  "Products Menu": RichTextField;
  Language: TextField;
  "Language Options": RichTextField;
  "Search Label": TextField;
  "Search Endpoint": TextField;
}

type DomSecuritySiteHeaderProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: DomSecuritySiteHeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const searchLabel = typeof fields["Search Label"]?.value === "string" ? fields["Search Label"].value : "Search";

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-[999] bg-white font-[Source_Sans_Pro] font-light text-black lg:-mb-[6.4rem] max-lg:fixed max-lg:inset-x-0 max-lg:top-0 max-lg:shadow-[0_0_9px_rgba(0,0,0,0.45)]"
    >
      <div className="relative mx-auto w-full px-[15px] lg:max-w-[1170px]">
        <HeaderChrome
          searchLabel={searchLabel}
          languageOptions={<RichText field={fields["Language Options"]} />}
          productMenu={<RichText field={fields["Products Menu"]} />}
        >
          <nav className="relative min-h-[50px] bg-white lg:pl-[100px] lg:pt-[18px]">
            <div className="absolute left-1/2 top-0 z-10 h-[50px] w-[50px] -translate-x-1/2 lg:left-0 lg:h-[95px] lg:w-[75px] lg:translate-x-0">
              <Link field={fields["Home Link"]} aria-label="home" className="block h-full w-full">
                <Image field={fields.Logo} className="h-full w-full object-contain" />
              </Link>
            </div>
            <div className="max-lg:hidden lg:block">
              <RichText
                field={fields.Navigation}
                className="[&_ul]:m-0 [&_ul]:flex [&_ul]:list-none [&_ul]:items-start [&_ul]:gap-0 [&_ul]:p-0 [&_li]:m-0 [&_li]:list-none [&_a]:block [&_a]:px-[15px] [&_a]:pt-[10px] [&_a]:text-[1.1rem] [&_a]:font-medium [&_a]:leading-normal [&_a]:text-black [&_a]:no-underline [&_a:hover]:font-semibold [&_a:hover]:text-black"
              />
            </div>
          </nav>
        </HeaderChrome>
        <Text field={fields.Heading} tag="span" className="sr-only" />
        <Text field={fields.Language} tag="span" className="sr-only" />
        <Text field={fields["Search Endpoint"]} tag="span" className="sr-only" />
        <div className="sr-only" aria-hidden="true">
          <AppPlaceholder
            name={params.DynamicPlaceholderId ? `header-utility-and-navigation-${params.DynamicPlaceholderId}` : "header-utility-and-navigation"}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
        </div>
      </div>
    </header>
  );
};
