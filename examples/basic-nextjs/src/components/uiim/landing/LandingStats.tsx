import React, { JSX } from 'react';
import { Field, Text } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingStatsRouteFields {
  stat1Number?: Field<string>;
  stat1Label?: Field<string>;
  stat2Number?: Field<string>;
  stat2Label?: Field<string>;
  stat3Number?: Field<string>;
  stat3Label?: Field<string>;
}

const brandFg = 'var(--brand-fg, #2a295c)';
const brandMuted = 'var(--brand-muted, #f0eef8)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const LandingStatsDefaultComponent = (): JSX.Element => (
  <div className="component landing-stats">
    <div className="component-content">
      <span className="is-empty-hint">LandingStats</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingStatsRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingStatsRouteFields) : null;
}

function StatTile({
  number,
  label,
  isEditing,
}: {
  number?: Field<string>;
  label?: Field<string>;
  isEditing?: boolean;
}) {
  if (!number?.value && !label?.value && !isEditing) return null;
  return (
    <div className="text-center" data-testid="stat-tile">
      {(number?.value || isEditing) && (
        <Text
          field={number}
          tag="p"
          className="text-5xl font-bold tracking-tight md:text-6xl"
          style={{ color: brandFg, fontFamily: headingFont }}
          data-testid="stat-number"
        />
      )}
      {(label?.value || isEditing) && (
        <Text
          field={label}
          tag="p"
          className="mt-2 text-sm font-medium uppercase tracking-wider"
          style={{ color: brandFg, fontFamily: bodyFont }}
          data-testid="stat-label"
        />
      )}
    </div>
  );
}

function LandingStatsBranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingStatsDefaultComponent />;

  return (
    <div
      className={cn('component landing-stats [&_a]:cursor-pointer [&_button]:cursor-pointer', styles)}
      id={RenderingIdentifier}
    >
      <section className="py-16 md:py-20" style={{ backgroundColor: brandMuted }} data-testid="landing-stats">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-12 md:grid-cols-3">
            <StatTile
              number={routeFields.stat1Number}
              label={routeFields.stat1Label}
              isEditing={isEditing}
            />
            <StatTile
              number={routeFields.stat2Number}
              label={routeFields.stat2Label}
              isEditing={isEditing}
            />
            <StatTile
              number={routeFields.stat3Number}
              label={routeFields.stat3Label}
              isEditing={isEditing}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export const Default = (props: ComponentProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);
  return <LandingStatsBranded {...props} />;
};

export const Sodexo = (props: ComponentProps): JSX.Element => <LandingStatsBranded {...props} />;
