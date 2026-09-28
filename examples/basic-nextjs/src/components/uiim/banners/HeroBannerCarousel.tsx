'use client';

import React, { JSX, useState, useEffect, useCallback } from 'react';
import {
  Field,
  ImageField,
  LinkField,
  NextImage as ContentSdkImage,
  Link as ContentSdkLink,
  RichText as ContentSdkRichText,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { SmartMedia } from '@/components/uiim/media/SmartMedia';
import { isSodexoArticlesPage } from '@/lib/sodexo-page';

interface HeroBannerCarouselSlideFields {
  id: string;
  slideTitle: { jsonValue: Field<string> };
  slideSubtitle: { jsonValue: Field<string> };
  slideImage: { jsonValue: ImageField };
  primaryLink: { jsonValue: LinkField };
  secondaryLink: { jsonValue: LinkField };
}

interface HeroBannerCarouselDatasource {
  title: { jsonValue: Field<string> };
  children: {
    results: HeroBannerCarouselSlideFields[];
  };
}

interface HeroBannerCarouselFields {
  data: {
    datasource: HeroBannerCarouselDatasource;
  };
}

type HeroBannerCarouselProps = ComponentProps & {
  fields: HeroBannerCarouselFields;
};

const HeroBannerCarouselDefaultComponent = (): JSX.Element => (
  <div className="component hero-banner-carousel">
    <div className="component-content">
      <span className="is-empty-hint">HeroBannerCarousel</span>
    </div>
  </div>
);

const PrimaryButton = ({
  field,
  isEditing,
}: {
  field: LinkField;
  isEditing?: boolean;
}) => {
  if (!field?.value?.href && !isEditing) return null;
  return (
    <ContentSdkLink
      field={field}
      className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 rounded-[var(--brand-button-radius,0.375rem)]"
      style={{
        backgroundColor: 'var(--brand-primary)',
        color: 'var(--brand-primary-foreground)',
      }}
    />
  );
};

const SecondaryButton = ({
  field,
  isEditing,
}: {
  field: LinkField;
  isEditing?: boolean;
}) => {
  if (!field?.value?.href && !isEditing) return null;
  return (
    <ContentSdkLink
      field={field}
      className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-current bg-transparent transition-opacity hover:opacity-70 rounded-[var(--brand-button-radius,0.375rem)]"
    />
  );
};

/* ────────────────────────────────────────────
   Default — full-width slides with dot indicators
   ──────────────────────────────────────────── */
export const Default = (props: HeroBannerCarouselProps): JSX.Element => {
  const { fields, params, page } = props;
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  const slides = datasource?.children?.results || [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setActiveIndex(((index % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (isPaused || isEditing || slides.length <= 1) return;
    const timer = setInterval(() => goTo(activeIndex + 1), 5000);
    return () => clearInterval(timer);
  }, [activeIndex, isPaused, isEditing, slides.length, goTo]);

  if (isSodexoArticlesPage(page) && slides.length) return SodexoArticles(props);
  if (!datasource || slides.length === 0) return <HeroBannerCarouselDefaultComponent />;

  const ariaLabel = datasource.title?.jsonValue?.value || 'Hero carousel';

  return (
    <div className={cn('component hero-banner-carousel', styles)} id={RenderingIdentifier}>
      <section
        className="relative w-full overflow-hidden"
        aria-label={ariaLabel}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Slides */}
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="relative flex min-h-[80vh] w-full flex-shrink-0 items-center justify-center overflow-hidden"
            >
              {/* Background image */}
              {(slide.slideImage?.jsonValue?.value?.src || isEditing) && (
                <div className="absolute inset-0">
                  <SmartMedia
                    field={slide.slideImage?.jsonValue}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                </div>
              )}
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/50" />
              {/* Content */}
              <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center text-white">
                <div className="space-y-6">
                  {(slide.slideTitle?.jsonValue?.value || isEditing) && (
                    <Text
                      field={slide.slideTitle?.jsonValue}
                      tag="h2"
                      className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl font-[var(--brand-heading-font,inherit)]"
                    />
                  )}
                  {(slide.slideSubtitle?.jsonValue?.value || isEditing) && (
                    <ContentSdkRichText
                      field={slide.slideSubtitle?.jsonValue}
                      className="mx-auto max-w-2xl text-lg opacity-90"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                    <PrimaryButton field={slide.primaryLink?.jsonValue} isEditing={isEditing} />
                    <SecondaryButton field={slide.secondaryLink?.jsonValue} isEditing={isEditing} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Prev / Next arrows */}
        {slides.length > 1 && !isEditing && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Previous slide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm transition hover:bg-black/60"
              aria-label="Next slide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'h-3 w-3 rounded-full transition-all',
                  i === activeIndex ? 'scale-110 bg-white' : 'bg-white/50 hover:bg-white/75'
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   WithThumbnails — thumbnail strip below main slide
   ──────────────────────────────────────────── */
export const WithThumbnails = ({ fields, params, page }: HeroBannerCarouselProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  const slides = datasource?.children?.results || [];

  const [activeIndex, setActiveIndex] = useState(0);

  if (!datasource || slides.length === 0) return <HeroBannerCarouselDefaultComponent />;

  const ariaLabel = datasource.title?.jsonValue?.value || 'Hero carousel';

  return (
    <div className={cn('component hero-banner-carousel', styles)} id={RenderingIdentifier}>
      <section className="w-full" aria-label={ariaLabel}>
        {/* Main slide */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="relative flex min-h-[70vh] w-full flex-shrink-0 items-center justify-center overflow-hidden"
              >
                {(slide.slideImage?.jsonValue?.value?.src || isEditing) && (
                  <div className="absolute inset-0">
                    <SmartMedia
                      field={slide.slideImage?.jsonValue}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center text-white">
                  <div className="space-y-6">
                    {(slide.slideTitle?.jsonValue?.value || isEditing) && (
                      <Text
                        field={slide.slideTitle?.jsonValue}
                        tag="h2"
                        className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl font-[var(--brand-heading-font,inherit)]"
                      />
                    )}
                    {(slide.slideSubtitle?.jsonValue?.value || isEditing) && (
                      <ContentSdkRichText
                        field={slide.slideSubtitle?.jsonValue}
                        className="mx-auto max-w-2xl text-lg opacity-90"
                      />
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                      <PrimaryButton field={slide.primaryLink?.jsonValue} isEditing={isEditing} />
                      <SecondaryButton field={slide.secondaryLink?.jsonValue} isEditing={isEditing} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thumbnail strip */}
        {slides.length > 1 && (
          <div
            className="flex justify-center gap-2 px-4 py-4"
            style={{ backgroundColor: 'var(--brand-header-bg, #1a1a2e)' }}
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={cn(
                  'relative h-16 w-24 overflow-hidden rounded-md border-2 transition-all sm:h-20 sm:w-32',
                  i === activeIndex
                    ? 'border-white opacity-100'
                    : 'border-transparent opacity-60 hover:opacity-80'
                )}
                aria-label={`Go to slide ${i + 1}`}
              >
                {slide.slideImage?.jsonValue?.value?.src && (
                  <ContentSdkImage
                    field={slide.slideImage?.jsonValue}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   SodexoArticles — featured stories strip for the Articles listing
   ──────────────────────────────────────────── */
export const SodexoArticles = ({ fields, params, page }: HeroBannerCarouselProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const datasource = fields?.data?.datasource;
  const slides = datasource?.children?.results || [];
  const [index, setIndex] = useState(0);

  if (!datasource || slides.length === 0) return <HeroBannerCarouselDefaultComponent />;

  const goTo = (n: number) => setIndex((n + slides.length) % slides.length);
  const current = slides[index];
  const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';

  return (
    <div className={cn('component hero-banner-carousel', styles)} id={RenderingIdentifier}>
      <section className="w-full" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '400px' }}>
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {slides.map((slide) => (
                <div key={slide.id} className="relative w-full shrink-0" style={{ minHeight: '400px' }}>
                  {(slide.slideImage?.jsonValue?.value?.src || isEditing) && (
                    <SmartMedia
                      field={slide.slideImage?.jsonValue}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
              <div className="max-w-md">
                {(current.slideTitle?.jsonValue?.value || isEditing) && (
                  <Text
                    field={current.slideTitle?.jsonValue}
                    tag="h3"
                    className="text-xl font-bold text-white sm:text-2xl"
                    style={{ fontFamily: headingFont }}
                  />
                )}
                {(current.slideSubtitle?.jsonValue?.value || isEditing) && (
                  <ContentSdkRichText
                    field={current.slideSubtitle?.jsonValue}
                    className="mt-2 text-sm text-white/70"
                  />
                )}
              </div>
            </div>
            {slides.length > 1 && (
              <>
                <div className="absolute bottom-6 right-6 flex gap-2 sm:bottom-10 sm:right-10">
                  {slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => goTo(i)}
                      className={cn(
                        'h-2.5 rounded-full transition-all',
                        i === index ? 'w-6 bg-white' : 'w-2.5 bg-white/50'
                      )}
                      aria-label={`Go to featured story ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => goTo(index + 1)}
                  className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-opacity hover:bg-white/30 sm:right-10 sm:top-10"
                  aria-label="Next story"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
