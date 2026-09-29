import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  RichTextField,
  Text,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoBrandDetailPage } from '@/lib/sodexo-page';
import { brandStyleVars, getPageBrandStyle, resolveBrandStyle } from '@/lib/sodexo-brand-style';

interface BrandHeroRouteFields {
  brandHeroEyebrow?: Field<string>;
  brandHeroTitle?: Field<string>;
  brandHeroSubtitle?: RichTextField;
  brandHeroImage?: ImageField;
  brandHeroCta?: LinkField;
}

const BrandHeroDefaultComponent = (): JSX.Element => (
  <div className="component brand-hero">
    <div className="component-content">
      <span className="is-empty-hint">BrandHero</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): BrandHeroRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as BrandHeroRouteFields) : null;
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoBrandDetailPage(props.page)) return SodexoBrand(props);
  return BrandHeroLayout(props);
};

export const SodexoBrand = (props: ComponentProps): JSX.Element => BrandHeroLayout(props);

function BrandHeroLayout({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <BrandHeroDefaultComponent />;

  const style = resolveBrandStyle(getPageBrandStyle(page), params.BrandStyle);
  const tokens = brandStyleVars(style);
  const { brandHeroEyebrow, brandHeroTitle, brandHeroSubtitle, brandHeroImage, brandHeroCta } = routeFields;

  return (
    <div className={cn('component brand-hero [&_a]:cursor-pointer', styles)} id={RenderingIdentifier} style={tokens}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-muted)' }}>
        <div className="mx-auto grid max-w-[1224px] items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:px-12 lg:py-16">
          <div>
            {(brandHeroEyebrow?.value || isEditing) && brandHeroEyebrow && (
              <Text
                field={brandHeroEyebrow}
                tag="p"
                className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--brand-accent)', fontFamily: 'var(--brand-body-font)' }}
              />
            )}
            {(brandHeroTitle?.value || isEditing) && brandHeroTitle && (
              <Text
                field={brandHeroTitle}
                tag="h1"
                className="text-[32px] font-normal leading-tight sm:text-[42px]"
                style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
              />
            )}
            {(brandHeroSubtitle?.value || isEditing) && brandHeroSubtitle && (
              <ContentSdkRichText
                field={brandHeroSubtitle}
                className="mt-5 max-w-xl text-base leading-7"
                style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
              />
            )}
            {(brandHeroCta?.value?.href || isEditing) && brandHeroCta && (
              <ContentSdkLink
                field={brandHeroCta}
                className="mt-8 inline-flex cursor-pointer items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white"
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  borderRadius: 'var(--brand-button-radius)',
                  fontFamily: 'var(--brand-body-font)',
                }}
              />
            )}
          </div>
          {(brandHeroImage?.value?.src || isEditing) && brandHeroImage && (
            <div className="relative min-h-[280px] overflow-hidden sm:min-h-[400px]">
              <ContentSdkImage field={brandHeroImage} className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
