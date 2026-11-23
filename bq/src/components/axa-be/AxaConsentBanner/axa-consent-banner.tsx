import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import ConsentBannerChrome from './axa-consent-banner.client';
import { shouldShowConsentOverlay } from 'lib/consent-editing';

interface Fields {
  Heading: TextField;
  Description: RichTextField;
  "Policy Link": LinkField;
  "Accept Label": TextField;
  "Personalize Label": TextField;
}

type ConsentBannerProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: ConsentBannerProps) => {
  if (!shouldShowConsentOverlay(props.page)) return null;

  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      role="dialog"
      aria-modal="true"
      aria-describedby="consent-banner-description"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[272px] font-[Source_Sans_Pro] text-white"
    >
      <ConsentBannerChrome>
        <div className="relative w-full max-w-[600px] bg-[#5f5f5f] px-5 pb-6 pt-4 md:max-w-[600px] lg:max-w-[600px]">
          <button
            type="button"
            data-consent-close
            aria-label="Sluiten"
            className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center text-2xl leading-none text-white"
          >
            <span aria-hidden="true">×</span>
          </button>
          <div className="pr-5">
            <Text
              field={fields.Heading}
              tag="h2"
              className="font-['Publico'] text-[24px] font-bold leading-[1.15] text-white md:text-[24px] lg:text-[24px]"
            />
            <div id="consent-banner-description" className="mt-5 text-[16px] leading-6 text-white">
              <RichText field={fields.Description} />
              <div className="mt-0">
                <Link
                  field={fields["Policy Link"]}
                  className="inline-block border-2 border-white px-1 text-white underline underline-offset-2"
                />
              </div>
            </div>
          </div>
          <div className="mt-7 flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-10 lg:flex-row lg:items-center lg:gap-10">
            <button
              type="button"
              data-consent-action="acceptAll"
              className="flex h-[46px] min-w-[255px] items-center justify-center gap-3 border-2 border-white px-5 text-[13px] font-bold uppercase tracking-[0.04em] text-white"
            >
              <span aria-hidden="true" className="text-[18px] leading-none">✓</span>
              <Text field={fields["Accept Label"]} />
            </button>
            <button
              type="button"
              data-consent-action="personalizeCookies"
              className="flex h-[46px] items-center justify-center gap-3 px-0 text-[13px] font-bold uppercase tracking-[0.04em] text-white"
            >
              <span aria-hidden="true" className="text-[20px] leading-none">⚙</span>
              <Text field={fields["Personalize Label"]} />
            </button>
          </div>
        </div>
      </ConsentBannerChrome>
    </section>
  );
};
