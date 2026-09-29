'use client';

import React, { JSX, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Field,
  RichTextField,
  Text,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingFAQRouteFields {
  faq1Question?: Field<string>;
  faq1Answer?: RichTextField;
  faq2Question?: Field<string>;
  faq2Answer?: RichTextField;
  faq3Question?: Field<string>;
  faq3Answer?: RichTextField;
  faq4Question?: Field<string>;
  faq4Answer?: RichTextField;
  faq5Question?: Field<string>;
  faq5Answer?: RichTextField;
}

const brandFg = 'var(--brand-fg, #2a295c)';
const brandBorder = 'var(--brand-border, #e0dff0)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const LandingFAQDefaultComponent = (): JSX.Element => (
  <div className="component landing-faq">
    <div className="component-content">
      <span className="is-empty-hint">LandingFAQ</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingFAQRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingFAQRouteFields) : null;
}

function FAQItem({
  index,
  question,
  answer,
  isOpen,
  onToggle,
  isEditing,
}: {
  index: number;
  question?: Field<string>;
  answer?: RichTextField;
  isOpen: boolean;
  onToggle: () => void;
  isEditing?: boolean;
}) {
  if (!question?.value && !answer?.value && !isEditing) return null;
  return (
    <div className="border-b" style={{ borderColor: brandBorder }} data-testid={`faq-item-${index}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left"
        aria-expanded={isOpen}
      >
        {(question?.value || isEditing) && (
          <Text
            field={question}
            tag="span"
            className="text-base font-semibold md:text-lg"
            style={{ color: brandFg, fontFamily: headingFont }}
            data-testid="faq-question"
          />
        )}
        <ChevronDown
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
          style={{ color: brandFg }}
        />
      </button>
      {isOpen && (answer?.value || isEditing) && (
        <div
          className="pb-5 pr-10 text-sm md:text-base"
          style={{ color: brandFg, fontFamily: bodyFont }}
          data-testid="faq-answer"
        >
          <ContentSdkRichText field={answer} />
        </div>
      )}
    </div>
  );
}

function LandingFAQBranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!routeFields) return <LandingFAQDefaultComponent />;

  const items = [
    { question: routeFields.faq1Question, answer: routeFields.faq1Answer },
    { question: routeFields.faq2Question, answer: routeFields.faq2Answer },
    { question: routeFields.faq3Question, answer: routeFields.faq3Answer },
    { question: routeFields.faq4Question, answer: routeFields.faq4Answer },
    { question: routeFields.faq5Question, answer: routeFields.faq5Answer },
  ];

  return (
    <div
      className={cn('component landing-faq [&_a]:cursor-pointer [&_button]:cursor-pointer', styles)}
      id={RenderingIdentifier}
    >
      <section className="bg-white py-16 md:py-24" data-testid="landing-faq">
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl"
            style={{ color: brandFg, fontFamily: headingFont }}
          >
            Frequently asked questions
          </h2>
          <div className="border-t" style={{ borderColor: brandBorder }}>
            {items.map((item, i) => (
              <FAQItem
                key={i}
                index={i + 1}
                question={item.question}
                answer={item.answer}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                isEditing={isEditing}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);
  return <LandingFAQBranded {...props} />;
};

export const Sodexo = (props: ComponentProps): JSX.Element => <LandingFAQBranded {...props} />;
