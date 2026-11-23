import {
  type RichTextField,
  RichText as SdkRichText,
} from "@sitecore-content-sdk/nextjs";
import { EditPlaceholder } from "components/registry/primitives/core/edit-placeholder";
import { Prose } from "components/registry/primitives/core/prose";
import { isEmptySource } from "components/registry/primitives/editables/source-normalizers";
import { cn } from "components/lib/registry/cn";
import type { CmsProps, TextField } from "components/lib/registry/sitecore";

/**
 * Polymorphic input for the `<RichText>` editable. Handles three shapes
 * the layout service (REST or GraphQL) might deliver:
 *
 *   - a raw HTML string (developer-trusted; see security note below)
 *   - a Sitecore `RichTextField` object
 *   - a Sitecore `TextField` object (its `value` is treated as HTML)
 */
export type RichTextSource = string | RichTextField | TextField;

export interface RichTextProps extends CmsProps {
  value?: RichTextSource;
  className?: string;
  /**
   * Author-facing label shown when the field is empty and the page is
   * in editing mode. Renders a block-style dashed stub so the slot stays
   * clickable. Omit to keep the empty render as `null`.
   */
  placeholder?: string;
}

/**
 * Renders rich text from one of three sources, always wrapped in
 * `<Prose>` so the typography lives on the primitive (not on the
 * Sitecore SDK component or the raw HTML):
 *
 *   1. A Sitecore RichTextField object → handled by `SdkRichText`.
 *      Relies on Sitecore CMS-side sanitization.
 *   2. A Sitecore TextField object     → also routed through
 *      `SdkRichText`; its `value` is treated as HTML.
 *   3. A raw HTML string               → injected via
 *      `dangerouslySetInnerHTML`.
 *
 * **Contract for the string path:** the caller MUST supply pre-trusted
 * HTML. This branch is intended for showcase fixtures, theme-author
 * tooling, and other developer-controlled surfaces. Do NOT pass
 * user-submitted strings here — there is no sanitizer in this path.
 * Add DOMPurify (or similar) at the call site before passing untrusted
 * input to RichText.
 */
export function RichText({
  value,
  className,
  placeholder,
  isEditing,
}: RichTextProps) {
  if (value == null || isEmptySource(value)) {
    if (isEditing && placeholder) {
      return <EditPlaceholder kind={placeholder} variant="block" />;
    }
    return null;
  }

  if (typeof value === "string") {
    if (process.env.NODE_ENV !== "production") {
      // Coarse heuristic — catches obvious developer mistakes (forwarding
      // a fetch result, pasting form input). Real sanitization belongs
      // upstream; this is a tripwire, not a guarantee.
      if (/<script\b|\son[a-z]+\s*=/i.test(value)) {
        console.warn(
          "RichText: string source contains script/event-handler markers; " +
            "ensure this HTML is from a trusted producer.",
        );
      }
    }
    return (
      <Prose
        className={cn(className)}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: caller-trusted HTML; see RichText JSDoc
        dangerouslySetInnerHTML={{ __html: value }}
      />
    );
  }

  return (
    <Prose className={cn(className)}>
      <SdkRichText field={value} />
    </Prose>
  );
}
