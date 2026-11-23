import { Text as SdkText } from "@sitecore-content-sdk/nextjs";
import type { ComponentType, ReactNode } from "react";
import { EditPlaceholder } from "components/registry/primitives/core/edit-placeholder";
import {
  TypographyBlockquote,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyList,
  TypographyP,
} from "components/registry/primitives/core/typography";
import { isEmptySource } from "components/registry/primitives/editables/source-normalizers";
import { cn } from "components/lib/registry/cn";
import type { CmsProps, TextField } from "components/lib/registry/sitecore";

/**
 * Polymorphic input for the `<Text>` editable. Either a raw string or
 * the project-wide `TextField` alias (defined in sitecore.tsx as
 * `Omit<SdkTextField, "value"> & { value?: string }`). Co-located with
 * the editable that consumes it.
 */
export type TextSource = string | TextField;

// Add a tag here, then add its component in TAG_COMPONENTS below.
// Two-table layout keeps the type and the implementation in lockstep
// when this set inevitably grows (h5/h6/etc.).
export type Tag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "blockquote"
  | "code"
  | "ul"
  | "span"
  | "cite";

type TagComponent = ComponentType<{ className?: string; children?: ReactNode }>;

// `span` and `cite` are unstyled inline wrappers — used when the editable
// is nested inside an element that already supplies the typography (e.g.
// inside an `<h6>` or a `<blockquote>`'s footer). Everything else composes
// a typography primitive for opinionated styling.
//
// Block-level wrappers (`div`, etc.) are intentionally excluded: a block
// inside an inline context — or inside a heading whose styling expects
// inline children — produces invalid HTML and breaks layout. Add a new
// inline element here, but reach for a different primitive (or compose
// an existing typography component) for block needs.
const Span: TagComponent = ({ className, children }) => (
  <span className={className}>{children}</span>
);
const Cite: TagComponent = ({ className, children }) => (
  <cite className={className}>{children}</cite>
);

const TAG_COMPONENTS: Record<Tag, TagComponent> = {
  h1: TypographyH1,
  h2: TypographyH2,
  h3: TypographyH3,
  h4: TypographyH4,
  p: TypographyP,
  blockquote: TypographyBlockquote,
  code: TypographyInlineCode,
  ul: TypographyList,
  span: Span,
  cite: Cite,
};

export interface TextProps extends CmsProps {
  value?: TextSource;
  tag?: Tag;
  className?: string;
  /**
   * Author-facing label shown when the field is empty and the page is
   * in editing mode (e.g. `"Title"`, `"Eyebrow"`). Renders an inline
   * dashed `+ <label>` stub so the slot stays clickable. Omit to keep
   * the empty render as `null`.
   */
  placeholder?: string;
}

/**
 * Editable text primitive. Composes a typography component (chosen by `tag`)
 * with the Sitecore SDK's editable wrapper.
 *
 * - When `value` is set, the field is rendered (through `<SdkText>` for
 *   `TextField` shapes so Experience Editor / Pages can hook in, plain
 *   for raw strings).
 * - When `value` is empty AND `isEditing` is true AND `placeholder` is
 *   set, an `EditPlaceholder` stub renders in the slot so authors see
 *   where to click. Otherwise empty → `null`.
 *
 * `className` is applied to the typography wrapper (the visible element).
 * The SDK wrapper is intentionally unstyled so editing and non-editing
 * renders produce the same visual output.
 */
export function Text({
  value,
  tag = "p",
  className,
  placeholder,
  isEditing,
}: TextProps) {
  if (value == null || isEmptySource(value)) {
    if (isEditing && placeholder) {
      return <EditPlaceholder kind={placeholder} />;
    }
    return null;
  }

  const Wrapper = TAG_COMPONENTS[tag] ?? TypographyP;

  const content: ReactNode =
    typeof value === "string" ? value : <SdkText field={value} tag={"span"} />;

  return <Wrapper className={cn(className)}>{content}</Wrapper>;
}
