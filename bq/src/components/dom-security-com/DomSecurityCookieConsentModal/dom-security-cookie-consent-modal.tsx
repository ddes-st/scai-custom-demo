import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import { shouldShowConsentOverlay } from "lib/consent-editing";

interface Fields {
  Title: TextField;
  Intro: RichTextField;
  Body: RichTextField;
  "Manage Cookies": LinkField;
  "Continue Label": TextField;
  "Accept Label": TextField;
}

type DomSecurityCookieConsentModalProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: DomSecurityCookieConsentModalProps) => {
  if (!shouldShowConsentOverlay(props.page)) return null;

  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="fixed inset-0 z-[99999] flex flex-col items-center bg-black/70 px-0 py-0 font-[Source_Sans_Pro] text-[#333]"
      role="dialog"
      aria-modal="true"
    >
      <div className="m-auto flex w-[720px] max-w-[calc(100vw-2rem)] flex-col bg-[#fdc300] p-8 max-md:max-w-none">
        <div className="max-md:max-h-[250px] max-md:overflow-auto">
          <Text
            field={fields.Title}
            tag="h2"
            className="m-0 text-[2.55rem] font-light leading-normal max-md:text-[1.56rem]"
          />
          <RichText
            field={fields.Intro}
            className="mt-3 text-[0.9rem] font-light leading-[1.4rem] max-md:text-[0.78rem] max-md:leading-[1.05rem]"
          />
          <RichText
            field={fields.Body}
            className="mt-6 mb-6 text-[0.9rem] font-light leading-[1.4rem] max-md:mt-4 max-md:mb-4 max-md:text-[0.78rem] max-md:leading-[1.05rem]"
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-3">
            <Link
              field={fields["Manage Cookies"]}
              className="mr-4 border-b border-transparent py-1 font-normal text-inherit no-underline transition-colors hover:border-current focus:border-current"
            />
          </div>
          <div className="grid grid-cols-2 gap-[0.6rem] max-md:gap-2">
            <button
              type="button"
              data-action="acceptWithoutCookies"
              className="m-0 inline-block rounded-[50px] border border-black bg-black px-5 py-[10px] text-center text-[1rem] font-normal leading-[1.42857] text-white no-underline transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-[#fdc300] max-md:px-3 max-md:text-[0.78rem]"
            >
              <Text field={fields["Continue Label"]} />
              <span aria-hidden="true" className="ml-5 text-[1.2rem] leading-none max-md:ml-3">→</span>
            </button>
            <button
              type="button"
              data-action="acceptCookies"
              className="m-0 inline-block rounded-[50px] border border-black bg-black px-5 py-[10px] text-center text-[1rem] font-normal leading-[1.42857] text-white no-underline transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-[#fdc300] max-md:px-3 max-md:text-[0.78rem]"
            >
              <Text field={fields["Accept Label"]} />
              <span aria-hidden="true" className="ml-5 text-[1.2rem] leading-none max-md:ml-3">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
