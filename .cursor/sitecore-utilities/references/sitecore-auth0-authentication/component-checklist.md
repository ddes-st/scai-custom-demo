# Auth0 UI component checklist

When Login appears in a design, implement **all** rows marked Required.

---

## Components

| Component | Required | Sitecore type | Notes |
|-----------|----------|---------------|-------|
| `{Name}RegisterSection` | Yes | Section | Form → POST register API |
| `{Name}ProfileSection` | Yes | Section | `/profile` page; GET/PATCH profile API |
| `{Name}LoginSection` | If design shows login page | Section | Links to `/auth/login?returnTo=` |
| `Header` (auth variant) | Yes | Header | Logged-in vs logged-out UI |
| `{Name}ProfileMenu` | Optional | — | Dropdown portal for profile/logout |

Reuse shared form atoms: text input, select, toggle, submit button — one `{Name}ProfileUi.tsx` module.

---

## Header fields (Sitecore)

| Field | Type | Default |
|-------|------|---------|
| `Logo` | Image | from design |
| `LoginLink` | General Link | `/auth/login`, text "Login" |
| `RegisterLink` | General Link | `/register`, text "Join" or "Register" |
| `ProfileLink` | General Link | `/profile`, text "Profile" (used as fallback label) |

Header TSX behavior:

- **Logged out:** render `LoginLink`, `RegisterLink` (if in design)
- **Logged in:** hide Login/Register; show avatar + `resolveDisplayName(user)`; click → `openProfile()`
- **Editing mode:** show logged-out preview (design default)

---

## Register section fields (typical B2B)

| Field | Type | Maps to |
|-------|------|---------|
| `Title`, `Description` | Text | Hero copy |
| `FirstNameLabel`, … | Text | Form labels |
| `SectorOptions`, `TopicOptions` | Multi-Line Text | One option per line → select/chips |
| `TermsLink`, `PrivacyLink` | General Link | Legal |
| `SubmitButtonText` | Text | CTA |
| `LoginLink` | General Link | "Already have an account?" |

Form state → register API body → `user_metadata` per Phase 0 schema.

---

## Profile section fields

| Field | Type | Use |
|-------|------|-----|
| `Title`, tab labels | Text | Section headings |
| Option lists | Multi-Line Text | Dropdowns |
| `SaveButtonText`, `LogoutLinkText` | Text | Actions |
| Success/error messages | Text | Feedback |

Implement tabs only when Phase 0 schema has distinct groups (profile / topics / notifications / marketing).

---

## Pages (Sitecore content YAML)

| Route | Item name | Renderings |
|-------|-----------|------------|
| `/profile` | Profile | `{Name}ProfileSection` |
| `/register` or `/join` | Register / Join | `{Name}RegisterSection` |
| `/login` | Login | `{Name}LoginSection` (optional) |

Add routes to navigation only when design includes them.

---

## Module registration

For each new component:

1. `*.module.json` — renderings include path
2. `.sitecore/component-map.client.ts` — lazy import
3. `.sitecore/import-map.client.ts` — shared lib imports (`useUser`, `buildLoginUrl`, hooks)
4. Serialization push + validate

---

## Header visual spec (logged in)

Minimum one of:

- User initials in colored circle
- Gravatar/`picture` thumbnail
- Display name text replacing "Login"
- Chevron + dropdown with Profile and Logout

Must be **visually distinct** from logged-out Login button so auth state is obvious.

---

## API route naming

Use a stable project segment, not a client brand:

```
/api/{project}/register
/api/{project}/profile
```

Examples: `/api/member/register`, `/api/portal/profile` — pick one prefix per app and stay consistent.
