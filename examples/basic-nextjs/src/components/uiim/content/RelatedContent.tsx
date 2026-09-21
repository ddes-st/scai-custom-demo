'use client';

import React, { JSX } from 'react';
import Image from 'next/image';
import {
  Field,
  Text,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoAboutPage } from '@/lib/sodexo-page';

interface RelatedContentFields {
  Title: Field<string>;
}

type RelatedContentProps = ComponentProps & {
  fields: RelatedContentFields;
};

const RelatedContentDefaultComponent = (): JSX.Element => (
  <div className="component related-content">
    <div className="component-content">
      <span className="is-empty-hint">RelatedContent</span>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Default — title + placeholder grid
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: RelatedContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (isSodexoAboutPage(page)) return SodexoAbout({ fields: fields || { Title: { value: FALLBACK_NEWS_TITLE } }, params, page });
  if (!fields) return <RelatedContentDefaultComponent />;

  return (
    <div className={cn('component related-content', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12 md:py-16" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-5xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-8 text-center text-2xl font-bold"
              style={{ color: 'var(--brand-fg, #111)' }}
            />
          )}
          <p className="text-center text-sm opacity-50">Related content will appear here.</p>
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — "More about Sodexo" 4-card grid
   ──────────────────────────────────────────── */

const brandFg = 'var(--brand-fg, #2a295c)';
const brandAccent = 'var(--brand-accent, #da2020)';
const brandPrimary = 'var(--brand-primary, #283897)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

interface RelatedArticle {
  category: string;
  title: string;
  image: string;
  href: string;
}

const RelatedArticleCard = ({ category, title, image, href }: RelatedArticle) => (
  <a
    href={href}
    className="group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
  >
    <div className="p-4 pb-2">
      <span className="text-xs font-semibold" style={{ color: brandPrimary, fontFamily: bodyFont }}>
        {category}
      </span>
      <h4
        className="mt-1 line-clamp-3 text-sm font-bold leading-snug"
        style={{ color: brandFg, fontFamily: headingFont }}
      >
        {title}
      </h4>
    </div>
    <div className="relative mt-auto aspect-[4/3] w-full">
      <Image src={image} alt={title} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" />
    </div>
    <div className="flex items-center gap-1 px-4 py-3">
      <span
        className="text-xs font-semibold transition-colors group-hover:opacity-70"
        style={{ color: brandAccent, fontFamily: bodyFont }}
      >
        Read more
      </span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: brandAccent }}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </div>
  </a>
);

const RELATED_ARTICLES: RelatedArticle[] = [
  {
    category: 'Healthcare',
    title: 'Why day one matters: Mobilizing critical FM services in healthcare',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106421-section3-img2?v=ee51d56f',
    href: '#',
  },
  {
    category: 'Food',
    title: 'Shaping food services to fuel the future of manufacturing',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106429-section3-img3?v=b3caf991',
    href: '#',
  },
  {
    category: 'Modern Recipe',
    title: 'Eating Healthy at Work Made Easy',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106439-section3-img4?v=b3ec3d50',
    href: '#',
  },
  {
    category: 'Workplace Experience',
    title: 'Facilities Management in Manufacturing: how providers can reduce downtime',
    image: 'https://ddes.sitecoresandbox.cloud/api/public/content/106461-section4-img6?v=b0b2d3d8',
    href: '#',
  },
];

export const Sodexo = ({ fields, params, page }: RelatedContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (isSodexoAboutPage(page)) return SodexoAbout({ fields: fields || { Title: { value: FALLBACK_NEWS_TITLE } }, params, page });
  if (!fields) return <RelatedContentDefaultComponent />;

  return (
    <div className={cn('component related-content', styles)} id={RenderingIdentifier}>
      <section
        className="w-full px-4 pb-16 pt-8"
        style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}
      >
        <div className="mx-auto max-w-5xl">
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="mb-8 text-center text-2xl font-bold"
              style={{ color: brandFg, fontFamily: headingFont }}
            />
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RELATED_ARTICLES.map((article, i) => (
              <RelatedArticleCard key={i} {...article} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const ABOUT_NEWS: RelatedArticle[] = [
  {
    category: 'Food',
    title: "Carole's story: good food can change lives",
    image:
      'https://edge.sitecorecloud.io/sodexofrance1-sodexocorpsites-prod-e74c/media/Project/Sodexo-Corp/Global/Media-prod/Images/Banner-1240x698/people-stories/2026/carole-galissant-banner.jpeg',
    href: 'https://www.sodexo.com/working-at-sodexo/our-people-stories/2026/director-food-nutrition',
  },
  {
    category: 'Business and Industries',
    title: 'The State of Workplace Hospitality 2026',
    image:
      'https://edge.sitecorecloud.io/sodexofrance1-sodexocorpsites-prod-e74c/media/Project/Sodexo-Corp/Global/Media-prod/Images/Banner-card-608x342/built-workplace-leaders.jpg',
    href: 'https://www.sodexo.com/blog/our-everyday-stories/reports/workplace-hospitality-2026',
  },
  {
    category: 'Business and Industries',
    title: "Gordon's story: challenges are key to learning your craft",
    image:
      'https://edge.sitecorecloud.io/sodexofrance1-sodexocorpsites-prod-e74c/media/Project/Sodexo-Corp/Global/Media-prod/Images/Banner-1240x698/people-stories/2026/gordon-carberry-banner.jpeg',
    href: 'https://www.sodexo.com/working-at-sodexo/our-people-stories/2026/development-chef-Ireland',
  },
  {
    category: 'Food',
    title: 'Food As Medicine: How Data, Science and Behavioral Design Are Turning Nutrition into a Clinical Lever',
    image:
      'https://edge.sitecorecloud.io/sodexofrance1-sodexocorpsites-prod-e74c/media/Project/Sodexo-Corp/Global/Media-prod/Images/Banner-1240x698/2026/food-medicine-healthcare-banner.jpeg',
    href: 'https://www.sodexo.com/blog/our-everyday-stories/business-stories/2026/food-as-medicine-healthcare-nutrition',
  },
];

const FALLBACK_NEWS_TITLE = 'Latest news and thought leadership:';

export const SodexoAbout = ({ fields, params, page }: RelatedContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;

  const titleField: Field<string> = {
    ...(fields?.Title || { value: '' }),
    value: fields?.Title?.value || FALLBACK_NEWS_TITLE,
  };

  return (
    <div className={cn('component related-content', styles)} id={RenderingIdentifier}>
      <section className="w-full px-4 py-12 md:py-16" style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        <div className="mx-auto max-w-[1224px] lg:px-12">
          {(titleField.value || isEditing) && (
            <Text
              field={titleField}
              tag="h2"
              className="mb-10 text-center text-[28px] font-normal sm:text-[32px]"
              style={{ color: brandFg, fontFamily: headingFont }}
            />
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT_NEWS.map((article, i) => (
              <RelatedArticleCard key={i} {...article} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
