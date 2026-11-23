import { AppPlaceholder, Image, Link, Text } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ComponentWithContextProps } from "lib/component-props";
import { cn } from "components/lib/utils";
import DemoAudienceToggle from "../_demo/demo-audience-toggle";
import NavigationChrome from "./dom-security-navigation.client";
import { navItemClassName } from "./nav-item-styles.util";
import { shouldOverlapMainHero } from "./nav-overlap.util";

interface Fields {
  Logo: ImageField;
  "Home Link": LinkField;
  "Homeowners Link": LinkField;
  "Professionals Link": LinkField;
  "Industry Link": LinkField;
  "Products Label": TextField;
  "Service Link": LinkField;
  "About Link": LinkField;
  "Newsroom Link": LinkField;
  "Search Label": TextField;
  "Language En": LinkField;
  "Language Fr": LinkField;
  "Language Nl": LinkField;
  "Category Help Link": LinkField;
  "Homeowner Highlight Label": TextField;
}

type NavigationProps = ComponentWithContextProps & { fields: Fields };

function NavItem({ field }: { field?: LinkField }) {
  if (!field?.value?.href && !field?.value?.text) return null;
  return (
    <li>
      <Link field={field} className={navItemClassName} />
    </li>
  );
}

function langCode(field?: LinkField) {
  const text =
    typeof field?.value?.text === "string" ? field.value.text.trim() : "";
  return text.toLowerCase() || "en";
}

export const Default = (props: NavigationProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const megaPh = dynId ? `nav-mega-columns-${dynId}` : "nav-mega-columns";
  const productsLabel =
    typeof fields["Products Label"]?.value === "string"
      ? fields["Products Label"].value.trim()
      : "Products";
  const searchLabel =
    typeof fields["Search Label"]?.value === "string"
      ? fields["Search Label"].value.trim()
      : "Search";
  const highlightLabel =
    typeof fields["Homeowner Highlight Label"]?.value === "string"
      ? fields["Homeowner Highlight Label"].value
      : "";

  const languages = (
    [
      { field: fields["Language En"], code: langCode(fields["Language En"]), flag: "gb" as const },
      { field: fields["Language Fr"], code: langCode(fields["Language Fr"]), flag: "be" as const },
      { field: fields["Language Nl"], code: langCode(fields["Language Nl"]), flag: "be" as const },
    ] as const
  ).filter((entry) => Boolean(entry.field?.value?.href || entry.field?.value?.text));

  const overlap = shouldOverlapMainHero(props.page);

  return (
    <nav
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      aria-label="Primary"
      data-nav-overlap={overlap ? "true" : "false"}
      className={cn(
        "w-full font-[Source_Sans_Pro]",
        overlap
          ? "pointer-events-none absolute inset-x-0 top-0 z-40 bg-transparent text-white data-[products-open=true]:bg-white data-[products-open=true]:text-black data-[nav-open=true]:bg-white data-[nav-open=true]:text-black"
          : "relative z-10 shrink-0 border-b border-[#e5e5e5] bg-white text-black",
      )}
    >
      <div
        className={cn(
          // Desktop: absolute brand (capture `.navbar-brand`) + pl so L1 aligns; mega is
          // top-full of this box and must stack above the logo (logo z < mega z).
          // No top padding: `.top-links` and brand share top:0 of this box (capture header).
          "relative mx-auto flex w-full max-w-[1170px] flex-wrap items-center gap-x-4 px-[15px] lg:min-h-[82px] lg:items-end lg:pl-[100px]",
          overlap ? "pointer-events-auto bg-transparent" : "bg-white",
        )}
      >
        <Link
          field={fields["Home Link"]}
          className="relative z-20 inline-flex shrink-0 py-2 no-underline max-lg:mx-auto lg:absolute lg:left-[15px] lg:top-0 lg:z-20 lg:h-[97px] lg:w-[85px] lg:py-0 lg:pt-0"
          showLinkTextWithChildrenPresent={false}
          aria-label={fields["Home Link"]?.value?.text || "home"}
        >
          <Image
            field={fields.Logo}
            className="h-14 w-auto object-contain max-lg:mx-auto lg:h-full lg:w-full lg:object-contain lg:object-left"
          />
        </Link>

        {/* Demo audience switch — sit beside the logo (left), not in the top-right utilities. */}
        {/* Desktop: align with first L1 letter = lg:pl-[100px] + nav link px-[15px]. */}
        <DemoAudienceToggle className="relative z-30 max-lg:order-first max-lg:mr-auto lg:absolute lg:left-[115px] lg:top-[0.35rem]" />

        <NavigationChrome
          overlap={overlap}
          productsLabel={productsLabel}
          searchLabel={searchLabel}
          languages={languages.map((l) => ({
            field: l.field as LinkField,
            code: l.code,
            flag: l.flag,
          }))}
          beforeProducts={
            <>
              <NavItem field={fields["Homeowners Link"]} />
              <NavItem field={fields["Professionals Link"]} />
              <NavItem field={fields["Industry Link"]} />
            </>
          }
          afterProducts={
            <>
              <NavItem field={fields["Service Link"]} />
              <NavItem field={fields["About Link"]} />
              <NavItem field={fields["Newsroom Link"]} />
            </>
          }
          mega={
            <AppPlaceholder
              name={megaPh}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          }
          megaFooter={
            <div className="mt-4 flex flex-col gap-3 border-t border-[#e3e2e2] px-1 pt-3 text-[0.8rem] font-normal max-lg:hidden lg:flex-row lg:items-center lg:justify-between">
              {fields["Category Help Link"]?.value?.text ? (
                <span className="inline-flex items-center gap-2 text-[#646363]">
                  <Link
                    field={fields["Category Help Link"]}
                    className="text-[#646363] no-underline hover:text-[#e30613]"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#646363] text-[0.65rem] leading-none text-[#646363]"
                  >
                    i
                  </span>
                </span>
              ) : null}
              {highlightLabel ? (
                <label className="inline-flex cursor-pointer items-center gap-3 text-[#646363]">
                  <Text field={fields["Homeowner Highlight Label"]} />
                  <span className="relative inline-flex h-[1.1rem] w-[2.22rem] shrink-0 items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      aria-label={highlightLabel}
                    />
                    <span className="block h-[1.1rem] w-[2.22rem] rounded-full bg-[#4a4949] transition-colors peer-checked:bg-[#5ac50b]" />
                    <span className="pointer-events-none absolute top-[0.15rem] left-[0.15rem] h-[0.8rem] w-[0.8rem] rounded-full bg-white transition-[left] peer-checked:left-[1.25rem]" />
                  </span>
                </label>
              ) : null}
            </div>
          }
        />
      </div>
    </nav>
  );
};
