# Sitecore Deploy portal — Developer settings

## Where to find values

1. Open **Sitecore Deploy portal** (Sitecore Cloud / XM Cloud Deploy).
2. Select your **project**.
3. Select the target **environment** (e.g. `production`, `dev`, `staging`).
4. Open the **Developer settings** tab.

This tab exposes connection values for local editing hosts and Content SDK apps.

## Map portal → `.env.local`

| Developer settings (typical label) | Environment variable | Notes |
|-----------------------------------|----------------------|-------|
| Edge Context ID | `SITECORE_EDGE_CONTEXT_ID` | Server-side Edge requests |
| Edge Context ID | `NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID` | **Same value** — client-side fallback |
| Site name | `NEXT_PUBLIC_DEFAULT_SITE_NAME` | Matches Sitecore site item name (e.g. `jm-demo-creation-site`) |
| Editing secret | `SITECORE_EDITING_SECRET` | Secures `/api/editing/render`; must match portal |

### Deriving site name from Sitecore path

When the user gives site path `/sitecore/content/{collection}/{sitename}`:

```
NEXT_PUBLIC_DEFAULT_SITE_NAME={sitename}
```

Example: `/sitecore/content/johnson-matthey-demo-creation-test/jm-demo-creation-site` → `jm-demo-creation-site`.

## Optional (same tab or related portal sections)

| Variable | Typical source |
|----------|----------------|
| `SITECORE_RENDERINGHOST_NAME` | Rendering host key in Deploy / `xmcloud.build.json` |
| `SITECORE_AUTH_CLIENT_ID` | Design Library / Cloud OAuth client |
| `SITECORE_AUTH_CLIENT_SECRET` | Design Library client secret |
| `SITECORE_AUTHORING_GRAPHQL_URL` | Environment CM URL + `/sitecore/api/authoring/graphql/v1` |
| `SITECORE_AUTH_TOKEN_URL` | `https://auth.sitecorecloud.io/oauth/token` |
| `SITECORE_AUTH_AUDIENCE` | `https://api.sitecorecloud.io` |
| `NEXT_PUBLIC_PERSONALIZE_SCOPE` | Personalize scope for the environment |

## User input formats

Accept any of:

1. **Key=value block** (paste from portal or chat)
2. **Individual values** in conversation
3. **Screenshot** of Developer settings — extract the four required keys

Always duplicate Edge Context ID to both `SITECORE_EDGE_CONTEXT_ID` and `NEXT_PUBLIC_SITECORE_EDGE_CONTEXT_ID`.

## Security

- Treat **Editing secret** and OAuth secrets as confidential.
- Store only in `.env.local` (gitignored).
- Do not commit to repository or include in serialized YAML.
