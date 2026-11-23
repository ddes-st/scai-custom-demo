---
name: sitecore-utilities
description: Compact support skill for Sitecore rendering-host scaffolding, local env setup, Auth0 authentication, header/navigation patterns, and Sitecore Cloud SDK custom/identity events. Use only when one of those support tasks is explicitly requested.
paths:
  - "**/.env*"
  - "**/auth0*.ts"
  - "**/middleware.ts"
  - "**/src/components/**/Header*.tsx"
  - "**/src/components/**/Navigation*.tsx"
---

# Sitecore Utilities

Use this skill only for explicit support tasks outside the main website-to-Sitecore capture flow.

## Supported tasks

- Rendering host scaffold/configuration.
- Local environment variables and developer settings.
- Auth0 login/register/profile integration.
- Header/navigation implementation patterns.
- Sitecore Cloud SDK custom events and identity events.

## Rules

- Do not trigger this skill during ordinary screenshot capture.
- Do not modify auth/env files unless the user asked for auth/env work.
- Keep generated files inside the current rendering host.
- Use references only when that task is requested.

## Reference locations

```txt
references/sitecore-auth0-authentication/
references/sitecore-env-local/
references/scaffold-rendering-host/
references/sitecore-cloudsdk-custom-events/
references/sitecore-cloudsdk-identity-events/
```
