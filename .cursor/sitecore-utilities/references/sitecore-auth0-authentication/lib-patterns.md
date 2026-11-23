# Auth0 lib patterns (Sitecore Content SDK)

Generic templates — replace `{project}` with the app namespace (camelCase file names).

---

## auth0.ts

```typescript
import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { enrichAuth0SessionUser } from './auth0-enrich-user';

export const auth0 = new Auth0Client({
  allowInsecureRequests: process.env.NODE_ENV === 'development',
  async beforeSessionSaved(session, idToken) {
    return enrichAuth0SessionUser(session, idToken);
  },
});
```

Omit `beforeSessionSaved` for minimal setups without custom claims.

---

## auth0-user.ts

```typescript
import type { User } from '@auth0/nextjs-auth0/types';

export function isAuth0AuthenticatedUser(user: User | null | undefined): user is User {
  return Boolean(typeof user?.sub === 'string' && user.sub.trim());
}
```

---

## auth0-profile.ts

```typescript
import type { User } from '@auth0/nextjs-auth0/types';

function resolveAuth0Namespace(): string {
  const raw =
    process.env.AUTH0_CLAIM_NAMESPACE ||
    process.env.NEXT_PUBLIC_AUTH0_CLAIM_NAMESPACE ||
    `https://${process.env.AUTH0_DOMAIN}`;
  return raw.replace(/\/+$/, '');
}

export const AUTH0_NAMESPACE = resolveAuth0Namespace();
export const AUTH0_ROLES_CLAIM = `${AUTH0_NAMESPACE}/roles`;

function resolveAuthBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return (
    process.env.APP_BASE_URL?.split(',')[0]?.trim() ||
    process.env.AUTH0_BASE_URL?.split(',')[0]?.trim() ||
    'http://localhost:3000'
  );
}

export function buildLoginUrl(returnTo: string): string {
  const base = resolveAuthBaseUrl();
  const absolute = returnTo.startsWith('http') ? returnTo : new URL(returnTo, base).toString();
  return `/auth/login?${new URLSearchParams({ returnTo: absolute }).toString()}`;
}

export function buildLogoutUrl(returnTo = '/'): string {
  const base = resolveAuthBaseUrl();
  const absolute = returnTo.startsWith('http') ? returnTo : new URL(returnTo, base).toString();
  return `/auth/logout?${new URLSearchParams({ returnTo: absolute }).toString()}`;
}

export function getAuth0Roles(user: User | undefined): string[] {
  const claim = user?.[AUTH0_ROLES_CLAIM];
  return Array.isArray(claim) ? claim.map(String) : [];
}
```

---

## auth0-session.ts

```typescript
import { auth0 } from './auth0';
import { enrichAuth0SessionUser } from './auth0-enrich-user';
import { isAuth0AuthenticatedUser } from './auth0-user';

export { isAuth0AuthenticatedUser };

export async function getAuth0Session() {
  const session = await auth0.getSession();
  if (!session || !isAuth0AuthenticatedUser(session.user)) return null;
  return enrichAuth0SessionUser(session, session.tokenSet.idToken ?? null);
}
```

---

## profile-nav.ts (client hook)

```typescript
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import { buildLoginUrl } from '@/lib/auth0-profile';
import { isAuth0AuthenticatedUser } from '@/lib/auth0-user';

export function useProfileNavigation(profilePath = '/profile') {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const openProfile = useCallback(() => {
    if (isLoading) return;
    if (!isAuth0AuthenticatedUser(user)) {
      window.location.assign(buildLoginUrl(profilePath));
      return;
    }
    router.push(profilePath);
  }, [isLoading, profilePath, router, user]);

  return {
    isLoading,
    user: isAuth0AuthenticatedUser(user) ? user : null,
    openProfile,
    logoutUrl: '/auth/logout',
  };
}
```

---

## Proxy integration

In `src/proxy.ts` (Sitecore Content SDK pattern):

```typescript
import { auth0 } from './lib/auth0';

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!shouldRunAuth0Middleware(req)) {
    return runSitecoreProxy(req, event);
  }
  return auth0.middleware(req);
}
```

`shouldRunAuth0Middleware`: true only for `pathname.startsWith('/auth')`, false for Pages editor requests.

---

## Page.tsx — pass session to provider

```typescript
const session = await getAuth0Session();

return (
  <Providers page={page} user={session?.user ?? undefined}>
    <Layout page={page} />
  </Providers>
);
```

---

## Register API (minimal)

```typescript
// POST src/app/api/{project}/register/route.ts
const result = await createAuth0User(domain, {
  email,
  password,
  given_name: firstName,
  family_name: lastName,
  name: `${firstName} ${lastName}`.trim(),
  user_metadata: { /* Phase 0 schema */ },
});
```

Return `{ ok: true }` or `{ error: message }` with appropriate status.

---

## Profile API (minimal)

```typescript
// GET — return session.user (401 if no session)
// PATCH — patchAuth0ManagementUser(domain, user.sub, { given_name, user_metadata })
```

After PATCH, client should call `useUser()` refresh (handled when `profileRoute` is set on `Auth0Provider`).

---

## Auth0IdentityTracker

Required after Auth0 login — see [`sitecore-cloudsdk-identity-events`](../../../sitecore-cloud-sdk-skills/sitecore-cloudsdk-identity-events/references/identity-patterns.md).

---

## auth0-enrich-user.ts (optional)

When Post-Login Actions or Management API supply roles/metadata not fully present on the session user:

1. Decode ID token claims (`jose` `decodeJwt`).
2. Optionally fetch Management API user (cache ~60s).
3. Merge `roles`, namespaced claims, and `user_metadata` onto `session.user`.
4. Return updated `SessionData`.

Keep enrichment idempotent and avoid Management API on every request when token claims suffice.
