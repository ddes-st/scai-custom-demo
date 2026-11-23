import { AppPlaceholder, Image, Link, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  Heading: TextField;
  Logo: ImageField;
  Search: TextField;
  "Sign In": LinkField;
}

type UtilityNavigationHeaderProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: UtilityNavigationHeaderProps) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  const searchLabel = typeof fields.Search?.value === 'string' ? fields.Search.value : undefined;
  const dynamicPlaceholderId = params.DynamicPlaceholderId;
  const placeholderBase = 'header-navigation';
  const placeholderName = dynamicPlaceholderId
    ? `${placeholderBase}-${dynamicPlaceholderId}`
    : placeholderBase;

  return (
    <header
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="relative z-[70] bg-gradient-to-b from-[#e2efff] to-transparent font-[Source_Sans_Pro] text-[#20212c]"
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-1/2 focus:top-4 focus:z-[90] focus:-translate-x-1/2 focus:rounded-[5px] focus:bg-white focus:px-5 focus:py-3 focus:text-[#00008f]"
      >
        <Text field={fields.Heading} />
      </a>
      <Text field={fields.Search} tag="span" className="sr-only" />
      <div className="mx-auto w-full max-w-[1960px] px-0 lg:px-5 lg:pt-2">
        <section className="rounded-none bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] lg:rounded-[12px]">
          <div className="flex min-h-[56px] items-center gap-3 border-b border-[#dcdde4] px-5 lg:min-h-[56px] lg:px-4">
            <div className="shrink-0 lg:max-w-[40px]">
              <Image field={fields.Logo} className="h-9 w-9 object-contain lg:h-10 lg:w-10" />
            </div>
            <div className="hidden lg:flex lg:flex-1 lg:items-center">
              <div className="min-w-0 flex-1" />
            </div>
            <div className="ml-auto flex items-center gap-2 lg:gap-3">
              <div className="hidden items-center lg:flex">
                <span aria-hidden="true" className="text-lg text-[#00008f]">⌕</span>
              </div>
              <input
                type="search"
                aria-label={searchLabel}
                placeholder={searchLabel}
                className="hidden h-10 flex-1 rounded-full border border-[#828598] px-4 text-base outline-none focus:ring-2 focus:ring-[#00008f] lg:max-w-[500px]"
              />
              <Link
                field={fields["Sign In"]}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#00008f] px-5 text-sm font-semibold text-white lg:h-10"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true">♟</span>
              </Link>
              <button
                type="button"
                aria-label={searchLabel}
                className="inline-flex h-10 w-10 items-center justify-center text-xl text-[#00008f] lg:hidden"
              >
                <span aria-hidden="true">⌕</span>
              </button>
              <button
                type="button"
                aria-label="Menu"
                className="inline-flex h-10 w-10 items-center justify-center text-xl text-[#00008f] lg:hidden"
              >
                <span aria-hidden="true">☰</span>
              </button>
            </div>
          </div>
          <div className="hidden min-h-[48px] items-center lg:flex">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
          <div className="lg:hidden">
            <AppPlaceholder
              name={placeholderName}
              rendering={props.rendering}
              page={props.page}
              componentMap={componentMap}
            />
          </div>
        </section>
      </div>
    </header>
  );
};
