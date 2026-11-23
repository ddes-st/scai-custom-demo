import { Image, Link, RichText, Text } from '@sitecore-content-sdk/nextjs';
import type { ImageField, LinkField, RichTextField, TextField } from '@sitecore-content-sdk/nextjs';
import { FaIcon } from 'components/icons/fa-icon';
import { ComponentProps } from 'lib/component-props';

interface Fields {
  Testimonial: RichTextField;
  Author: TextField;
  Title: TextField;
  'Contact Heading': TextField;
  Organization: TextField;
  Phone: LinkField;
  Availability: TextField;
  Email: LinkField;
  'Organization Logo': ImageField;
}

type TestimonialContactGridProps = ComponentProps & { fields: Fields };

export const Default = (props: TestimonialContactGridProps) => {
  const { fields } = props || {};
  const {
    Testimonial,
    Author,
    Title,
    Organization,
    Phone,
    Availability,
    Email,
  } = fields || {};
  const contactHeading = fields?.['Contact Heading'];
  const organizationLogo = fields?.['Organization Logo'];
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;
  // Sitecore AI Design → Style. "Gray background" emits container-gray-background.
  const designStyles = String(params.styles || params.Styles || '').trim();

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className={[
        "px-[15px] pt-8 pb-4 font-['Source_Sans_Pro',sans-serif] font-light text-[#333] lg:pt-[90px] lg:pb-[90px]",
        designStyles,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto w-full max-w-[1170px]">
        {/*
          Source: .eh-grid.row + col-sm-6 / col-lg-6.
          Use CSS grid (not flex+w-1/2+gap) so 50/50 never wraps on desktop.
        */}
        <div className="grid grid-cols-1 items-stretch gap-0 md:grid-cols-2 md:min-h-[433px]">
          {/* Left: cyan testimonial — same column height as right */}
          <div className="flex min-h-[178px] min-w-0 px-0 md:min-h-0 md:px-[15px]">
            <div className="flex h-full w-full flex-col justify-center bg-[#00a0de] px-[1.2rem] py-4 text-white lg:p-9">
              <RichText
                field={Testimonial}
                className="mb-2.5 text-left text-[18px] font-light italic leading-normal lg:mb-0 lg:text-[32.4px] lg:leading-normal [&_p]:mb-0 [&_p]:mt-0 [&_p:empty]:hidden"
              />
              <div className="mt-auto pt-4 text-[14px] font-normal leading-none text-white lg:text-[18px] lg:leading-normal">
                <Text field={Author} />
              </div>
            </div>
          </div>

          {/* Right: contact card — no vertical margin (that made it shorter than the quote) */}
          <div className="mt-4 flex min-h-[246px] min-w-0 px-0 md:mt-0 md:min-h-0 md:px-[15px]">
            <div className="flex h-full w-full flex-col bg-white px-4 py-4 shadow-[3px_3px_64px_-16px_rgba(0,0,0,0.25)] md:px-8 md:py-8 md:shadow-[3px_3px_64px_-10px_rgba(0,0,0,0.75)]">
              <h2 className="m-0 mb-5 text-center text-[23px] font-light leading-[28px] text-[#333] lg:mb-6 lg:text-[45.9px] lg:leading-[50.04px]">
                <Text field={Title} />
              </h2>

              <div className="flex flex-1 flex-row gap-3 border border-[#e9e9e9] p-4 text-[#7e7c7c] md:gap-4 md:p-6">
                <div className="min-w-0 flex-1 text-[0.78rem] leading-[1.05rem] md:text-base md:leading-normal">
                  <h5 className="mb-2 mt-0 text-[0.78rem] font-semibold leading-none text-black md:mb-1 md:text-[1.1rem] md:leading-normal">
                    <Text field={contactHeading} />
                  </h5>
                  <p className="mb-1 mt-0">
                    <Text field={Organization} />
                  </p>
                  <p className="mb-1 mt-0 flex items-center">
                    <span
                      aria-hidden="true"
                      className="mr-[0.9rem] inline-flex w-4 shrink-0 justify-center text-black"
                    >
                      <FaIcon name="phone" faStyle="solid" className="!h-4 !w-4" />
                    </span>
                    <Link
                      field={Phone}
                      className="break-all font-normal text-[#00a0de] no-underline hover:text-[#00a0de] hover:no-underline"
                    />
                  </p>
                  <p className="mb-1 mt-0 flex items-center">
                    <span
                      aria-hidden="true"
                      className="mr-[0.9rem] inline-flex w-4 shrink-0 justify-center text-black"
                    >
                      <FaIcon name="clock" faStyle="solid" className="!h-4 !w-4" />
                    </span>
                    <Text field={Availability} />
                  </p>
                  <p className="mb-0 mt-0 flex items-center">
                    <span
                      aria-hidden="true"
                      className="mr-[0.9rem] inline-flex w-4 shrink-0 justify-center text-black"
                    >
                      <FaIcon name="envelope" faStyle="solid" className="!h-4 !w-4" />
                    </span>
                    <Link
                      field={Email}
                      className="break-all font-normal text-[#00a0de] underline hover:text-[#00a0de]"
                    />
                  </p>
                </div>
                <div className="flex w-[20%] shrink-0 items-start justify-end pt-1 md:pt-1.5">
                  <Image
                    field={organizationLogo}
                    className="h-auto w-full max-w-[72px] object-contain md:max-w-[88px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
