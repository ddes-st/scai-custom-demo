# `.env.local` template — Content SDK 2.x editing host

Base structure. Copy from `{app}/.env.remote.example` in the scaffolded app. **All values must come from the user** (Deploy portal Developer settings) — do not copy from other apps or skill docs.

## Required — Sitecore (Developer settings)

Ask the user to paste from **Sitecore Deploy portal → Environment → Developer settings**:

```env
SITECORE_EDGE_CONTEXT_ID=
NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID=

NEXT_PUBLIC_DEFAULT_SITE_NAME=

SITECORE_EDITING_SECRET=
```

`SITECORE_EDGE_CONTEXT_ID` and `NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID` must be the **same** value.

## Optional — Sitecore

```env
NEXT_PUBLIC_DEFAULT_LANGUAGE=

NEXT_PUBLIC_SITECORE_EDGE_PLATFORM_HOSTNAME=
SITECORE_EXPERIENCE_EDGE_HOSTNAME=

NEXT_PUBLIC_PERSONALIZE_SCOPE=
PERSONALIZE_MIDDLEWARE_CDP_TIMEOUT=
PERSONALIZE_MIDDLEWARE_EDGE_TIMEOUT=

# Design Library (when provided in portal)
SITECORE_AUTH_CLIENT_ID=
SITECORE_AUTH_CLIENT_SECRET=
SITECORE_RENDERINGHOST_NAME=
SITECORE_AUTHORING_GRAPHQL_URL=
SITECORE_AUTH_TOKEN_URL=https://auth.sitecorecloud.io/oauth/token
SITECORE_AUTH_AUDIENCE=https://api.sitecorecloud.io
```

## Optional — Auth0 (when login detected)

See [`sitecore-auth0-authentication` env-vars](../../sitecore-auth0-authentication/references/env-vars.md) and [Auth0 Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs). Ask user for all Auth0 values — never assume.

```env
AUTH0_SECRET=
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_MGMT_CLIENT_ID=
AUTH0_MGMT_CLIENT_SECRET=
```

## Merge rules

When `.env.local` already exists:

1. Update only keys the user provided.
2. Do not remove unrelated sections (e.g. `DEBUG`, third-party API keys).
3. Add missing Auth0 block at end of file when auth is enabled.
