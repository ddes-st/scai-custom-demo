'use client';

import React, { JSX } from 'react';
import Image from 'next/image';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';

type SodexoArticleContentProps = ComponentProps & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: any;
};

const SodexoArticleContentDefaultComponent = (): JSX.Element => (
  <div className="component sodexo-article-content">
    <div className="component-content">
      <span className="is-empty-hint">SodexoArticleContent</span>
    </div>
  </div>
);

export const Default = ({ params }: SodexoArticleContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;
  return (
    <div className={cn('component sodexo-article-content', styles)} id={RenderingIdentifier}>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <p className="text-sm opacity-60">Article content will appear here.</p>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────
   Utility sub-components
   ──────────────────────────────────────────── */

const brandFg = 'var(--brand-fg, #2a295c)';
const brandAccent = 'var(--brand-accent, #da2020)';
const brandPrimary = 'var(--brand-primary, #283897)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="mb-4 text-2xl font-bold sm:text-3xl"
    style={{ color: brandFg, fontFamily: headingFont }}
  >
    {children}
  </h2>
);

const Paragraph = ({ children }: { children: React.ReactNode }) => (
  <p
    className="mb-4 text-base leading-relaxed opacity-80"
    style={{ color: brandFg, fontFamily: bodyFont }}
  >
    {children}
  </p>
);

/* ────────────────────────────────────────────
   Feature card for the numbered sections
   ──────────────────────────────────────────── */
interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  statValue: string;
  statLabel: string;
  statDetail: string;
}

const FeatureCard = ({ number, title, description, statValue, statLabel, statDetail }: FeatureCardProps) => (
  <div
    className="rounded-2xl p-8"
    style={{ backgroundColor: 'var(--brand-muted, #f0eef8)' }}
  >
    <p
      className="mb-2 text-sm font-bold"
      style={{ color: brandAccent, fontFamily: bodyFont }}
    >
      {number}
    </p>
    <h3
      className="mb-3 text-xl font-bold"
      style={{ color: brandFg, fontFamily: headingFont }}
    >
      {title}
    </h3>
    <p
      className="mb-6 text-sm leading-relaxed opacity-70"
      style={{ color: brandFg, fontFamily: bodyFont }}
    >
      {description}
    </p>
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: brandPrimary }}
    >
      <p className="text-lg font-bold text-white" style={{ fontFamily: headingFont }}>
        {statValue}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/80" style={{ fontFamily: bodyFont }}>
        {statLabel}
      </p>
      <p className="mt-1 text-[11px] text-white/60" style={{ fontFamily: bodyFont }}>
        {statDetail}
      </p>
    </div>
  </div>
);

/* ────────────────────────────────────────────
   Related article card for the "More about Sodexo" section
   ──────────────────────────────────────────── */
interface RelatedArticleProps {
  category: string;
  title: string;
  image: string;
  href: string;
}

const RelatedArticleCard = ({ category, title, image, href }: RelatedArticleProps) => (
  <a
    href={href}
    className="group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    style={{ borderColor: 'var(--brand-border, #e0dff0)' }}
  >
    <div className="p-4 pb-2">
      <span
        className="text-xs font-semibold"
        style={{ color: brandPrimary, fontFamily: bodyFont }}
      >
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
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={brandAccent} strokeWidth="2.5">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </div>
  </a>
);

const RELATED_ARTICLES: RelatedArticleProps[] = [
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

/* ────────────────────────────────────────────
   Sodexo — full article body matching
   sodexo.com/blog/…/insight-strategic-intelligence-centers
   ──────────────────────────────────────────── */
export const Sodexo = ({ params }: SodexoArticleContentProps): JSX.Element => {
  const { styles, RenderingIdentifier } = params;

  return (
    <div className={cn('component sodexo-article-content', styles)} id={RenderingIdentifier}>
      <article style={{ backgroundColor: 'var(--brand-bg, #ffffff)' }}>
        {/* ── Intro callout ── */}
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <p
            className="text-sm italic leading-relaxed opacity-60"
            style={{ color: brandFg, fontFamily: bodyFont }}
          >
            From reducing unplanned downtime by up to 30% to increasing asset life by as much as 40%, this model
            combines robust data and subject-matter expertise to make a real difference every day.
          </p>
        </div>

        {/* ── Data and insight model ── */}
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading>A data and insight model with transformative value</SectionHeading>
          <Paragraph>
            Operating out of three global hubs, our network of tactical command centers and strategic intelligence
            centers is elevating guest experiences and delivering results for our clients. Analyzing millions of data
            points daily, these complementary centers empower our teams to anticipate demand, isolate efficiencies and
            optimize the cost-to-comfort balance in the manufacturing workplace.
          </Paragraph>
          <Paragraph>
            We created this model to deliver real client benefits: consistent, scalable and high-performing services
            that adapt to ensure future readiness.
          </Paragraph>
        </div>

        {/* ── The Challenge ── */}
        <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 lg:px-8">
          <SectionHeading>The challenge: Converting insight into action at pace</SectionHeading>
          <Paragraph>
            To ensure smooth operations and retain top talent, manufacturers know the importance of creating seamless,
            efficient and human-centered workplaces. Yet our clients face a range of challenges, from market competition
            impacting their bottom line to evolving employee expectations, putting wellbeing under the spotlight.
          </Paragraph>
          <Paragraph>
            To help meet these challenges, we are providing our site teams with robust data, actionable insight and the
            right digital tools. The goal is to sustain dynamic, adaptive workplaces that control costs and elevate
            experiences. With new AI and analytics tools extending the art of the possible, we saw an opportunity to
            shift to a more predictive operating model; one that adds transformative value yet stays cost-effective by
            avoiding duplicated effort and keeping the focus on clients.
          </Paragraph>
          <Paragraph>
            So, we searched for a way to bring specialized skills and technologies to our experienced site teams while
            keeping them in control of operational performance 24/7.
          </Paragraph>
        </div>

        {/* ── The Solution ── */}
        <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6 lg:px-8">
          <SectionHeading>The solution: Two centers, one smart ecosystem</SectionHeading>
          <Paragraph>
            We created a model with two centers of excellence. Our <strong>command centers</strong> sit closer to client
            sites, using AI agents and bots to analyze ingested data and direct the rapid response that ensures seamless
            delivery. Our <strong>intelligence centers</strong> use this data to benchmark performance then provide
            insight and advice that enables local teams to deliver predictive and adaptive services. Together, these
            centers maintain tight cost control, improve workplace experiences and keep our clients ready for anything.
          </Paragraph>
        </div>

        {/* ── Solution image ── */}
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '320px' }}>
            <Image
              src="https://ddes.sitecoresandbox.cloud/api/public/content/106479-section6-img8?v=81b54824"
              alt="Intelligence center operations"
              fill
              sizes="(min-width: 768px) 80vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        {/* ── Numbered feature cards ── */}
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            <FeatureCard
              number="#1 Dynamic cleaning that uses real-time information"
              title="Dynamic cleaning"
              description="Instead of following fixed and potentially outdated schedules, dynamic cleaning uses live occupancy and usage data to adjust what needs to be cleaned, when and how. By aligning cleaning to space utilization, we are reducing the cost of delivery, ensuring consistency between sites and improving on-site responsiveness."
              statValue="Dynamic cleaning saves $345k+"
              statLabel="Occupancy-driven cleaning deployment saved our global pharmaceutical client $345k+ last year."
              statDetail="Without affecting the workplace experience."
            />
            <FeatureCard
              number="#2 Condition-based maintenance that extends asset life"
              title="Condition-based maintenance"
              description="This approach triggers asset maintenance only when its condition indicates it's required. Relying on real-time monitoring, sensor data and diagnostics to detect early signs of deterioration, it is helping to deliver maintenance in the right place at the right moment."
              statValue="Reducing downtime by 30%"
              statLabel="One of our global pharmaceutical clients reduced unplanned downtime and saved $375k+ last year."
              statDetail="By focusing maintenance exactly where it's needed."
            />
          </div>
          <div className="mt-6">
            <FeatureCard
              number="#3 Intelligent energy management that cuts cost and carbon"
              title="Intelligent energy management"
              description="From effective energy policies to live consumption tracking, the right approach can meet sustainability and budget goals. Combining sensors with advanced analytics, our energy management services are reducing spend and lowering carbon footprints."
              statValue="Reducing spend by +$200k"
              statLabel="Our intelligent energy management services reduced our global pharmaceutical client's spend by $216,000 last year."
              statDetail="By minimizing energy wastage and incentivizing reduced usage."
            />
          </div>
        </div>

        {/* ── Results section — dark overlay with image ── */}
        <div className="relative my-10 overflow-hidden" style={{ minHeight: '400px' }}>
          <Image
            src="https://ddes.sitecoresandbox.cloud/api/public/content/106470-section5-img7?v=70b49ab3"
            alt="Results"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1d1c47]/90 via-[#1d1c47]/85 to-[#1d1c47]/70" />
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8" style={{ minHeight: '400px' }}>
            <h2
              className="max-w-lg text-3xl font-bold text-white sm:text-4xl"
              style={{ fontFamily: headingFont }}
            >
              The results: Efficient{' '}
              <strong className="font-extrabold">demand-based and experience-led services</strong>
            </h2>
            <p
              className="mt-6 max-w-xl text-sm leading-relaxed text-white/80"
              style={{ fontFamily: bodyFont }}
            >
              By generating deep insight into cost-reduction priorities and outcome-boosting opportunities, our
              intelligence centers are already advising manufacturing sites on reducing maintenance costs, extending
              asset life and improving employee satisfaction. From data-driven cleaning to real-time energy management,
              these initiatives are delivering our clients significant savings and rapid service improvements.
            </p>
          </div>
        </div>

        {/* ── From reliable delivery ── */}
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <h2
                className="text-2xl font-bold sm:text-3xl"
                style={{ color: brandFg, fontFamily: headingFont }}
              >
                From reliable delivery to predictable outcomes
              </h2>
              <p
                className="mt-4 text-sm leading-relaxed opacity-70"
                style={{ color: brandFg, fontFamily: bodyFont }}
              >
                By providing continuous data insights to experienced site-based teams, our command and intelligence
                centers help to power exceptional manufacturing services and continuously improving client outcomes.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: '280px' }}>
              <Image
                src="https://ddes.sitecoresandbox.cloud/api/public/content/106449-section3-img5?v=409a0f3e"
                alt="From reliable delivery to predictable outcomes"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* ── More about Sodexo ── */}
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          <h2
            className="mb-8 text-center text-2xl font-bold"
            style={{ color: brandFg, fontFamily: headingFont }}
          >
            More about Sodexo
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {RELATED_ARTICLES.map((article, i) => (
              <RelatedArticleCard key={i} {...article} />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
};
