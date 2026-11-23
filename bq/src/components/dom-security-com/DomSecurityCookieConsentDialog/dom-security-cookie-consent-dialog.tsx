import { Link, RichText, Text } from "@sitecore-content-sdk/nextjs";
import type { LinkField, RichTextField, TextField } from "@sitecore-content-sdk/nextjs";
import type { ComponentWithContextProps } from "lib/component-props";
import { shouldShowConsentOverlay } from "lib/consent-editing";

interface Fields {
  Title: TextField;
  Intro: RichTextField;
  Body: RichTextField;
  "Privacy Link": LinkField;
  "Manage Cookies Link": LinkField;
  "Continue Action": TextField;
  "Accept Action": TextField;
}

type DomSecurityCookieConsentDialogProps = ComponentWithContextProps & { fields: Fields };

export const Default = (props: DomSecurityCookieConsentDialogProps) => {
  if (!shouldShowConsentOverlay(props.page)) return null;

  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <div
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 font-[Source_Sans_Pro] text-[#333]"
    >
      <section className="flex w-full max-w-[40rem] flex-col bg-[#fdc300] p-8 max-md:max-h-[calc(100vh-2rem)] max-md:overflow-y-auto max-md:p-6">
        <Text
          field={fields.Title}
          tag="h2"
          className="text-[2.55rem] font-light leading-[1.1] max-md:text-[1.8rem]"
        />

        <div className="mt-3 text-[0.9rem] font-light leading-[1.4rem] max-md:text-[0.78rem] max-md:leading-[1.05rem]">
          <RichText field={fields.Intro} />
          <Link field={fields["Privacy Link"]} className="sr-only" />
        </div>

        <div className="mt-6 mb-6 text-[0.9rem] font-light leading-[1.4rem] max-md:text-[0.78rem] max-md:leading-[1.05rem]">
          <RichText field={fields.Body} />
        </div>

        <div className="flex flex-col">
          <Link
            field={fields["Manage Cookies Link"]}
            className="mb-4 self-start text-[1rem] font-normal text-inherit no-underline transition-colors hover:border-b hover:border-current focus:border-b focus:border-current max-md:text-[0.9rem]"
          />

          <div className="grid grid-cols-2 gap-3 max-md:gap-2">
            <button
              type="button"
              className="flex min-h-[48px] items-center justify-center rounded-[50px] border border-black bg-black px-4 py-2 text-center text-[1rem] font-semibold leading-tight text-white no-underline max-md:min-h-[44px] max-md:px-2 max-md:text-[0.78rem]"
            >
              <Text field={fields["Continue Action"]} />
              <span aria-hidden="true" className="ml-5 text-[1.35rem] leading-none max-md:ml-3">
                →
              </span>
            </button>
            <button
              type="button"
              className="flex min-h-[48px] items-center justify-center rounded-[50px] border border-black bg-black px-4 py-2 text-center text-[1rem] font-semibold leading-tight text-white no-underline max-md:min-h-[44px] max-md:px-2 max-md:text-[0.78rem]"
            >
              <Text field={fields["Accept Action"]} />
              <span aria-hidden="true" className="ml-5 text-[1.35rem] leading-none max-md:ml-3">
                →
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
