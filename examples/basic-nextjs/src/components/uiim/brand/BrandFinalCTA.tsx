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
      <section className="px-6 py-16 lg:px-12" style={{ backgroundColor: 'var(--brand-primary)' }}>
        <div className="mx-auto max-w-3xl text-center">
          {(brandCtaHeadline?.value || isEditing) && brandCtaHeadline && (
            <Text
              field={brandCtaHeadline}
              tag="h2"
              className="text-[28px] font-normal leading-tight text-white sm:text-[36px]"
              style={{ fontFamily: 'var(--brand-heading-font)' }}
            />
          )}
          {(brandCtaSubhead?.value || isEditing) && brandCtaSubhead && (
            <ContentSdkRichText
              field={brandCtaSubhead}
              className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/85"
              style={{ fontFamily: 'var(--brand-body-font)' }}
            />
          )}
          {(brandCtaButton?.value?.href || isEditing) && brandCtaButton && (
            <ContentSdkLink
              field={brandCtaButton}
              className="mt-8 inline-flex cursor-pointer items-center px-6 py-3 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--brand-accent)',
                color: style === 'kitchen-works' ? '#111' : '#fff',
                borderRadius: 'var(--brand-button-radius)',
                fontFamily: 'var(--brand-body-font)',
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
