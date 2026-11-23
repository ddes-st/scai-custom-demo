import type { ReactNode } from "react";

/**
 * Pages-chrome field metadata wrapper.
 *
 * Mirrors `@sitecore-content-sdk/react`'s internal `<FieldMetadata>`
 * (not re-exported from the public package, otherwise we'd use it
 * directly). Emits a pair of `<code type="text/sitecore" chrometype="field">`
 * markers around its children so Sitecore Pages chrome can locate the
 * field and overlay the field-editing UI on top.
 *
 * Why this exists outside the SDK's own `Image` / `Link` components:
 * our primitives render through `next/image` + `next/link` (not the
 * SDK's bare `<img>` / `<a>`) so they can use Next's optimisation
 * pipeline AND remain visually editable in Pages. Wrapping the
 * optimised element with these chrome markers gives Pages everything
 * it needs to draw the chrome without giving up Next's rendering.
 *
 * The markers are invisible in normal rendering — Pages chrome hides
 * them via the `scpm` class — so wrapping any element is safe.
 */
export interface FieldMetadataMarkup {
  metadata: { [key: string]: unknown };
  children: ReactNode;
}

export function FieldMetadata({ metadata, children }: FieldMetadataMarkup) {
  const payload = JSON.stringify(metadata);
  // `chrometype` and `kind` are Sitecore-Pages-defined attributes; they
  // pass through as-is to the DOM via React's untyped-attribute path.
  // Using inline objects avoids React's "unknown attribute" dev warning.
  const openAttrs = {
    type: "text/sitecore",
    chrometype: "field",
    className: "scpm",
    kind: "open",
  };
  const closeAttrs = { ...openAttrs, kind: "close" };
  return (
    <>
      <code {...openAttrs}>{payload}</code>
      {children}
      <code {...closeAttrs} />
    </>
  );
}

/**
 * Read the `metadata` shape off a Sitecore field (Image / Link / etc).
 * The Layout Service ships this shape only when the page is being
 * served to Pages chrome (metadata edit mode); preview / runtime
 * requests return the field without it. Returns `undefined` when
 * absent so callers can branch on chrome-vs-runtime cleanly.
 */
export function getFieldMetadata(
  value: unknown,
): { [key: string]: unknown } | undefined {
  if (value == null || typeof value !== "object") return undefined;
  const metadata = (value as { metadata?: { [key: string]: unknown } })
    .metadata;
  if (
    metadata == null ||
    typeof metadata !== "object" ||
    Object.keys(metadata).length === 0
  )
    return undefined;
  return metadata;
}
