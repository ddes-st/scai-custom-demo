import { AppPlaceholder, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import componentMap from '.sitecore/component-map';
import type { ComponentWithContextProps } from 'lib/component-props';

interface Fields {
  SocialHeading: TextField;
  "Social Links": RichTextField;
  Copyright: TextField;
  "Sitemap Link": LinkField;
}

type SiteFooterProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: SiteFooterProps) => {
  const { fields } = props;
  const dynamicId = props.params?.DynamicPlaceholderId;
  const placeholderBase = 'footer-navigation';
  const placeholderName = dynamicId ? `${placeholderBase}-${dynamicId}` : placeholderBase;

  return (
    <footer
      key={props.params.RenderingIdentifier || props.rendering.uid} id={props.params?.RenderingIdentifier || props.params?.id || undefined}
      className="bg-[#0c0e45] text-white"
    >
      <div className="mx-auto w-full max-w-[1110px] px-0 min-[769px]:px-5">
        <div className="flex flex-col items-stretch gap-0 py-0 min-[769px]:-mx-[15px] min-[769px]:flex-row min-[769px]:items-start min-[769px]:flex-wrap min-[769px]:py-12 min-[769px]:pb-16">
          <AppPlaceholder
            name={placeholderName}
            rendering={props.rendering}
            page={props.page}
            componentMap={componentMap}
          />
          <section className="flex-grow px-0 py-4 min-[769px]:px-[15px] min-[769px]:py-0">
            <div className="hidden text-base font-semibold min-[769px]:mb-6 min-[769px]:block">
              <Text field={fields.SocialHeading} tag="h2" />
            </div>
            <RichText field={fields["Social Links"]} className="text-center text-2xl min-[769px]:text-left" />
          </section>
        </div>
      </div>
      <div className="border-t border-white/20 text-[13px]">
        <div className="mx-auto flex w-full max-w-[1110px] flex-col items-stretch px-0 min-[769px]:flex-row min-[769px]:flex-wrap min-[769px]:items-center min-[769px]:px-5">
          <div className="order-1 px-5 py-4 text-center min-[769px]:order-2 min-[769px]:ml-auto min-[769px]:px-0 min-[769px]:py-0">
            <Link field={fields["Sitemap Link"]} />
          </div>
          <div className="order-2 border-t border-white/20 px-5 py-4 text-center min-[769px]:order-1 min-[769px]:border-0 min-[769px]:px-0 min-[769px]:py-0">
            <Text field={fields.Copyright} tag="p" />
          </div>
        </div>
      </div>
    </footer>
  );
};
