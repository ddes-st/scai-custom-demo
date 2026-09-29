import React, { JSX } from 'react';
import * as LucideIcons from 'lucide-react';
import { Sparkles } from 'lucide-react';
import {
  Field,
  RichTextField,
  Text,
  RichText as ContentSdkRichText,
} from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

interface LandingFeaturesRouteFields {
  feature1IconName?: Field<string>;
  feature1Title?: Field<string>;
  feature1Description?: RichTextField;
  feature2IconName?: Field<string>;
  feature2Title?: Field<string>;
  feature2Description?: RichTextField;
  feature3IconName?: Field<string>;
  feature3Title?: Field<string>;
  feature3Description?: RichTextField;
}

const brandFg = 'var(--brand-fg, #2a295c)';
const brandPrimary = 'var(--brand-primary, #283897)';
const brandMuted = 'var(--brand-muted, #f0eef8)';
const brandBorder = 'var(--brand-border, #e0dff0)';
const headingFont = 'var(--brand-heading-font, "DM Sans", sans-serif)';
const bodyFont = 'var(--brand-body-font, "Open Sans", sans-serif)';

const LandingFeaturesDefaultComponent = (): JSX.Element => (
  <div className="component landing-features">
    <div className="component-content">
      <span className="is-empty-hint">LandingFeatures</span>
    </div>
  </div>
);

function getRouteFields(page: ComponentProps['page']): LandingFeaturesRouteFields | null {
  const fields = page?.layout?.sitecore?.route?.fields;
  return fields ? (fields as unknown as LandingFeaturesRouteFields) : null;
}

function FeatureCard({
  iconName,
  title,
  description,
  isEditing,
}: {
  iconName?: Field<string>;
  title?: Field<string>;
  description?: RichTextField;
  isEditing?: boolean;
}) {
  const iconKey = iconName?.value;
  const hasContent = iconKey || title?.value || description?.value;
  if (!hasContent && !isEditing) return null;

  const Icon =
    iconKey && (LucideIcons as Record<string, unknown>)[iconKey]
      ? ((LucideIcons as unknown) as Record<string, React.ComponentType<{ className?: string }>>)[
          iconKey
        ]
      : Sparkles;

  return (
    <div
      className="flex flex-col items-start border bg-white p-8"
      style={{ borderColor: brandBorder, borderRadius: 'var(--brand-card-radius, 0px)' }}
      data-testid="feature-card"
    >
      <div
        className="mb-4 inline-flex h-10 w-10 items-center justify-center"
        style={{ color: brandPrimary }}
      >
        <Icon className="h-6 w-6" />
      </div>
      {(title?.value || isEditing) && (
        <Text
          field={title}
          tag="h3"
          className="text-lg font-semibold"
          style={{ color: brandFg, fontFamily: headingFont }}
          data-testid="feature-title"
        />
      )}
      {(description?.value || isEditing) && (
        <div
          className="mt-2 text-sm leading-relaxed"
          style={{ color: brandFg, fontFamily: bodyFont }}
          data-testid="feature-description"
        >
          <ContentSdkRichText field={description} />
        </div>
      )}
    </div>
  );
}

function LandingFeaturesBranded({ params, page }: ComponentProps): JSX.Element {
  const { styles, RenderingIdentifier } = params;
  const isEditing = page?.mode?.isEditing;
  const routeFields = getRouteFields(page);
  if (!routeFields) return <LandingFeaturesDefaultComponent />;

  return (
    <div
      className={cn('component landing-features [&_a]:cursor-pointer [&_button]:cursor-pointer', styles)}
      id={RenderingIdentifier}
    >
      <section className="py-16 md:py-24" style={{ backgroundColor: brandMuted }} data-testid="landing-features">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              iconName={routeFields.feature1IconName}
              title={routeFields.feature1Title}
              description={routeFields.feature1Description}
              isEditing={isEditing}
            />
            <FeatureCard
              iconName={routeFields.feature2IconName}
              title={routeFields.feature2Title}
              description={routeFields.feature2Description}
              isEditing={isEditing}
            />
            <FeatureCard
              iconName={routeFields.feature3IconName}
              title={routeFields.feature3Title}
              description={routeFields.feature3Description}
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
  return <LandingFeaturesBranded {...props} />;
};

export const Sodexo = (props: ComponentProps): JSX.Element => <LandingFeaturesBranded {...props} />;
