import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  Text,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingHeroRouteFields {
  heroEyebrow?: Field<string>;
  heroHeadline?: Field<string>;
  heroSubhead?: Field<string>;
  heroPrimaryCta?: LinkField;
  heroSecondaryCta?: LinkField;
  heroImage?: ImageField;
  heroVideo?: LinkField;
}

const brandPrimary = 'var(--brand-primary, #283897)';
const brandSecondary = 'var(--brand-secondary, #2a295c)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const LandingHeroDefaultComponent = (): JSX.Element => (
  <div className="component landing-hero">
    <div className="component-content">
      <span className="is-empty-hint">LandingHero</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingHeroRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingHeroRouteFields) : null;
}

function CtaArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="9 5 19 5 19 15" />
    </svg>
  );
}

function HeroMedia({
  image,
  video,
  isEditing,
  className,
}: {
  image?: ImageField;
  video?: LinkField;
  isEditing?: boolean;
  className?: string;
}) {
  const videoHref = video?.value?.href;
  if (videoHref) {
    return (
      <video
        className={cn('h-full w-full object-cover', className)}
        src={videoHref}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  if (image?.value?.src || isEditing) {
    return (
      <ContentSdkImage
        field={image}
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }
  return null;
}

function CtaPair({
  primary,
  secondary,
  isEditing,
  variant,
}: {
  primary?: LinkField;
  secondary?: LinkField;
  isEditing?: boolean;
  variant: 'default' | 'minimal' | 'split';
}) {
  const showPrimary = primary?.value?.href || isEditing;
  const showSecondary = secondary?.value?.href || isEditing;
  if (!showPrimary && !showSecondary) return null;

  const primaryClasses =
    variant === 'default'
      ? 'inline-flex cursor-pointer items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90'
      : 'inline-flex cursor-pointer items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-gray-800';

  const secondaryClasses =
    variant === 'default'
      ? 'inline-flex cursor-pointer items-center justify-center gap-2 border border-white/50 bg-transparent px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-70'
      : 'inline-flex cursor-pointer items-center justify-center rounded-md border border-gray-300 px-6 py-3 text-base font-semibold text-gray-900 transition hover:bg-gray-50';

  const primaryStyle =
    variant === 'default'
      ? { backgroundColor: brandPrimary, borderRadius: '4px' }
      : undefined;
  const secondaryStyle = variant === 'default' ? { borderRadius: '4px' } : undefined;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4" data-testid="hero-ctas">
      {showPrimary && primary && (
        <ContentSdkLink
          field={primary}
          className={primaryClasses}
          style={primaryStyle}
          data-testid="hero-primary-cta"
        >
          {primary.value?.text || 'Learn more'}
          {variant === 'default' && <CtaArrow />}
        </ContentSdkLink>
      )}
      {showSecondary && secondary && (
        <ContentSdkLink
          field={secondary}
          className={secondaryClasses}
          style={secondaryStyle}
          data-testid="hero-secondary-cta"
        >
          {secondary.value?.text || 'Learn more'}
          {variant === 'default' && <CtaArrow />}
        </ContentSdkLink>
      )}
    </div>
  );
}

function LandingHeroBranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingHeroDefaultComponent />;

  const {
    heroEyebrow,
    heroHeadline,
    heroSubhead,
    heroPrimaryCta,
    heroSecondaryCta,
    heroImage,
    heroVideo,
  } = routeFields;

  const hasMedia = heroVideo?.value?.href || heroImage?.value?.src || isEditing;

  return (
    <div
      className={cn('component landing-hero [&_a]:cursor-pointer [&_button]:cursor-pointer', styles)}
      id={RenderingIdentifier}
    >
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: brandSecondary }}
        data-testid="landing-hero"
      >
        {hasMedia && (
          <div className="absolute inset-0 opacity-30">
            <HeroMedia image={heroImage} video={heroVideo} isEditing={isEditing} />
          </div>
        )}
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center text-white md:py-32">
          {(heroEyebrow?.value || isEditing) && (
            <Text
              field={heroEyebrow}
              tag="p"
              className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/80"
              style={{ fontFamily: headingFont }}
              data-testid="hero-eyebrow"
            />
          )}
          {(heroHeadline?.value || isEditing) && (
            <Text
              field={heroHeadline}
              tag="h1"
              className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
              style={{ fontFamily: headingFont }}
              data-testid="hero-headline"
            />
          )}
          {(heroSubhead?.value || isEditing) && (
            <Text
              field={heroSubhead}
              tag="p"
              className="mt-6 max-w-2xl text-lg text-white/80 md:text-xl"
              style={{ fontFamily: bodyFont }}
              data-testid="hero-subhead"
            />
          )}
          <CtaPair
            primary={heroPrimaryCta}
            secondary={heroSecondaryCta}
            isEditing={isEditing}
            variant="default"
          />
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────
   Default — branded centered overlay (Sodexo baseline)
   On the sodexo site, routes to the Sodexo export.
   ──────────────────────────────────────────── */
export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);
  return <LandingHeroBranded {...props} />;
};

/* ────────────────────────────────────────────
   Sodexo — same branded overlay as Default
   ──────────────────────────────────────────── */
export const Sodexo = (props: ComponentProps): JSX.Element => <LandingHeroBranded {...props} />;

/* ────────────────────────────────────────────
   SplitImage — two-column: text left, hero media right
   ──────────────────────────────────────────── */
export const SplitImage = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingHeroDefaultComponent />;

  const {
    heroEyebrow,
    heroHeadline,
    heroSubhead,
    heroPrimaryCta,
    heroSecondaryCta,
    heroImage,
    heroVideo,
  } = routeFields;

  const hasMedia = heroVideo?.value?.href || heroImage?.value?.src || isEditing;

  return (
    <div className={cn('component landing-hero [&_a]:cursor-pointer', styles)} id={RenderingIdentifier}>
      <section className="bg-white" data-testid="landing-hero">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col justify-center">
            {(heroEyebrow?.value || isEditing) && (
              <Text
                field={heroEyebrow}
                tag="p"
                className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-600"
                data-testid="hero-eyebrow"
              />
            )}
            {(heroHeadline?.value || isEditing) && (
              <Text
                field={heroHeadline}
                tag="h1"
                className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl"
                data-testid="hero-headline"
              />
            )}
            {(heroSubhead?.value || isEditing) && (
              <Text
                field={heroSubhead}
                tag="p"
                className="mt-6 text-lg text-gray-600"
                data-testid="hero-subhead"
              />
            )}
            <CtaPair
              primary={heroPrimaryCta}
              secondary={heroSecondaryCta}
              isEditing={isEditing}
              variant="split"
            />
          </div>
          {hasMedia && (
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100"
              data-testid="hero-media"
            >
              <HeroMedia image={heroImage} video={heroVideo} isEditing={isEditing} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Minimal — text-only, no media (retargeting visitor)
   ──────────────────────────────────────────── */
export const Minimal = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingHeroDefaultComponent />;

  const { heroEyebrow, heroHeadline, heroSubhead, heroPrimaryCta, heroSecondaryCta } = routeFields;

  return (
    <div className={cn('component landing-hero [&_a]:cursor-pointer', styles)} id={RenderingIdentifier}>
      <section className="bg-white" data-testid="landing-hero">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          {(heroEyebrow?.value || isEditing) && (
            <Text
              field={heroEyebrow}
              tag="p"
              className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-600"
              data-testid="hero-eyebrow"
            />
          )}
          {(heroHeadline?.value || isEditing) && (
            <Text
              field={heroHeadline}
              tag="h1"
              className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-6xl"
              data-testid="hero-headline"
            />
          )}
          {(heroSubhead?.value || isEditing) && (
            <Text
              field={heroSubhead}
              tag="p"
              className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 md:text-xl"
              data-testid="hero-subhead"
            />
          )}
          <div className="flex justify-center">
            <CtaPair
              primary={heroPrimaryCta}
              secondary={heroSecondaryCta}
              isEditing={isEditing}
              variant="minimal"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
