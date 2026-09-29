'use client';

import React, { JSX, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const items = [1, 2, 3].map((index) => ({
    question: routeFields[`brandFaq${index}Question` as keyof BrandFAQRouteFields] as Field<string> | undefined,
    answer: routeFields[`brandFaq${index}Answer` as keyof BrandFAQRouteFields] as RichTextField | undefined,
  }));

  return (
    <div className={cn('component brand-faq', styles)} id={RenderingIdentifier} style={brandStyleVars(style)}>
      <section className="w-full px-6 py-14 lg:px-12" style={{ backgroundColor: 'var(--brand-muted)' }}>
        <div className="mx-auto max-w-3xl">
          {(routeFields.brandFaqTitle?.value || isEditing) && (
            <Text
              field={routeFields.brandFaqTitle}
              tag="h2"
              className="mb-8 text-[28px] font-normal leading-tight"
              style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
            />
          )}
          <div>
            {items.map((item, index) => {
              if (!item.question?.value && !item.answer?.value && !isEditing) return null;
              const isOpen = openIndex === index;
              return (
                <div key={index} className="border-b" style={{ borderColor: 'color-mix(in srgb, var(--brand-fg) 18%, transparent)' }}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
                    aria-expanded={isOpen}
                  >
                    <Text
                      field={item.question}
                      tag="span"
                      className="text-base font-normal"
                      style={{ color: 'var(--brand-fg)', fontFamily: 'var(--brand-heading-font)' }}
                    />
                    <ChevronDown className={cn('h-5 w-5 shrink-0 transition-transform', isOpen && 'rotate-180')} style={{ color: 'var(--brand-accent)' }} />
                  </button>
                  {isOpen && (item.answer?.value || isEditing) && (
                    <ContentSdkRichText
                      field={item.answer}
                      className="pb-5 text-sm leading-7"
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
