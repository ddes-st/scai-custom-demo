import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import { shouldShowConsentOverlay } from "lib/consent-editing";

interface Fields {
  Heading: TextField;
  Intro: RichTextField;
  Body: RichTextField;
  "Manage Cookies": LinkField;
  "Continue Without Cookies": LinkField;
  "Accept And Close": LinkField;
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
      className="fixed inset-0 z-[99999] flex min-h-screen flex-col items-center bg-black/70 font-[Source_Sans_Pro] text-black"
      aria-label="Cookie consent"
    >
      <div className="m-auto flex w-[calc(100%-30px)] max-w-[40rem] flex-col bg-[#fdc300] p-8 max-md:p-8">
        <div className="max-md:max-h-[250px] max-md:overflow-y-auto">
          <Text
            field={fields.Heading}
            tag="h2"
            className="text-[2.55rem] font-light leading-normal max-md:text-[2rem]"
          />
          <RichText
            field={fields.Intro}
            className="mt-2 text-[0.9rem] font-light leading-[1.4rem]"
          />
          <RichText
            field={fields.Body}
            className="mt-6 text-[0.9rem] font-light leading-[1.4rem]"
          />
        </div>

        <div className="mt-6">
          <Link
            field={fields["Manage Cookies"]}
            className="inline-block border-b border-transparent pb-[0.1rem] text-[0.9rem] font-normal text-black no-underline hover:border-black focus:border-black"
          />

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:gap-3">
            <div className="min-w-0 flex-1">
              <Link
                field={fields["Continue Without Cookies"]}
                className="flex min-h-[48px] w-full items-center justify-center rounded-[50px] border border-black bg-black px-5 py-[10px] text-center text-[1rem] font-normal text-white no-underline"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true" className="ml-5 text-[1.35rem] leading-none">
                  →
                </span>
              </Link>
            </div>
            <div className="min-w-0 flex-1">
              <Link
                field={fields["Accept And Close"]}
                className="flex min-h-[48px] w-full items-center justify-center rounded-[50px] border border-black bg-black px-5 py-[10px] text-center text-[1rem] font-normal text-white no-underline"
                showLinkTextWithChildrenPresent
              >
                <span aria-hidden="true" className="ml-5 text-[1.35rem] leading-none">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
