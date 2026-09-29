'use client';

import React, { JSX, useEffect, useState } from 'react';
import { Field, LinkField, Text } from '@sitecore-content-sdk/nextjs';
import { ComponentProps } from 'lib/component-props';
import { cn } from '@/lib/utils';
import { isSodexoSite } from '@/lib/sodexo-page';

export const GROUP_SITE_NAVIGATOR_DISMISS_KEY = 'sodexo.groupSiteNavigator.dismissed';

export const GROUP_SITE_NAVIGATOR_COPY = {
  message:
    "You're visiting our Group website. To see content specific to your location, choose a country or region:",
  regionLabel: 'France',
  continueLabel: 'Continue',
};

interface GroupSiteNavigatorBannerFields {
  Message?: Field<string>;
  RegionLabel?: Field<string>;
  ContinueLabel?: Field<string>;
  ContinueLink?: LinkField;
}

type GroupSiteNavigatorBannerProps = ComponentProps & {
  fields: GroupSiteNavigatorBannerFields;
};

const GroupSiteNavigatorBannerDefaultComponent = (): JSX.Element => (
  <div className="component group-site-navigator-banner">
    <div className="component-content">
      <span className="is-empty-hint">GroupSiteNavigatorBanner</span>
    </div>
  </div>
);

export const SodexoGroupSiteNavigatorBar = ({
  message,
  regionLabel,
  continueLabel,
  continueHref,
  isEditing,
  styles,
  renderingId,
}: {
  message: string;
  regionLabel: string;
  continueLabel: string;
  continueHref?: string;
  isEditing?: boolean;
  styles?: string;
  renderingId?: string;
}): JSX.Element | null => {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setVisible(true);
      setReady(true);
      return;
    }
    setVisible(window.sessionStorage.getItem(GROUP_SITE_NAVIGATOR_DISMISS_KEY) !== '1');
    setReady(true);
  }, [isEditing]);

  const dismiss = () => {
    window.sessionStorage.setItem(GROUP_SITE_NAVIGATOR_DISMISS_KEY, '1');
    setVisible(false);
  };

  const handleContinue = () => {
    if (!continueHref) return;
    window.open(continueHref, '_blank', 'noopener,noreferrer');
  };

  if (!ready || (!visible && !isEditing)) return null;

  return (
    <div className={cn('component group-site-navigator-banner', styles)} id={renderingId}>
      <div
        className="w-full"
        style={{
          backgroundColor: 'var(--brand-muted, #f0eef8)',
          color: 'var(--brand-fg, #2a295c)',
          fontFamily: 'var(--brand-body-font, "Open Sans", sans-serif)',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <p className="max-w-3xl text-sm leading-6">{message}</p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="flex h-10 min-w-[7.5rem] items-center justify-between rounded-full border bg-white px-4 text-sm"
              style={{
                borderColor: 'var(--brand-border, #d8d6e8)',
                color: 'var(--brand-fg, #2a295c)',
              }}
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-label={regionLabel}
            >
              <span>{regionLabel}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-fg, #2a295c)' }}
            >
              {continueLabel}
              <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close group site navigator"
              className="flex h-8 w-8 items-center justify-center transition-opacity hover:opacity-70"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Sodexo = (props: GroupSiteNavigatorBannerProps): JSX.Element => {
  const { fields, params, page } = props;
  const isEditing = page?.mode?.isEditing;
  if (!fields && !isEditing) return <GroupSiteNavigatorBannerDefaultComponent />;

  return (
    <SodexoGroupSiteNavigatorBar
      message={fields?.Message?.value || GROUP_SITE_NAVIGATOR_COPY.message}
      regionLabel={fields?.RegionLabel?.value || GROUP_SITE_NAVIGATOR_COPY.regionLabel}
      continueLabel={fields?.ContinueLabel?.value || GROUP_SITE_NAVIGATOR_COPY.continueLabel}
      continueHref={fields?.ContinueLink?.value?.href}
      isEditing={isEditing}
      styles={params?.styles}
      renderingId={params?.RenderingIdentifier}
    />
  );
};

export const Default = (props: GroupSiteNavigatorBannerProps): JSX.Element => {
  if (isSodexoSite(props.page)) return Sodexo(props);

  const { fields, params, page } = props;
  const isEditing = page?.mode?.isEditing;
  if (!fields) return <GroupSiteNavigatorBannerDefaultComponent />;

  return (
    <div className={cn('component group-site-navigator-banner', params.styles)} id={params.RenderingIdentifier}>
      <div className="w-full bg-[var(--brand-muted,#f5f5f5)] px-4 py-2 text-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {(fields.Message?.value || isEditing) && <Text field={fields.Message} tag="p" />}
          {(fields.ContinueLabel?.value || isEditing) && <Text field={fields.ContinueLabel} tag="span" />}
        </div>
      </div>
    </div>
  );
};
