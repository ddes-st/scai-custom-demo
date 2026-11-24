'use client';
import { CdpHelper, useSitecore } from '@sitecore-content-sdk/nextjs';
import { useEffect, JSX } from 'react';
import { pageView } from '@sitecore-content-sdk/events';
import { areBrowserCdpEventsEnabled } from 'lib/cdp-events-enabled';
import { seedCustomerProfile } from 'lib/tracking/unified-data-layer';
import config from 'sitecore.config';

/**
 * This is the CDP page view component.
 * See Sitecore Content SDK documentation for details.
 * https://www.npmjs.com/package/@sitecore-content-sdk/events
 */
const CdpPageView = (): JSX.Element => {
  const {
    page: { layout, siteName, mode },
  } = useSitecore();
  const { route, context } = layout.sitecore;

  /**
   * Determines if the page view events should be turned off.
   * IMPORTANT: Prefer wiring this to your cookie consent solution.
   * Default: on; set NEXT_PUBLIC_CDP_EVENTS_ENABLED=false to disable.
   */
  const disabled = () => !areBrowserCdpEventsEnabled(false);

  useEffect(() => {
    // Do not create events in editing or preview mode or if missing route data
    if (!mode.isNormal || !route?.itemId) {
      return;
    }
    // Do not create events if disabled (e.g. we don't have consent)
    if (disabled()) {
      return;
    }

    const language = route.itemLanguage || config.defaultLanguage;
    const scope = config.personalize?.scope;

    const pageVariantId = CdpHelper.getPageVariantId(
      route.itemId,
      language,
      context.variantId as string,
      scope
    );
    // there can be cases where Events are not initialized which are expected to reject
    pageView({
      channel: 'WEB',
      currency: 'USD',
      page: route.name,
      pageVariantId,
      language,
    }).catch((e) => console.debug(e));
    seedCustomerProfile();
  }, [mode, route, context.variantId, siteName]);

  return <></>;
};

export default CdpPageView;
