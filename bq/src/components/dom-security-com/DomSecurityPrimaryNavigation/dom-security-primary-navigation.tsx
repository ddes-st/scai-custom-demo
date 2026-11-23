import { AppPlaceholder, Image, Link } from "@sitecore-content-sdk/nextjs";
import componentMap from ".sitecore/component-map";
import type { ImageField, LinkField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";

interface Fields {
  Logo: ImageField;
  "Home Link": LinkField;
}

type DomSecurityPrimaryNavigationProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: DomSecurityPrimaryNavigationProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const dynId = params.DynamicPlaceholderId;
  const placeholderBase = "primary-navigation";
  const placeholderName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;

  return (
    <nav
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-40 min-h-[50px] bg-white font-[Source_Sans_Pro] font-light text-black shadow-[0_0_9px_rgba(0,0,0,0.18)] lg:min-h-[96px] lg:shadow-none"
    >
      <div className="relative mx-auto flex min-h-[50px] items-center lg:min-h-[96px]">
        <Link
          field={fields["Home Link"]}
          aria-label="home"
          className="absolute left-1/2 top-0 z-20 h-[50px] w-[50px] -translate-x-1/2 lg:left-0 lg:h-[97px] lg:w-[97px] lg:translate-x-0"
        >
          <Image
            field={fields.Logo}
            className="h-full w-full object-contain"
          />
        </Link>

        <div className="absolute left-4 top-1/2 flex -translate-y-1/2 items-center text-[0] lg:hidden">
          <span aria-hidden="true" className="relative block h-5 w-5">
            <span className="absolute left-0 top-[3px] h-[2px] w-4 rotate-45 bg-black" />
            <span className="absolute left-0 top-[3px] h-[2px] w-4 -rotate-45 bg-black" />
          </span>
        </div>

        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-[5px] lg:hidden" aria-hidden="true">
          <span className="block h-[2px] w-5 bg-black" />
          <span className="block h-[2px] w-5 bg-black" />
          <span className="block h-[2px] w-5 bg-black" />
        </div>

        <div className="hidden w-full pl-[100px] pr-0 lg:block">
          <div className="flex min-h-[96px] items-center">
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <AppPlaceholder
                name={placeholderName}
                rendering={props.rendering}
                page={props.page}
                componentMap={componentMap}
              />
            </div>
            <div className="flex h-[36px] items-center border-l border-transparent bg-black px-4 text-sm text-white">
              <span className="mr-2" aria-hidden="true">🇬🇧</span>
              <span className="mr-3">EN</span>
              <span className="mr-5 text-xs" aria-hidden="true">⌄</span>
              <span className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-white" aria-hidden="true" />
              <span>Search</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
