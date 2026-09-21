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
   Sodexo — results banner + 3 numbered benefit cards
   Matches sodexo.com article: light banner, white cards,
   left column #1+#3 / right column #2
   ──────────────────────────────────────────── */

const brandFg = 'var(--brand-fg, #2a295c)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const FALLBACK_TITLE = 'The results: Efficient demand-based and experience-led services';
const FALLBACK_DESCRIPTION =
  'By generating deep insight into cost-reduction priorities and outcome-boosting opportunities, our intelligence centers are already advising manufacturing sites on reducing maintenance costs, extending asset life and improving employee satisfaction. From data-driven cleaning to real-time energy management, these initiatives are delivering our clients significant savings and rapid service improvements:';

interface BenefitCardProps {
  number: string;
  description: string;
  statValue: string;
  statDetail: string;
}

const BenefitCard = ({ number, description, statValue, statDetail }: BenefitCardProps) => (
  <article
    className="rounded-[10px] bg-white px-8 pb-10 pt-8 md:px-10"
    style={{ color: brandFg }}
  >
    <h3
      className="mb-4 text-[22px] font-normal leading-snug md:text-[30px] md:leading-[1.25]"
      style={{ color: brandFg, fontFamily: headingFont }}
    >
      {number}
    </h3>
    <p
      className="mb-4 text-base font-bold leading-7"
      style={{ color: brandFg, fontFamily: bodyFont }}
    >
      {description}
    </p>
    <div className="text-base leading-7" style={{ fontFamily: bodyFont }}>
      {statValue}
    </div>
    <p className="mt-4 text-base leading-7" style={{ fontFamily: bodyFont }}>
      {statDetail}
    </p>
  </article>
);

const SODEXO_BENEFITS: BenefitCardProps[] = [
  {
    number: '#1 Dynamic cleaning that uses real-time information',
    description:
      'Instead of following fixed and potentially outdated schedules, dynamic cleaning uses live occupancy and usage data to adjust what needs to be cleaned, when and how. By aligning cleaning to space utilization, we are reducing the cost of delivery, ensuring consistency between sites and improving on-site responsiveness to keeping spaces spotless.',
    statValue: 'Dynamic cleaning saves $345k+',
    statDetail:
      'Occupancy-driven cleaning deployment saved our global pharmaceutical client $345k+ last year without affecting the workplace experience.',
  },
  {
    number: '#2 Condition-based maintenance that extends asset life',
    description:
      'This approach triggers asset maintenance only when its condition indicates it’s required. Relying on real-time monitoring, sensor data and diagnostics to detect early signs of deterioration, it is helping to deliver maintenance in the right place at the right moment, reducing asset downtime and reducing the cost for our clients.',
    statValue: 'Reducing downtime by 30%',
    statDetail:
      'By focusing maintenance exactly where it’s needed, one of our global pharmaceutical clients reduced their unplanned downtime and saved $375k+ last year.',
  },
  {
    number: '#3 Intelligent energy management that cuts cost and carbon',
    description:
      'From effective energy policies to live consumption tracking, the right approach can meet sustainability and budget goals. Combining sensors with advanced analytics, our energy management services are reducing spend and lowering carbon footprints.',
    statValue: 'Reducing spend by +$200k',
    statDetail:
      'By minimizing energy wastage and incentivizing reduced usage, our intelligent energy management services reduced our global pharmaceutical clients spend by $216,000 last year.',
  },
];

export const Sodexo = ({ fields, params }: BenefitHighlightProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  if (!fields) return <BenefitHighlightDefaultComponent />;

  const titleField: Field<string> = {
    ...(fields.Title || { value: '' }),
    value: fields.Title?.value || FALLBACK_TITLE,
  };
  const descriptionField: Field<string> = {
    ...(fields.Description || { value: '' }),
    value: fields.Description?.value || FALLBACK_DESCRIPTION,
  };

  const titleClassName =
    'max-w-md text-[28px] font-bold leading-tight sm:text-[38px] sm:leading-[1.15]';
  const descriptionClassName = 'mt-6 max-w-3xl text-base leading-7';
  const textStyle = { color: brandFg, fontFamily: headingFont };
  const bodyStyle = { color: brandFg, fontFamily: bodyFont };

  return (
    <div className={cn('component benefit-highlight', styles)} id={RenderingIdentifier}>
      <section style={{ backgroundColor: 'var(--brand-muted, #e7e9f7)' }}>
        <div className="mx-auto max-w-6xl px-6 py-10 md:px-16 md:py-12 lg:px-24">
          <Text field={titleField} tag="h2" className={titleClassName} style={textStyle} />
          <Text
            field={descriptionField}
            tag="p"
            className={descriptionClassName}
            style={bodyStyle}
          />
        </div>

        <div className="mx-auto max-w-6xl px-6 pb-16 md:px-16 lg:px-24">
          <div className="grid gap-8 md:grid-cols-2 md:gap-x-[80px] lg:gap-x-[122px]">
            <div className="flex flex-col gap-[60px]">
              <BenefitCard {...SODEXO_BENEFITS[0]} />
              <BenefitCard {...SODEXO_BENEFITS[2]} />
            </div>
            <div>
              <BenefitCard {...SODEXO_BENEFITS[1]} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
