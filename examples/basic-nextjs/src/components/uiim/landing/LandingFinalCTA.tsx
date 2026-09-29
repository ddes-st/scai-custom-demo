import React, { JSX } from 'react';
import {
  Field,
  LinkField,
  RichTextField,
  Text,
  Link as ContentSdkLink,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingFinalCTARouteFields {
  finalCtaHeadline?: Field<string>;
  finalCtaSubhead?: RichTextField;
  finalCtaButton?: LinkField;
}

const brandPrimary = 'var(--brand-primary, #283897)';
const brandSecondary = 'var(--brand-secondary, #2a295c)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const LandingFinalCTADefaultComponent = (): JSX.Element => (
  <div className="component landing-final-cta">
    <div className="component-content">
      <span className="is-empty-hint">LandingFinalCTA</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingFinalCTARouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingFinalCTARouteFields) : null;
}

function CtaArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="9 5 19 5 19 15" />
    </svg>
  );
}

function LandingFinalCTABranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingFinalCTADefaultComponent />;

  const { finalCtaHeadline, finalCtaSubhead, finalCtaButton } = routeFields;

  return (
    <div
      className={cn(
        'component landing-final-cta [&_a]:cursor-pointer [&_button]:cursor-pointer',
        styles
      )}
      id={RenderingIdentifier}
    >
      <section className="py-16 md:py-24" style={{ backgroundColor: brandSecondary }} data-testid="landing-final-cta">
        <div className="mx-auto max-w-3xl px-4 text-center">
          {(finalCtaHeadline?.value || isEditing) && (
            <Text
              field={finalCtaHeadline}
              tag="h2"
              className="text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl"
              style={{ fontFamily: headingFont }}
              data-testid="final-cta-headline"
            />
          )}
          {(finalCtaSubhead?.value || isEditing) && (
            <div
              className="mx-auto mt-6 max-w-xl text-lg text-white/80"
              style={{ fontFamily: bodyFont }}
              data-testid="final-cta-subhead"
            >
              <ContentSdkRichText field={finalCtaSubhead} />
            </div>
          )}
          {(finalCtaButton?.value?.href || isEditing) && finalCtaButton && (
            <div className="mt-8">
              <ContentSdkLink
                field={finalCtaButton}
                className="inline-flex cursor-pointer items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandPrimary, borderRadius: '4px' }}
                data-testid="final-cta-button"
              >
                {finalCtaButton.value?.text || 'Learn more'}
                <CtaArrow />
              </ContentSdkLink>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);
  return <LandingFinalCTABranded {...props} />;
};

export const Sodexo = (props: ComponentProps): JSX.Element => <LandingFinalCTABranded {...props} />;
