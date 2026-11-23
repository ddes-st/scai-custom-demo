'use client';

import { useSitecore } from '@sitecore-content-sdk/nextjs';
import { useEffect, useState } from 'react';
import { fetchWildcardChildren } from 'src/lib/wildcard';
import {
  NEWSROOM_BRANCH_PATH,
  selectNewsArticles,
  toNewsArticle,
  type NewsArticle,
} from './news-articles.util';

type NewsArticleListProps = {
  variant: 'home' | 'newsroom';
  promotedKeys?: string[];
  /** When set, stop paging once this many children are loaded and render at most this many. */
  maxItems?: number;
};

function NewsBadge({ label }: { label: string }) {
  return (
    <span className="absolute top-0 left-0 z-[2] bg-[#d51130] px-2 py-[0.2rem] text-[16px] font-normal leading-normal text-white">
      {label}
    </span>
  );
}

function HomeCard({ article }: { article: NewsArticle }) {
  return (
    <article className="group relative mb-4 font-['Source_Sans_Pro',sans-serif] font-light text-[#333] md:mb-0 md:pb-12">
      <a href={article.href || undefined} className="block text-inherit no-underline">
        {article.imageSrc ? (
          <div className="relative overflow-hidden">
            <img
              src={article.imageSrc}
              alt={article.imageAlt}
              className="block aspect-[4/3] h-auto w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
            <NewsBadge label={article.badge} />
          </div>
        ) : null}
        <div className="mt-[18px]">
          {article.date ? (
            <p className="m-0 text-[18px] font-normal leading-8 text-[#7e7c7c]">{article.date}</p>
          ) : null}
          <h3 className="m-0 mb-[18px] text-[30.06px] font-light leading-9 text-[#333]">{article.title}</h3>
          <span className="inline-flex items-center text-[18px] font-normal leading-[26px] text-[#00a0de]">
            {article.linkText}
            <span aria-hidden="true" className="ml-5 text-[18px] leading-none">
              →
            </span>
          </span>
        </div>
      </a>
    </article>
  );
}

function NewsroomCard({ article, featured }: { article: NewsArticle; featured: boolean }) {
  return (
    <article className="group font-['Source_Sans_Pro',sans-serif] font-light text-[#333]">
      <a href={article.href || undefined} className="block text-inherit no-underline">
        {article.imageSrc ? (
          <div className="relative overflow-hidden">
            <img
              src={article.imageSrc}
              alt={article.imageAlt}
              className={
                featured
                  ? 'block aspect-[2/1] h-auto w-full object-cover'
                  : 'block aspect-[3/2] h-auto w-full object-cover'
              }
            />
            <NewsBadge label={article.badge} />
          </div>
        ) : null}
        <div className="mt-[18px]">
          {article.date ? (
            <p className="m-0 text-[18px] font-normal leading-8 text-[#7e7c7c]">{article.date}</p>
          ) : null}
          {featured ? (
            <div className="mt-1 flex items-start justify-between gap-4">
              <h3 className="m-0 text-[30.06px] font-light leading-9 text-[#333]">{article.title}</h3>
              <span aria-hidden="true" className="mt-2 shrink-0 text-[22px] leading-none text-[#333]">
                →
              </span>
            </div>
          ) : (
            <>
              <h3 className="m-0 mb-[18px] text-[30.06px] font-light leading-9 text-[#333]">
                {article.title}
              </h3>
              <span className="inline-flex items-center text-[18px] font-normal leading-[26px] text-[#00a0de]">
                {article.linkText}
                <span aria-hidden="true" className="ml-5 text-[18px] leading-none">
                  →
                </span>
              </span>
            </>
          )}
        </div>
      </a>
    </article>
  );
}

export default function NewsArticleList({
  variant,
  promotedKeys = [],
  maxItems,
}: NewsArticleListProps) {
  const { page } = useSitecore();
  const language = page?.locale || 'en';
  const promotedKey = promotedKeys.join('|');
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    let cancelled = false;
    const keys = promotedKey ? promotedKey.split('|') : [];
    (async () => {
      const children = await fetchWildcardChildren({
        path: NEWSROOM_BRANCH_PATH,
        language,
        maxItems: keys.length ? undefined : maxItems,
      });
      if (cancelled) return;
      const branch = children
        .map(toNewsArticle)
        .filter((article): article is NewsArticle => article !== null);
      const selected = selectNewsArticles(branch, keys);
      setArticles(maxItems ? selected.slice(0, maxItems) : selected);
    })();
    return () => {
      cancelled = true;
    };
  }, [language, promotedKey, maxItems]);

  if (!articles.length) return null;

  if (variant === 'home') {
    return (
      <div className="grid grid-cols-1 gap-9 md:grid-cols-3 md:gap-x-[30px] md:gap-y-12">
        {articles.map((article) => (
          <HomeCard key={article.id} article={article} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-[30px] gap-y-12 md:grid-cols-3">
      {articles.map((article, index) => (
        <div key={article.id} className={index === 0 ? 'md:col-span-2' : undefined}>
          <NewsroomCard article={article} featured={index === 0} />
        </div>
      ))}
    </div>
  );
}
