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
import { BRAND_STYLE_TOKENS, brandStyleVars, getPageBrandStyle, resolveBrandStyle } from '@/lib/sodexo-brand-style';
import { SODEXO_BRAND_HERO_POSTERS } from '@/lib/sodexo-brands-media';

function isBrandHeroVideo(field?: ImageField): boolean {
  const val = field?.value as Record<string, unknown> | undefined;
  const damType = String(val?.['dam-content-type'] || '').toLowerCase();
  if (damType === 'video') return true;
  const src = String(val?.src || '');
  if (/\.(mp4|webm|mov|m4v)(\?|#|\/|$)/i.test(src)) return true;
  return /\/(108430|108436|108446)-/.test(src);
}

interface BrandHeroRouteFields {
  Title?: Field<string>;
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
  const brandLabel = BRAND_STYLE_TOKENS[style].label;
  const { brandHeroEyebrow, brandHeroTitle, brandHeroSubtitle, brandHeroImage, brandHeroCta, Title } = routeFields;
  const crumbName = Title?.value || brandLabel;

  return (
    <div className={cn('component brand-hero [&_a]:cursor-pointer', styles)} id={RenderingIdentifier} style={tokens}>
      <section className="w-full bg-white">
        <div className="mx-auto grid max-w-[1224px] items-center gap-10 px-4 py-10 sm:px-8 md:grid-cols-2 lg:gap-16 lg:px-16 lg:py-16">
          <div>
            <nav className="mb-5 text-sm" aria-label="Breadcrumb" style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}>
              <ol className="flex flex-wrap items-center gap-2 opacity-70">
                <li>
                  <a href="/" className="hover:opacity-70">Home</a>
                </li>
                <li aria-hidden="true">›</li>
                <li>What we do</li>
                <li aria-hidden="true">›</li>
                <li>
                  <a href="/Brands" className="hover:opacity-70">Food brands</a>
                </li>
                <li aria-hidden="true">›</li>
                <li>{crumbName}</li>
              </ol>
            </nav>
            {isEditing && brandHeroEyebrow && (
              <Text
                field={brandHeroEyebrow}
                tag="p"
                className="mb-3 text-sm opacity-70"
                style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
              />
            )}
            {(brandHeroTitle?.value || isEditing) && brandHeroTitle && (
              <Text
                field={brandHeroTitle}
                tag="h1"
                className="text-[32px] font-normal leading-[1.15] tracking-tight sm:text-[42px]"
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
                className="mt-8 inline-flex cursor-pointer items-center gap-2 border px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{
                  color: 'var(--brand-fg)',
                  borderColor: 'var(--brand-fg)',
                  borderRadius: 'var(--brand-button-radius)',
                  fontFamily: 'var(--brand-body-font)',
                }}
              >
                {brandHeroCta.value?.text || 'Contact us'}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </ContentSdkLink>
            )}
          </div>
          {(brandHeroImage?.value?.src || isEditing) && brandHeroImage && (
            <div className="relative min-h-[280px] overflow-hidden sm:min-h-[400px] lg:min-h-[480px]">
              {isBrandHeroVideo(brandHeroImage) && brandHeroImage.value?.src ? (
                <video
                  className="absolute inset-0 h-full w-full object-cover"
                  src={brandHeroImage.value.src}
                  poster={SODEXO_BRAND_HERO_POSTERS[style]}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <ContentSdkImage field={brandHeroImage} className="h-full w-full object-cover" />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
