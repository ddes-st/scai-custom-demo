# IDENTITY event patterns

## identifyVisitorByEmail

For newsletter, subscribe, or simple email login forms:

```typescript
import { identity } from '@sitecore-cloudsdk/events/browser';
import { ensureCloudSdkInitialized } from './cdp-cloud-sdk-init';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function identifyVisitorByEmail(
  email: string,
  siteName: string
): Promise<void> {
  const value = email.trim();
  if (!EMAIL_REGEX.test(value)) {
    throw new Error('Invalid email address');
  }

  const [localPart] = value.split('@');
  const [firstPart, ...rest] = localPart.split(/[._-]+/).filter(Boolean);
  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const firstName = capitalize(firstPart) || 'Subscriber';
  const lastName = rest.map(capitalize).join(' ');

  await ensureCloudSdkInitialized(siteName);
  await identity({
    channel: 'WEB',
    identifiers: [{ id: value, provider: 'email' }],
    email: value,
    firstName,
    lastName,
  });
}
```

Attach to form `onSubmit` after validation — not to container divs.

## identifyAuth0User

```typescript
import type { User } from '@auth0/nextjs-auth0/types';
import { identity } from '@sitecore-cloudsdk/events/browser';

const AUTH0_IDENTITY_SUB_KEY = '{project}-cdp-auth0-identity-sub';

export async function identifyAuth0User(
  user: User,
  siteName: string,
  profile: { email: string; firstName: string; lastName: string }
): Promise<boolean> {
  const sub = user.sub?.trim();
  if (!sub || sessionStorage.getItem(AUTH0_IDENTITY_SUB_KEY) === sub) {
    return false;
  }

  const email = profile.email.trim();
  if (!email) return false;

  const firstName = profile.firstName || 'Member';
  const lastName = profile.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();

  await ensureCloudSdkInitialized(siteName);
  await identity({
    channel: 'WEB',
    language: 'EN',
    identifiers: [
      { id: email, provider: 'email' },
      { id: fullName || sub, provider: 'auth0' },
    ],
    email,
    firstName,
    lastName,
    extensionData: { AuthenticationProvider: 'Auth0' },
  });

  sessionStorage.setItem(AUTH0_IDENTITY_SUB_KEY, sub);
  return true;
}

export function clearAuth0IdentityMarker(): void {
  sessionStorage.removeItem(AUTH0_IDENTITY_SUB_KEY);
}
```

## Auth0IdentityTracker component

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import config from 'sitecore.config';
import { identifyAuth0User, clearAuth0IdentityMarker } from '@/lib/cdp/cdp-identity';
import { isAuth0AuthenticatedUser } from '@/lib/auth0-user';
import { buildAccountProfile } from '@/lib/auth0-account';

export function Auth0IdentityTracker(): null {
  const { user, isLoading } = useUser();
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuth0AuthenticatedUser(user)) {
      clearAuth0IdentityMarker();
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const profile = buildAccountProfile(user);
    void identifyAuth0User(user, config.defaultSite, {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
      .catch(console.error)
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [user, isLoading]);

  return null;
}
```

Mount in `Providers.tsx` inside `Auth0Provider`.

## Providers wiring

```tsx
<Auth0Provider user={user ?? undefined} profileRoute="/api/{project}/profile">
  <Auth0IdentityTracker />
  <SitecoreProvider ...>{children}</SitecoreProvider>
</Auth0Provider>
```

## Finding events in SitecoreAI

1. DevTools → Application → Cookies → `sc_cid` value = browser ID
2. Or Network tab → events POST payload → `browser_id`
3. Use in SitecoreAI Performance / Profiles to verify identity resolution
