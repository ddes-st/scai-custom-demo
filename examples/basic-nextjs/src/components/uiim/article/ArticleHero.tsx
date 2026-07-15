'use client';

import React, { JSX, useState } from 'react';
import {
  Field,
  ImageField,
  Text,
  NextImage as ContentSdkImage,
  DateField,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { PersonReference } from 'src/Layout';
import { SmartMedia } from '@/components/uiim/media/SmartMedia';

interface ArticleHeroRouteFields {
  Title?: Field<string>;
  ArticleImage?: ImageField;
  ArticleAuthor?: PersonReference;
  ArticlePublicationDate?: Field<string>;
  ArticleReadTime?: Field<string>;
}

const ArticleHeroDefaultComponent = (): JSX.Element => (
  <div className="component article-hero">
    <div className="component-content">
      <span className="is-empty-hint">ArticleHero</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): ArticleHeroRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as ArticleHeroRouteFields) : null;
}

function ShareButtons() {
  const [copied, setCopied] = useState(false);

  const handleShare = (platform: string) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'email':
        window.location.href = `mailto:?subject=${title}&body=${url}`;
        return;
      case 'copy':
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
        return;
    }
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <div className="flex items-center gap-3" data-testid="share-buttons">
      <span className="text-sm font-medium opacity-70">Share</span>
      {['facebook', 'twitter', 'linkedin', 'email'].map((platform) => (
        <button
          key={platform}
          onClick={() => handleShare(platform)}
          className="rounded-full p-2 transition-colors hover:bg-white/10"
          aria-label={`Share on ${platform}`}
          data-testid={`share-${platform}`}
        >
          <span className="text-sm capitalize">{platform}</span>
        </button>
      ))}
      <button
        onClick={() => handleShare('copy')}
        className="rounded-full p-2 transition-colors hover:bg-white/10"
        aria-label={copied ? 'Link copied' : 'Copy link'}
        data-testid="share-copy"
      >
        <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  );
}

function AuthorMeta({
  author,
  isEditing,
}: {
  author?: PersonReference;
  isEditing?: boolean;
}) {
  if (!author?.fields && !isEditing) return null;
  const fields = author?.fields;

  return (
    <div className="flex items-center gap-3" data-testid="author-meta">
      {fields?.personProfileImage?.value?.src && (
        <div className="h-10 w-10 overflow-hidden rounded-full">
          <ContentSdkImage
            field={fields.personProfileImage}
            className="h-full w-full object-cover"
            width={40}
            height={40}
          />
        </div>
      )}
      <div>
        {(fields?.personFirstName?.value || fields?.personLastName?.value || isEditing) && (
          <p className="text-sm font-medium" data-testid="author-name">
            {fields?.personFirstName?.value} {fields?.personLastName?.value}
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Default — full-bleed image with dark overlay, centered title
   ──────────────────────────────────────────── */
export const Default = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);

  if (!routeFields) return <ArticleHeroDefaultComponent />;

  const { Title: title, ArticleImage, ArticleAuthor, ArticlePublicationDate, ArticleReadTime } =
    routeFields;

  return (
    <div className={cn('component article-hero', styles)} id={RenderingIdentifier}>
      <header className="relative overflow-hidden" data-testid="article-hero-header">
        {/* Background image with overlay */}
        <div className="relative min-h-[60vh] bg-gray-900">
          {(ArticleImage?.value?.src || isEditing) && (
            <div className="absolute inset-0 opacity-40">
              <SmartMedia
                field={ArticleImage}
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}

          {/* Content overlay */}
          <div className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center text-white">
            {/* Title */}
            {(title?.value || isEditing) && (
              <Text
                field={title}
                tag="h1"
                className="mx-auto max-w-4xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl"
                data-testid="article-title"
              />
            )}

            {/* Metadata row */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm opacity-90">
              <AuthorMeta author={ArticleAuthor} isEditing={isEditing} />
              {(ArticlePublicationDate?.value || isEditing) && ArticlePublicationDate && (
                <time data-testid="article-date">
                  <DateField
                    field={ArticlePublicationDate}
                    tag="span"
                    render={(date) =>
                      new Date(String(date)).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    }
                  />
                </time>
              )}
              {(ArticleReadTime?.value || isEditing) && ArticleReadTime && (
                <Text
                  field={ArticleReadTime}
                  tag="span"
                  data-testid="article-read-time"
                />
              )}
            </div>

            {/* Share buttons */}
            <div className="mt-8">
              <ShareButtons />
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};

/* ────────────────────────────────────────────
   Minimal — no image, clean background, large title
   ──────────────────────────────────────────── */
export const Minimal = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);

  if (!routeFields) return <ArticleHeroDefaultComponent />;

  const { Title: title, ArticleAuthor, ArticlePublicationDate, ArticleReadTime } = routeFields;

  return (
    <div className={cn('component article-hero', styles)} id={RenderingIdentifier}>
      <header className="bg-white" data-testid="article-hero-header">
        <div className="mx-auto max-w-4xl px-4 py-16 md:py-24">
          {(title?.value || isEditing) && (
            <Text
              field={title}
              tag="h1"
              className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl lg:text-6xl"
              data-testid="article-title"
            />
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <AuthorMeta author={ArticleAuthor} isEditing={isEditing} />
            {(ArticlePublicationDate?.value || isEditing) && ArticlePublicationDate && (
              <time data-testid="article-date">
                <DateField
                  field={ArticlePublicationDate}
                  tag="span"
                  render={(date) =>
                    new Date(String(date)).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  }
                />
              </time>
            )}
            {(ArticleReadTime?.value || isEditing) && ArticleReadTime && (
              <Text field={ArticleReadTime} tag="span" data-testid="article-read-time" />
            )}
          </div>

          <div className="mt-6">
            <ShareButtons />
          </div>
        </div>
      </header>
    </div>
  );
};

/* ────────────────────────────────────────────
   SplitImage — two-column: image right, title + metadata left
   ──────────────────────────────────────────── */
/* ────────────────────────────────────────────
   Sodexo — clean white header, fully data-driven
   Breadcrumb from URL path, title / date / category from route fields
   ──────────────────────────────────────────── */

function SodexoBreadcrumb() {
  const [crumbs, setCrumbs] = React.useState<{ label: string; href: string }[]>([]);

  React.useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const built: { label: string; href: string }[] = [{ label: 'Home', href: '/' }];
    let path = '';
    for (const seg of segments) {
      path += `/${seg}`;
      const label = decodeURIComponent(seg)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      built.push({ label, href: path });
    }
    setCrumbs(built);
  }, []);

  if (crumbs.length === 0) return null;

  return (
    <nav
      className="mb-4 flex flex-wrap items-center gap-1.5 text-xs"
      style={{
        color: 'var(--brand-fg, #2a295c)',
        fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
      }}
      aria-label="Breadcrumb"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <React.Fragment key={crumb.href}>
            {i > 0 && <span className="opacity-40">&gt;</span>}
            {isLast ? (
              <span className="font-semibold opacity-80">{crumb.label}</span>
            ) : (
              <a href={crumb.href} className="opacity-60 transition-opacity hover:opacity-100">
                {crumb.label}
              </a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function extractCategoryFromTags(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
): string | null {
  try {
    const tags = page?.layout?.sitecore?.route?.fields?.SxaTags;
    if (Array.isArray(tags) && tags.length > 0) {
      return tags[0]?.displayName || tags[0]?.name || null;
    }
    if (tags && typeof tags === 'object' && tags.value) {
      if (Array.isArray(tags.value) && tags.value.length > 0) {
        return tags.value[0]?.displayName || tags.value[0]?.name || null;
      }
    }
  } catch {
    /* graceful fallback */
  }
  return null;
}

export const Sodexo = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);

  if (!routeFields) return <ArticleHeroDefaultComponent />;

  const { Title: title, ArticlePublicationDate } = routeFields;
  const category = extractCategoryFromTags(page);

  return (
    <div className={cn('component article-hero', styles)} id={RenderingIdentifier}>
      <header
        className="w-full"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
        data-testid="article-hero-header"
      >
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-10 sm:px-6 lg:px-8">
          <SodexoBreadcrumb />

          {(title?.value || isEditing) && (
            <Text
              field={title}
              tag="h1"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              style={{
                color: 'var(--brand-fg, #2a295c)',
                fontFamily: 'var(--brand-heading-font, "DM Sans", sans-serif)',
              }}
              data-testid="article-title"
            />
          )}

          <div className="mt-4 flex items-center gap-3">
            {category && (
              <>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--brand-muted, #f0eef8)',
                    color: 'var(--brand-primary, #283897)',
                    fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                  }}
                >
                  {category}
                </span>
                <span className="text-xs opacity-30" style={{ color: 'var(--brand-fg, #2a295c)' }}>
                  |
                </span>
              </>
            )}
            {(ArticlePublicationDate?.value || isEditing) && ArticlePublicationDate && (
              <span
                className="text-xs opacity-60"
                style={{
                  color: 'var(--brand-fg, #2a295c)',
                  fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
                }}
              >
                <DateField
                  field={ArticlePublicationDate}
                  tag="span"
                  render={(date) =>
                    new Date(String(date)).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
              </span>
            )}
          </div>
        </div>
      </header>
    </div>
  );
};

export const SplitImage = ({ params, page }: ComponentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);

  if (!routeFields) return <ArticleHeroDefaultComponent />;

  const { Title: title, ArticleImage, ArticleAuthor, ArticlePublicationDate, ArticleReadTime } =
    routeFields;

  return (
    <div className={cn('component article-hero', styles)} id={RenderingIdentifier}>
      <header data-testid="article-hero-header">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          {/* Left column — text */}
          <div className="flex flex-col justify-center">
            {(title?.value || isEditing) && (
              <Text
                field={title}
                tag="h1"
                className="text-4xl font-bold tracking-tight text-gray-900 md:text-5xl"
                data-testid="article-title"
              />
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <AuthorMeta author={ArticleAuthor} isEditing={isEditing} />
              {(ArticlePublicationDate?.value || isEditing) && ArticlePublicationDate && (
                <time data-testid="article-date">
                  <DateField
                    field={ArticlePublicationDate}
                    tag="span"
                    render={(date) =>
                      new Date(String(date)).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    }
                  />
                </time>
              )}
              {(ArticleReadTime?.value || isEditing) && ArticleReadTime && (
                <Text field={ArticleReadTime} tag="span" data-testid="article-read-time" />
              )}
            </div>

            <div className="mt-8">
              <ShareButtons />
            </div>
          </div>

          {/* Right column — image */}
          {(ArticleImage?.value?.src || isEditing) && (
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-lg"
              data-testid="split-image"
            >
              <SmartMedia
                field={ArticleImage}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      </header>
    </div>
  );
};
