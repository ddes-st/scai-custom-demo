'use client';

import React, { JSX, useState } from 'react';
import { Field, RichTextField, Text, RichText as ContentSdkRichText } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoBrandDetailPage } from '@/lib/sodexo-page';
import { brandStyleVars, getPageBrandStyle, resolveBrandStyle } from '@/lib/sodexo-brand-style';

interface BrandFAQRouteFields {
  brandFaqTitle?: Field<string>;
  brandFaq1Question?: Field<string>;
  brandFaq1Answer?: RichTextField;
  brandFaq2Question?: Field<string>;
  brandFaq2Answer?: RichTextField;
  brandFaq3Question?: Field<string>;
  brandFaq3Answer?: RichTextField;
  brandFaq4Question?: Field<string>;
  brandFaq4Answer?: RichTextField;
  brandFaq5Question?: Field<string>;
  brandFaq5Answer?: RichTextField;
  brandFaq6Question?: Field<string>;
  brandFaq6Answer?: RichTextField;
}

const BrandFAQDefaultComponent = (): JSX.Element => (
  <div className="component brand-faq">
    <div className="component-content">
      <span className="is-empty-hint">BrandFAQ</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): BrandFAQRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as BrandFAQRouteFields) : null;
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoBrandDetailPage(props.page)) return SodexoBrand(props);
  return BrandFAQLayout(props);
};

export const SodexoBrand = (props: ComponentProps): JSX.Element => BrandFAQLayout(props);

function BrandFAQLayout({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  const [openIndex, setOpenIndex] = useState(0);
  if (!routeFields) return <BrandFAQDefaultComponent />;

  const style = resolveBrandStyle(getPageBrandStyle(page), params.BrandStyle);
  const items = [1, 2, 3, 4, 5, 6].map((index) => ({
    question: routeFields[`brandFaq${index}Question` as keyof BrandFAQRouteFields] as Field<string> | undefined,
    answer: routeFields[`brandFaq${index}Answer` as keyof BrandFAQRouteFields] as RichTextField | undefined,
  }));

  return (
    <div className={cn('component brand-faq', styles)} id={RenderingIdentifier} style={brandStyleVars(style)}>
      <section className="w-full bg-white px-4 py-14 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-[1224px]">
          {(routeFields.brandFaqTitle?.value || isEditing) && routeFields.brandFaqTitle && (
            <Text
              field={routeFields.brandFaqTitle}
              tag="h3"
              className="mb-8 text-[24px] font-normal leading-tight sm:text-[28px]"
              style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
            />
          )}
          <div>
            {items.map((item, index) => {
              if (!item.question?.value && !item.answer?.value && !isEditing) return null;
              const isOpen = openIndex === index;
              return (
                <div key={index} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--brand-fg) 16%, transparent)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    {item.question && (
                      <Text
                        field={item.question}
                        tag="span"
                        className="text-base font-normal"
                        style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                      />
                    )}
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none"
                      style={{ color: 'var(--brand-fg)', backgroundColor: 'var(--brand-muted)' }}
                      aria-hidden
                    >
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (item.answer?.value || isEditing) && item.answer && (
                    <ContentSdkRichText
                      field={item.answer}
                      className="max-w-4xl pb-6 text-sm leading-7"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-body-font)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
