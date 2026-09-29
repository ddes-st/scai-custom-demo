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
import { isSodexoBrandDetailPage } from '@/lib/sodexo-page';
import { brandStyleVars, getPageBrandStyle, resolveBrandStyle } from '@/lib/sodexo-brand-style';

interface BrandFinalCTARouteFields {
  brandCtaHeadline?: Field<string>;
  brandCtaSubhead?: RichTextField;
  brandCtaButton?: LinkField;
}

const BrandFinalCTADefaultComponent = (): JSX.Element => (
  <div className="component brand-final-cta">
    <div className="component-content">
      <span className="is-empty-hint">BrandFinalCTA</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): BrandFinalCTARouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as BrandFinalCTARouteFields) : null;
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoBrandDetailPage(props.page)) return SodexoBrand(props);
  return BrandFinalCTALayout(props);
};

export const SodexoBrand = (props: ComponentProps): JSX.Element => BrandFinalCTALayout(props);

function BrandFinalCTALayout({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <BrandFinalCTADefaultComponent />;

  const style = resolveBrandStyle(getPageBrandStyle(page), params.BrandStyle);
  const { brandCtaHeadline, brandCtaSubhead, brandCtaButton } = routeFields;

  return (
    <div className={cn('component brand-final-cta [&_a]:cursor-pointer', styles)} id={RenderingIdentifier} style={brandStyleVars(style)}>
      <section className="px-4 py-14 sm:px-8 lg:px-16" style={{ backgroundColor: 'var(--brand-muted)' }}>
        <div className="mx-auto flex max-w-[1224px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            {(brandCtaHeadline?.value || isEditing) && brandCtaHeadline && (
              <Text
                field={brandCtaHeadline}
                tag="h2"
                className="text-[28px] font-normal leading-tight sm:text-[36px]"
                style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
              />
            )}
            {(brandCtaSubhead?.value || isEditing) && brandCtaSubhead && (
              <ContentSdkRichText
                field={brandCtaSubhead}
                className="mt-4 max-w-xl text-base leading-7"
                style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
              />
            )}
          </div>
          {(brandCtaButton?.value?.href || isEditing) && brandCtaButton && (
            <ContentSdkLink
              field={brandCtaButton}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--brand-primary)',
                borderRadius: 'var(--brand-button-radius)',
                fontFamily: 'var(--brand-body-font)',
              }}
            >
              {brandCtaButton.value?.text || 'Get started'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </ContentSdkLink>
          )}
        </div>
      </section>
    </div>
  );
}
