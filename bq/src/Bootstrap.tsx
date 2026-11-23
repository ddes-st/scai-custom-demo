'use client';
import { useEffect, JSX } from 'react';
import { initContentSdk } from '@sitecore-content-sdk/nextjs';
import { eventsPlugin } from '@sitecore-content-sdk/events';
import { analyticsBrowserAdapter, analyticsPlugin } from '@sitecore-content-sdk/analytics-core';
import { areBrowserCdpEventsEnabled } from 'lib/cdp-events-enabled';
import config from 'sitecore.config';

/** Host-only cookies on localhost/IP — Domain=localhost is rejected by browsers. */
function resolveCookieDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return undefined;
  }
  return host.replace(/^www\./, '');
}

const Bootstrap = ({
  siteName,
  isPreviewMode,
}: {
  siteName: string;
  isPreviewMode: boolean;
}): JSX.Element | null => {
  useEffect(() => {
    if (!areBrowserCdpEventsEnabled(isPreviewMode)) {
      console.debug(
        'Browser Events SDK is not initialized (preview/edit, or NEXT_PUBLIC_CDP_EVENTS_ENABLED=false)',
      );
      return;
    }

    if (!config.api.edge?.clientContextId) {
      console.error('Client Edge API settings missing from configuration');
      return;
    }

    const cookieDomain = resolveCookieDomain();

    void initContentSdk({
      config: {
        contextId: config.api.edge.clientContextId,
        edgeUrl: config.api.edge.edgeUrl,
        siteName: siteName || config.defaultSite,
      },
      plugins: [
        analyticsPlugin({
          options: {
            enableCookie: true,
            ...(cookieDomain ? { cookieDomain } : {}),
          },
          adapter: analyticsBrowserAdapter(),
        }),
        eventsPlugin(),
      ],
    }).catch((error) => {
      console.warn('[Bootstrap] Content SDK Events init failed', error);
    });
  }, [siteName, isPreviewMode]);

  return null;
};

export default Bootstrap;
