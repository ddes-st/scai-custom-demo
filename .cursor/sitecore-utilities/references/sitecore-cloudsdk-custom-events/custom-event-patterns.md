# Custom event patterns

## Event naming

Follow user-provided names. Recommended convention when user has no preference:

```
{siteKey}:{SCREAMING_SNAKE_ACTION}
```

Examples:

- `retail:ADDED_TO_WISHLIST`
- `portal:DOWNLOADED_WHITEPAPER`
- `travel:BOOKING_STARTED`

Document the catalog in a comment block at the top of the tracking lib file.

## Typed helper pattern

```typescript
import { event } from '@sitecore-cloudsdk/events/browser';
import config from 'sitecore.config';
import { ensureCloudSdkInitialized } from './cdp-cloud-sdk-init';

export const CDP_EVENT_REGISTER = 'mysite:EVENT_REGISTER';

type EventRegistrationPayload = {
  eventId: string;
  eventName: string;
};

async function sendCdpEvent(
  type: string,
  extensionData: Record<string, string>
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (process.env.NODE_ENV === 'development') return;

  const eventId = extensionData.eventId?.trim();
  const eventName = extensionData.eventName?.trim();
  if (!eventId || !eventName) return;

  await ensureCloudSdkInitialized(config.defaultSite);
  await event({
    type,
    channel: 'WEB',
    language: 'EN',
    page: window.location.pathname,
    extensionData: { eventId, eventName },
  });
}

export async function trackEventRegistration(
  payload: EventRegistrationPayload
): Promise<void> {
  await sendCdpEvent(CDP_EVENT_REGISTER, payload);
}
```

## Component integration

```tsx
'use client';

import { useSitecore } from '@sitecore-content-sdk/nextjs';
import { trackEventRegistration } from '@/lib/cdp/cdp-custom-events';

function RegisterButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const { page } = useSitecore();
  const { isEditing, isPreview } = page.mode;

  const onClick = () => {
    if (isEditing || isPreview) return;
    void trackEventRegistration({ eventId, eventName }).catch(console.debug);
    // ... business logic
  };

  return <button type="button" onClick={onClick}>Register</button>;
}
```

## Search analytics (different package)

Sitecore **search** result tracking in Content SDK uses `@sitecore-content-sdk/events` with `type: 'search'` — see [`search-experience`](../../sitecore-rendering-host-skills/search-experience/SKILL.md). Do not mix with Cloud SDK `event()` unless the user explicitly asks for both on the same action.

## Verification payload

Expected network POST fields (approximate):

- `type` — your custom event name
- `channel` — e.g. `WEB`
- `page` — pathname
- `extensionData` — custom key/value pairs
- `browser_id` — ties to `sc_cid` cookie
