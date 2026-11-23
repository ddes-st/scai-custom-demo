# Auth0 environment variables

Add to `.env.local` and document in `.env.remote.example` (never commit real values).

**Official setup guide:** [Auth0 Next.js quickstart](https://auth0.com/docs/quickstart/webapp/nextjs) — SDK install, `.env.local` keys, callback/logout URLs, `proxy.ts`, troubleshooting.

**Sitecore editing host:** use [`sitecore-env-local`](../sitecore-env-local/SKILL.md) to write the Auth0 block alongside Sitecore Developer settings vars.

## Required — session (Regular Web Application)

| Variable | Description |
|----------|-------------|
| `AUTH0_SECRET` | 32+ byte secret for cookie encryption (`openssl rand -hex 32`) |
| `AUTH0_DOMAIN` | Tenant domain, e.g. `your-tenant.eu.auth0.com` (no `https://`) |
| `AUTH0_CLIENT_ID` | Regular Web Application client ID |
| `AUTH0_CLIENT_SECRET` | Regular Web Application client secret |
| `APP_BASE_URL` | Public site URL, e.g. `http://localhost:3000` — used for callback/logout and `returnTo` |

`@auth0/nextjs-auth0` v4 also accepts `AUTH0_BASE_URL` as an alias for app URL.

## Required — register and profile (Management API)

| Variable | Description |
|----------|-------------|
| `AUTH0_MGMT_CLIENT_ID` | M2M application client ID (falls back to `AUTH0_CLIENT_ID` if unset) |
| `AUTH0_MGMT_CLIENT_SECRET` | M2M client secret (falls back to `AUTH0_CLIENT_SECRET` if unset) |

Scopes on the M2M app: `create:users`, `read:users`, `update:users`, optionally `read:roles`.

## Optional — database connection

| Variable | Default |
|----------|---------|
| `AUTH0_DB_CONNECTION` | `Username-Password-Authentication` |
| `AUTH0_CONNECTION` | Same fallback alias |

## Optional — custom claims

| Variable | Description |
|----------|-------------|
| `AUTH0_CLAIM_NAMESPACE` | Must match Post-Login Action `namespace` exactly (no trailing slash) |
| `NEXT_PUBLIC_AUTH0_CLAIM_NAMESPACE` | Client-side claim reads when needed |

Example namespace: `https://your-tenant.eu.auth0.com` or `https://www.example.com`.

## Optional — development / debugging

| Variable | Description |
|----------|-------------|
| `AUTH0_INSECURE_TLS` | `true` in dev only if corporate SSL inspection breaks Auth0 fetch |
| `NODE_EXTRA_CA_CERTS` | Path to org root CA (preferred over insecure TLS) |
| `AUTH0_DEBUG_CLAIMS` | Log claims on server |
| `NEXT_PUBLIC_AUTH0_DEBUG_CLAIMS` | Log claims in browser on profile page |

## Auth0 Dashboard checklist

Copy into PR or setup notes:

```
Allowed Callback URLs:  {APP_BASE_URL}/auth/callback
Allowed Logout URLs:    {APP_BASE_URL}
Allowed Web Origins:    {APP_BASE_URL}   (if using Auth0.js / SPA patterns)
```

For production, add every deployment URL (preview, staging, production).
