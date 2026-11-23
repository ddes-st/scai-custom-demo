import NextLink from "next/link";
import * as React from "react";
import { EditPlaceholder } from "components/registry/primitives/core/edit-placeholder";
import {
  FieldMetadata,
  getFieldMetadata,
} from "components/registry/primitives/editables/field-metadata";
import { isEmptySource } from "components/registry/primitives/editables/source-normalizers";
import { cn } from "components/lib/registry/cn";
import type { CmsProps, LinkField } from "components/lib/registry/sitecore";

/**
 * Polymorphic input for the `<Link>` editable. Either a Sitecore
 * `LinkField` from the layout service, or a loose `{ href, text }`
 * shape used by ad-hoc data sources and CMS adapters. A bare href
 * string is intentionally not supported — pass `{ href }` instead.
 */
export type LinkSource =
  | LinkField
  | {
      href?: string;
      text?: string;
      value?: { href?: string; text?: string };
      locale?: string;
    };

export type LinkProps = CmsProps & {
  value?: LinkSource;
  className?: string;
  locale?: string;
  useNextLink?: boolean;
  children?: React.ReactNode;
  /**
   * Trailing adornment rendered inside the anchor, after the resolved
   * link text (e.g. a "→" arrow icon). Distinct from `children`, which
   * is only a fallback label and is dropped once the source carries its
   * own text — an adornment must survive that resolution, so it rides
   * this dedicated slot instead.
   */
  after?: React.ReactNode;
  /**
   * Leading adornment rendered inside the anchor, before the resolved
   * link text (e.g. a named icon on a CTA). Same survival contract as
   * `after` — it renders regardless of whether the authored text or the
   * `children` fallback wins.
   */
  before?: React.ReactNode;
  /**
   * Author-facing label shown when the link is empty and the page is in
   * editing mode. Renders an inline dashed stub so the slot stays
   * clickable. Omit to keep the empty render as `null`.
   */
  placeholder?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "children">;

const linkStyles = cn(
  "text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
);

function isInternalHref(href: string): boolean {
  return (
    !href.startsWith("http") &&
    !href.startsWith("//") &&
    !href.startsWith("mailto:")
  );
}

// Recursively strip non-string `locale` values from any nested object.
// Some CMS payloads stuff a `locale: { en: "…", fr: "…" }` object onto
// link metadata; NextLink's `href` typing rejects that, and we don't
// use it. Leave string `locale` values untouched.
function stripNonStringLocale(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src)) {
    const val = src[key];
    if (key === "locale") {
      if (typeof val === "string") out[key] = val;
      continue;
    }
    out[key] =
      val !== null && typeof val === "object" && !Array.isArray(val)
        ? stripNonStringLocale(val)
        : val;
  }
  return out;
}

function sanitizeLinkField(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  return stripNonStringLocale(input);
}

function isLinkField(x: LinkSource): x is LinkField {
  const v = (x as LinkField).value;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { href?: string }).href === "string"
  );
}

function renderLink(
  href: string,
  content: React.ReactNode,
  ref: React.Ref<HTMLAnchorElement>,
  className: string | undefined,
  useNextLink: boolean,
  rest: Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "children"
  >,
) {
  const resolvedClassName = cn(linkStyles, className);
  const isInternal = isInternalHref(href);

  if (useNextLink && isInternal) {
    return (
      <NextLink
        ref={ref}
        href={href}
        className={resolvedClassName}
        data-slot="link"
        {...rest}
      >
        {content}
      </NextLink>
    );
  }

  if (!isInternal) {
    return (
      <a
        ref={ref}
        href={href}
        className={resolvedClassName}
        target="_blank"
        rel="noopener noreferrer"
        data-slot="link"
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      className={resolvedClassName}
      data-slot="link"
      {...rest}
    >
      {content}
    </a>
  );
}

/**
 * Editable link primitive. Resolves a polymorphic `LinkSource` to an
 * anchor (`NextLink` for internal hrefs, plain `<a target="_blank">`
 * for external). The `locale` prop is accepted for API compatibility
 * with consumer callsites but is currently a no-op.
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      value,
      className,
      locale,
      useNextLink = true,
      children,
      after,
      before,
      placeholder,
      isEditing,
      id: _id,
      styles: _styles,
      rendering: _rendering,
      ...rest
    },
    ref,
  ) => {
    void locale;
    // Compose the anchor's inner content with the optional leading /
    // trailing adornments. Kept separate from `content` resolution so
    // the adornments survive even when authored link text wins over
    // `children`.
    const withAfter = (content: React.ReactNode): React.ReactNode =>
      before == null && after == null ? (
        content
      ) : (
        <>
          {before}
          {content}
          {after}
        </>
      );
    // Chrome metadata flows in BOTH the empty and populated branches —
    // Pages chrome needs the markers wrapping the empty-state placeholder
    // too so the author can click into the slot and open the link picker.
    // Layout Service only ships the `metadata` shape when serving Pages
    // chrome (metadata edit mode); runtime / preview requests omit it,
    // so non-Pages usage continues to render plain anchors.
    const metadata = getFieldMetadata(value);

    if (value == null || isEmptySource(value)) {
      if (isEditing && placeholder) {
        const empty = <EditPlaceholder kind={placeholder} />;
        return metadata ? (
          <FieldMetadata metadata={metadata}>{empty}</FieldMetadata>
        ) : (
          empty
        );
      }
      return null;
    }

    let linkNode: React.ReactNode;
    if (isLinkField(value)) {
      const sanitized = sanitizeLinkField(value) as LinkField;
      const v = sanitized?.value as
        | { href?: string; text?: string; title?: string }
        | undefined;
      const href = v?.href ?? "#";
      // Authored Sitecore link text wins over a caller-supplied fallback
      // (`children`); callers that pass no text get the fallback. This is
      // the contract CtaGroup documents — `children` is a fallback label,
      // not an override. Value-only callers pass no children and are
      // unaffected.
      const content = v?.text ?? v?.title ?? children ?? "";
      linkNode = renderLink(
        href,
        withAfter(content),
        ref,
        className,
        useNextLink,
        rest,
      );
    } else {
      const href = value.value?.href ?? value.href ?? "#";
      const content = value.value?.text ?? value.text ?? children ?? href;
      linkNode = renderLink(
        href,
        withAfter(content),
        ref,
        className,
        useNextLink,
        rest,
      );
    }

    // Wrap the rendered anchor with Pages chrome markers so the field
    // is visually editable. Without this wrap, Pages can locate the
    // anchor but has no way to bind its field-editing overlay to it —
    // clicking the rendered link does nothing in author mode.
    if (metadata) {
      return <FieldMetadata metadata={metadata}>{linkNode}</FieldMetadata>;
    }
    return <>{linkNode}</>;
  },
);
Link.displayName = "Link";
