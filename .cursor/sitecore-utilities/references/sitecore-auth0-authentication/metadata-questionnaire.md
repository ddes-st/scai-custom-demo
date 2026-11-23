# Auth0 metadata questionnaire

Run this **before** building Register and Profile forms. Propose defaults from site context; **ask the user to confirm** before implementation.

---

## Decision guide

| Data | Storage | Rationale |
|------|---------|-----------|
| First name, last name, email | Auth0 standard fields | Universal; searchable |
| Password | Auth0 credentials | Never store elsewhere |
| Avatar URL | `picture` or `user_metadata.avatar_url` | User-editable profile |
| Marketing / notification prefs | `user_metadata` | User-editable; safe on client PATCH |
| Topic / content preferences | `user_metadata` | Personalization |
| Company, job title, phone | `user_metadata` | B2B registration |
| Roles, admin, entitlements | `app_metadata` | Server-controlled only |
| Community / group membership | `app_metadata` or namespaced claim | Updated by join/approve APIs |
| Subscription tier | `app_metadata` | Billing integration |

**Rule:** If the user can change it in a profile form → `user_metadata`. If only admins/system set it → `app_metadata` or Auth0 Roles.

---

## Proposals by site type

Use the closest match; combine rows as needed.

### B2B / professional services / member portal

**user_metadata**

- `company`, `sector`, `job_role`, `business_postcode`, `annual_turnover`
- `topic_preferences` (string array)
- `notifications` — object with booleans: email, mentions, replies, new content
- `marketing` — object: subscribe, newsletters, product emails

**app_metadata**

- `entitlements` — record of feature flags, e.g. `{ "premium_insights": true }`
- `communities` — record of joined community IDs (if community features exist)
- `roles` — or use Auth0 RBAC + Post-Login Action

### E-commerce / retail

**user_metadata**

- `phone`, `default_shipping_address`, `marketing_opt_in`
- `size_preferences`, `favorite_categories`

**app_metadata**

- `loyalty_tier`, `customer_id` (CRM), `wholesale_account`

### Travel / booking

**user_metadata**

- `phone`, `nationality`, `travel_preferences` (array)
- `notification_booking_updates`, `marketing_opt_in`

**app_metadata**

- `frequent_destinations`, `partner_program_tier`

### Media / news / subscriptions

**user_metadata**

- `topic_preferences`, `newsletter_sections`
- `notifications` — breaking news, digests

**app_metadata**

- `subscription_plan`, `paywall_access`, `trial_end`

### Community / forum / events

**user_metadata**

- `display_name`, `bio`, `topic_preferences`
- `notifications` — replies, mentions, event reminders

**app_metadata**

- `communities` — membership map
- `moderator_of` — community IDs (admin-assigned)

### Simple marketing site (minimal auth)

**user_metadata**

- `marketing_opt_in` only

**app_metadata**

- None initially — add when gated content appears

---

## Question template for the user

> For Auth0 profile storage on **[site name / type]**, I propose:
>
> **user_metadata:** …  
> **app_metadata:** …  
> **Auth0 Roles (optional):** …
>
> Confirm, or tell me what to add/remove. Should profile editing use tabs (Profile / Preferences / Notifications / Marketing)?

---

## JSON shape examples

**user_metadata** (snake_case in API; map to form labels in UI):

```json
{
  "first_name": "Alex",
  "last_name": "Morgan",
  "company": "Example Ltd",
  "topic_preferences": ["Security", "Cloud"],
  "notifications": {
    "email_enabled": true,
    "reply_to_message": true
  },
  "marketing": {
    "subscribe_emails": false
  }
}
```

**app_metadata** (set by Actions or server APIs only):

```json
{
  "entitlements": {
    "premium": true,
    "beta_features": false
  },
  "communities": {
    "community-a": true
  }
}
```

---

## Post-Login Action

When using namespaced claims, document in the skill implementation:

- Action name and `namespace` variable value
- Claims added: `{namespace}/roles`, `{namespace}/entitlements`, etc.
- Must match `AUTH0_CLAIM_NAMESPACE` in env
