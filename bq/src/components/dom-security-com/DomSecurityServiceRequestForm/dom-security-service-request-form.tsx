import { ComponentProps } from 'lib/component-props';
import ServiceRequestFormChrome from './dom-security-service-request-form.client';

/**
 * Hardcoded service / spare-parts request form for the DOM Security demo.
 * No Sitecore datasource fields — register the rendering in SitecoreAI yourself.
 */
type DomSecurityServiceRequestFormProps = ComponentProps;

export const Default = (props: DomSecurityServiceRequestFormProps) => {
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <section
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="bg-[#f7f7f7] px-0 py-10 font-[Source_Sans_Pro] lg:py-16"
    >
      <div className="mx-auto w-full max-w-[970px] px-[15px]">
        <h2 className="mb-3 text-center text-[1.9rem] font-light leading-[1.1] text-black lg:mb-4 lg:text-[2.55rem]">
          Service &amp; spare parts request
        </h2>
        <p className="mx-auto mb-8 max-w-[42rem] text-center text-[0.95rem] leading-relaxed text-[#646363] lg:mb-10 lg:text-[1.05rem]">
          Already own a DOM product? Recreate a key, request a compatible lock,
          order media, or get support for digital access — we&apos;ll route your
          request to the right team.
        </p>
        <ServiceRequestFormChrome />
      </div>
    </section>
  );
};
