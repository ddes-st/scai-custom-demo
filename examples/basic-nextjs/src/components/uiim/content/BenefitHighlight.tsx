'use client';

import React, { JSX } from 'react';
import {
  Field,
  ImageField,
  Text,
  NextImage as ContentSdkImage,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

interface BenefitHighlightFields {
  Title: Field<string>;
  Description: Field<string>;
  BackgroundImage: ImageField;
  FeatureImage: ImageField;
}

type BenefitHighlightProps = ComponentProps & {
  fields: BenefitHighlightFields;
};

const BenefitHighlightDefaultComponent = (): JSX.Element => (
  <div className="component benefit-highlight">
    <div className="component-content">
      <span className="is-empty-hint">BenefitHighlight</span>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Default — dark overlay banner with title + description
   ──────────────────────────────────────────── */
export const Default = ({ fields, params, page }: BenefitHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <BenefitHighlightDefaultComponent />;

  return (
    <div className={cn('component benefit-highlight', styles)} id={RenderingIdentifier}>
      <section className="relative overflow-hidden" style={{ minHeight: '360px' }}>
        {(fields.BackgroundImage?.value?.src || isEditing) && (
          <ContentSdkImage
            field={fields.BackgroundImage}
            fill
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/60" />
        <div
          className="relative z-10 mx-auto flex max-w-4xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8"
          style={{ minHeight: '360px' }}
        >
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="max-w-lg text-3xl font-bold text-white sm:text-4xl"
            />
          )}
          {(fields.Description?.value || isEditing) && (
            <Text
              field={fields.Description}
              tag="p"
              className="mt-6 max-w-xl text-sm leading-relaxed text-white/80"
            />
          )}
        </div>
      </section>
    </div>
  );
};

/* ────────────────────────────────────────────
   Sodexo — results overlay + 3 numbered benefit cards
   ──────────────────────────────────────────── */

const brandFg = 'var(--brand-fg, #2a295c)';
const brandAccent = 'var(--brand-accent, #da2020)';
const brandPrimary = 'var(--brand-primary, #283897)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

interface BenefitCardProps {
  number: string;
  title: string;
  description: string;
  statValue: string;
  statLabel: string;
  statDetail: string;
}

const BenefitCard = ({ number, title, description, statValue, statLabel, statDetail }: BenefitCardProps) => (
  <div className="rounded-2xl p-8" style={{ backgroundColor: 'var(--brand-muted, #f0eef8)' }}>
    <p className="mb-2 text-sm font-bold" style={{ color: brandAccent, fontFamily: bodyFont }}>
      {number}
    </p>
    <h3 className="mb-3 text-xl font-bold" style={{ color: brandFg, fontFamily: headingFont }}>
      {title}
    </h3>
    <p className="mb-6 text-sm leading-relaxed opacity-70" style={{ color: brandFg, fontFamily: bodyFont }}>
      {description}
    </p>
    <div className="rounded-xl p-5" style={{ backgroundColor: brandPrimary }}>
      <p className="text-lg font-bold text-white" style={{ fontFamily: headingFont }}>{statValue}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/80" style={{ fontFamily: bodyFont }}>{statLabel}</p>
      <p className="mt-1 text-[11px] text-white/60" style={{ fontFamily: bodyFont }}>{statDetail}</p>
    </div>
  </div>
);

const SODEXO_BENEFITS: BenefitCardProps[] = [
  {
    number: '#1 Dynamic cleaning that uses real-time information',
    title: 'Dynamic cleaning',
    description:
      'Instead of following fixed and potentially outdated schedules, dynamic cleaning uses live occupancy and usage data to adjust what needs to be cleaned, when and how. By aligning cleaning to space utilization, we are reducing the cost of delivery, ensuring consistency between sites and improving on-site responsiveness.',
    statValue: 'Dynamic cleaning saves $345k+',
    statLabel: 'Occupancy-driven cleaning deployment saved our global pharmaceutical client $345k+ last year.',
    statDetail: 'Without affecting the workplace experience.',
  },
  {
    number: '#2 Condition-based maintenance that extends asset life',
    title: 'Condition-based maintenance',
    description:
      "This approach triggers asset maintenance only when its condition indicates it's required. Relying on real-time monitoring, sensor data and diagnostics to detect early signs of deterioration, it is helping to deliver maintenance in the right place at the right moment.",
    statValue: 'Reducing downtime by 30%',
    statLabel: 'One of our global pharmaceutical clients reduced unplanned downtime and saved $375k+ last year.',
    statDetail: "By focusing maintenance exactly where it's needed.",
  },
  {
    number: '#3 Intelligent energy management that cuts cost and carbon',
    title: 'Intelligent energy management',
    description:
      'From effective energy policies to live consumption tracking, the right approach can meet sustainability and budget goals. Combining sensors with advanced analytics, our energy management services are reducing spend and lowering carbon footprints.',
    statValue: 'Reducing spend by +$200k',
    statLabel:
      "Our intelligent energy management services reduced our global pharmaceutical client's spend by $216,000 last year.",
    statDetail: 'By minimizing energy wastage and incentivizing reduced usage.',
  },
];

export const Sodexo = ({ fields, params, page }: BenefitHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <BenefitHighlightDefaultComponent />;

  return (
    <div className={cn('component benefit-highlight', styles)} id={RenderingIdentifier}>
      {/* ── Results overlay ── */}
      <section className="relative my-10 overflow-hidden" style={{ minHeight: '400px' }}>
        {(fields.FeatureImage?.value?.src || fields.BackgroundImage?.value?.src) ? (
          <ContentSdkImage
            field={fields.FeatureImage?.value?.src ? fields.FeatureImage : fields.BackgroundImage}
            fill
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1d1c47]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1d1c47]/90 via-[#1d1c47]/85 to-[#1d1c47]/70" />
        <div
          className="relative z-10 mx-auto flex max-w-4xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8"
          style={{ minHeight: '400px' }}
        >
          {(fields.Title?.value || isEditing) && (
            <Text
              field={fields.Title}
              tag="h2"
              className="max-w-lg text-3xl font-bold text-white sm:text-4xl"
              style={{ fontFamily: headingFont }}
            />
          )}
          {(fields.Description?.value || isEditing) && (
            <Text
              field={fields.Description}
              tag="p"
              className="mt-6 max-w-xl text-sm leading-relaxed text-white/80"
              style={{ fontFamily: bodyFont }}
            />
          )}
        </div>
      </section>

      {/* ── Numbered benefit cards ── */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {SODEXO_BENEFITS.slice(0, 2).map((b, i) => (
            <BenefitCard key={i} {...b} />
          ))}
        </div>
        <div className="mt-6">
          <BenefitCard {...SODEXO_BENEFITS[2]} />
        </div>
      </div>
    </div>
  );
};
