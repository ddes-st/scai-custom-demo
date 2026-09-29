import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  RichTextField,
  Text,
  NextImage as ContentSdkImage,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingSocialProofRouteFields {
  testimonialQuote?: RichTextField;
  testimonialAuthorName?: Field<string>;
  testimonialAuthorTitle?: Field<string>;
  testimonialAuthorImage?: ImageField;
  partnerLogosImage?: ImageField;
}

const brandFg = 'var(--brand-fg, #2a295c)';
const brandAccent = 'var(--brand-accent, #da2020)';
const brandMutedFg = 'var(--brand-muted-fg, #5c5b7a)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';
const quoteMark = '#b8b3d4';

const LandingSocialProofDefaultComponent = (): JSX.Element => (
  <div className="component landing-social-proof">
    <div className="component-content">
      <span className="is-empty-hint">LandingSocialProof</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingSocialProofRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingSocialProofRouteFields) : null;
}

const QuoteMarkIcon = ({ className, color }: { className?: string; color: string }) => (
  <svg
    className={className}
    width="42"
    height="32"
    viewBox="0 0 42 32"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill={color}
      d="M4 32V18.2C4 10.6 8.2 4.8 15.4 3v6.6c-3.4 1.1-5.3 4-5.3 8.4H16V32H4Zm22 0V18.2C26 10.6 30.2 4.8 37.4 3v6.6c-3.4 1.1-5.3 4-5.3 8.4H42V32H26Z"
    />
  </svg>
);

function LandingSocialProofBranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingSocialProofDefaultComponent />;

  const {
    testimonialQuote,
    testimonialAuthorName,
    testimonialAuthorTitle,
    testimonialAuthorImage,
    partnerLogosImage,
  } = routeFields;

  const hasTestimonial =
    testimonialQuote?.value ||
    testimonialAuthorName?.value ||
    testimonialAuthorTitle?.value ||
    isEditing;
  const hasLogos = partnerLogosImage?.value?.src || isEditing;

  return (
    <div
      className={cn(
        'component landing-social-proof [&_a]:cursor-pointer [&_button]:cursor-pointer',
        styles
      )}
      id={RenderingIdentifier}
    >
      <section className="bg-white py-16 md:py-24" data-testid="landing-social-proof">
        <div className="mx-auto max-w-[1100px] px-6 sm:px-10 lg:px-16">
          {hasTestimonial && (
            <figure className="grid grid-cols-[auto_1fr] gap-x-5 sm:gap-x-7" data-testid="testimonial">
              <QuoteMarkIcon
                className="mt-1 h-8 w-[42px] shrink-0 sm:h-9 sm:w-[48px]"
                color={quoteMark}
              />
              <div>
                {(testimonialQuote?.value || isEditing) && (
                  <blockquote
                    className="text-2xl font-medium leading-relaxed md:text-3xl"
                    style={{ color: brandFg, fontFamily: headingFont }}
                    data-testid="testimonial-quote"
                  >
                    <ContentSdkRichText field={testimonialQuote} />
                  </blockquote>
                )}
                <figcaption className="mt-8 flex items-center gap-4">
                  {(testimonialAuthorImage?.value?.src || isEditing) && (
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-[#f0eef8]">
                      <ContentSdkImage
                        field={testimonialAuthorImage}
                        className="h-full w-full object-cover"
                        width={48}
                        height={48}
                      />
                    </div>
                  )}
                  <div
                    className="border-l-[3px] pl-4 text-left"
                    style={{ borderColor: brandAccent }}
                  >
                    {(testimonialAuthorName?.value || isEditing) && (
                      <Text
                        field={testimonialAuthorName}
                        tag="p"
                        className="font-semibold"
                        style={{ color: brandFg, fontFamily: headingFont }}
                        data-testid="testimonial-author-name"
                      />
                    )}
                    {(testimonialAuthorTitle?.value || isEditing) && (
                      <Text
                        field={testimonialAuthorTitle}
                        tag="p"
                        className="text-sm"
                        style={{ color: brandMutedFg, fontFamily: bodyFont }}
                        data-testid="testimonial-author-title"
                      />
                    )}
                  </div>
                </figcaption>
              </div>
            </figure>
          )}

          {hasLogos && (
            <div className="mt-16 flex justify-center" data-testid="partner-logos">
              <ContentSdkImage
                field={partnerLogosImage}
                className="h-auto max-w-full opacity-70"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);
  return <LandingSocialProofBranded {...props} />;
};

export const Sodexo = (props: ComponentProps): JSX.Element => (
  <LandingSocialProofBranded {...props} />
);
