# HTML → Sitecore Content SDK Conversion (LITE)

**Simplified workflow for BQ / Content SDK. Full guide:** [`bq/.agents/docs/HTML-to-Content-SDK-conversion.md`](../../../../.agents/docs/HTML-to-Content-SDK-conversion.md)

**Also use:** [`FieldCatalog.reference.tsx`](../../../create-section-components/prompts/references/FieldCatalog.reference.tsx) for field typing / AppPlaceholder patterns (unstyled). When a host `content-families.json` exists, honor shared family owners vs thin members.

---

## ⚠️ OUTPUT REQUIREMENTS

**Deliver ONLY:**

1. Complete component `*.tsx` (named export `Default`, plus variants if needed)
2. Complete `*.definition.ts` with content seeds (when authoring is in scope)
3. Media/seed notes; deferred interactivity notes

**DO NOT:**

- ❌ Create `app/<route>/page.tsx` or run `create-next-app`
- ❌ Edit `authoring/items/**/*.yml` by hand
- ❌ Hardcode marketing copy in JSX
- ❌ Fetch/convert linked pages
- ❌ Offer unsolicited next steps / setup lectures

---

## ⚠️ SCOPE: SINGLE SECTION ONLY

Convert **one** HTML section → **one** Sitecore component package under `bq/src/components/…`.

Preserve `href` values as General Link seeds. Do not crawl the site.

---

## TRANSFORMS

### HTML → JSX + Content SDK

| Find | Replace |
|------|---------|
| `class="` | `className="` |
| Void tags | Self-close (`<img />` only if non-field decorative) |
| Visible text | `<Text field={fields.…} tag="…" />` |
| Rich HTML | `<RichText field={fields.…} />` |
| Content images | `<Image field={fields.…} />` |
| Content links | `<Link field={fields.…} showLinkTextWithChildrenPresent>` + decorative child only |
| `onclick` / forms | `'use client'` in `*.client.tsx` |

### CSS → Tailwind (breakpoints)

| Band | Tailwind | Crop |
|------|----------|------|
| Mobile | default | 370px |
| Tablet | `md:` | 768px |
| Desktop | **`lg:`** (not `md:`) | 1024px |

Arbitrary values OK: `text-[#09051c]`, `max-w-[650px]`.

---

## WORKFLOW

1. **Get HTML** for current section only (capture `section.html` or View Source).
2. **Remove** document chrome (`<html>`, `<head>`, `<body>`, scripts, GTM).
3. **Map** copy/images/CTAs → Sitecore fields.
4. **Write** `src/components/{collection}/{Name}/{key}.tsx` using:
   - `ComponentProps` from `lib/component-props`
   - `const { fields } = props`
   - `params.RenderingIdentifier || params.id` (never `props.id`)
   - `export const Default`
5. **Write** `{key}.definition.ts` (`kind: "component"`, icon, model, content seeds).
6. **Style** with Tailwind; desktop columns via `lg:`.
7. From `bq/`: regenerate map if needed; `npm run authoring:generate` for YAML emit.

---

## TEMPLATE (server component)

```tsx
import { Text, Image, Link } from "@sitecore-content-sdk/nextjs";
import type { ImageField, LinkField, TextField } from "@sitecore-content-sdk/nextjs";
import { ComponentProps } from "lib/component-props";

interface Fields {
  Title: TextField;
  Logo: ImageField;
  Link: LinkField;
}

type Props = ComponentProps & { fields: Fields };

export const Default = (props: Props) => {
  const { fields } = props;
  const params = props.params ?? props.rendering?.params ?? {};
  const renderingId = params.RenderingIdentifier || params.id;

  return (
    <article
      key={renderingId || props.rendering?.uid}
      id={renderingId || undefined}
      className="flex w-full flex-col … lg:flex-row"
    >
      <Image field={fields.Logo} className="…" />
      <Text field={fields.Title} tag="h3" className="…" />
      <Link field={fields.Link} className="underline …" showLinkTextWithChildrenPresent>
        <span aria-hidden="true" className="ml-3">→</span>
      </Link>
    </article>
  );
};
```

---

## CHECKLIST

- [ ] No `class=` / no inline `style=` (Tailwind)
- [ ] No hardcoded marketing strings
- [ ] Fields always mounted (Pages editing)
- [ ] Link text not duplicated in children
- [ ] Desktop layout uses `lg:`
- [ ] Definition + TSX names/variants aligned
- [ ] No YAML hand-edits

**Prompt:** `Following HTML-to-Content-SDK-conversion.md (or this LITE file), convert: <source> → src/components/…`
