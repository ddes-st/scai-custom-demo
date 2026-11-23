# Cloud SDK browser initialization (App Router)

## Bootstrap component

Mount from root layout or page wrapper that receives Sitecore `page` props:

```tsx
'use client';

import { useEffect } from 'react';
import { CloudSDK } from '@sitecore-cloudsdk/core/browser';
import '@sitecore-cloudsdk/events/browser';
import config from 'sitecore.config';
import type { SitecorePageProps } from '@sitecore-content-sdk/nextjs';

export default function Bootstrap({ page }: Pick<SitecorePageProps, 'page'>) {
  useEffect(() => {
    if (!page) return;

    const { isNormal, isEditing, isPreview } = page.mode;
    const contextId = config.api.edge?.clientContextId;

    if (!contextId) {
      console.error('Client Edge API settings missing from configuration');
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('Cloud SDK events skipped in development');
      return;
    }

    if (!isNormal || isEditing || isPreview) {
      console.debug('Cloud SDK events skipped in edit/preview mode');
      return;
    }

    CloudSDK({
      sitecoreEdgeUrl: config.api.edge.edgeUrl,
      sitecoreEdgeContextId: contextId,
      siteName: page.siteName || config.defaultSite,
      enableBrowserCookie: true,
      cookieDomain: window.location.hostname.replace(/^www\./, ''),
    })
      .addEvents()
      .initialize();
  }, [page?.siteName, page?.mode]);

  return null;
}
```

Wire `<Bootstrap page={page} />` in the App Router catch-all page alongside `Providers`.

## Lazy init helper

Use when Bootstrap is not on every route or you need init before a one-off `identity()` call:

```typescript
import { CloudSDK } from '@sitecore-cloudsdk/core/browser';
import '@sitecore-cloudsdk/events/browser';
import config from 'sitecore.config';

let initPromise: Promise<void> | null = null;

export function ensureCloudSdkInitialized(siteName: string): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cloud SDK runs in the browser only'));
  }

  const contextId = config.api.edge?.clientContextId;
  if (!contextId) {
    return Promise.reject(new Error('Client Edge context ID missing'));
  }

  if (initPromise) return initPromise;

  initPromise = Promise.resolve().then(() => {
    CloudSDK({
      sitecoreEdgeUrl: config.api.edge.edgeUrl,
      sitecoreEdgeContextId: contextId,
      siteName: siteName || config.defaultSite,
      enableBrowserCookie: true,
      cookieDomain: window.location.hostname.replace(/^www\./, ''),
    })
      .addEvents()
      .initialize();
  });

  return initPromise;
}
```

## Required env vars

```
SITECORE_EDGE_CONTEXT_ID=
NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID=
NEXT_PUBLIC_SITECORE_EDGE_PLATFORM_HOSTNAME=
```

Values flow into `sitecore.config.ts` → `config.api.edge`.
