import type { ImageSource } from "components/registry/primitives/editables/image";
import type { LinkSource } from "components/registry/primitives/editables/link";
import type { RichTextSource } from "components/registry/primitives/editables/richtext";
import type { TextSource } from "components/registry/primitives/editables/text";

/**
 * Emptiness check for the `{ value: ... }` field shape (classic Layout
 * Service v1). `value` may be a string or a nested `{ href }` / `{ src }`
 * object.
 */
function isEmptyValueShape(maybeValue: unknown): boolean {
  if (maybeValue == null) return true;
  if (typeof maybeValue === "string") return maybeValue.trim() === "";
  if (typeof maybeValue === "object") {
    const nested = maybeValue as Record<string, unknown>;
    if ("href" in nested) return !nested.href;
    if ("src" in nested) return !nested.src;
  }
  return false;
}

/**
 * Emptiness check for the object field shapes (after the plain-string and
 * null cases are handled by {@link isEmptySource}).
 */
function isEmptyObjectSource(obj: Record<string, unknown>): boolean {
  if ("value" in obj) return isEmptyValueShape(obj.value);
  if ("href" in obj) return !obj.href;
  if ("src" in obj) return !obj.src;
  if ("jsonValue" in obj) return obj.jsonValue == null;
  return false;
}

/**
 * Generic emptiness check for Sitecore field-like values used across blocks.
 * Supports plain strings and object shapes that expose a `value` property.
 */
export function isEmptySource(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object") {
    return isEmptyObjectSource(value as Record<string, unknown>);
  }
  return false;
}

/**
 * Return a source only when it exists and contains content.
 */
export function getNonEmptySource<T>(
  value: T | undefined | null,
): T | undefined {
  if (value == null) return undefined;
  return isEmptySource(value as never) ? undefined : value;
}

/**
 * Normalize a text-like source into a plain string.
 *
 * Accepts the `TextSource | RichTextSource` union so card adapters
 * that hand off loosely-typed `extras` (which may be either) can pull
 * a string label without an extra cast. Handles three field shapes:
 *
 * - bare string
 * - `{ value: "..." }` (classic Layout Service v1)
 * - `{ jsonValue: { value: "..." } }` (Edge GraphQL responses)
 *
 * For rich text whose `value` is a structured object rather than a
 * plain string, returns undefined — callers wanting the structured
 * representation should pass the source through `<RichText>` directly.
 */
/** Trim a string and collapse the empty result to `undefined`. */
function trimmedOrUndefined(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const trimmed = text.trim();
  return trimmed || undefined;
}

/** Pull a plain-string label out of an object-shaped text source. */
function getObjectSourceText(value: object): string | undefined {
  if ("value" in value) {
    const direct = (value as { value?: unknown }).value;
    if (typeof direct === "string") return trimmedOrUndefined(direct);
  }
  if ("jsonValue" in value) {
    const json = (value as { jsonValue?: unknown }).jsonValue;
    if (json && typeof json === "object" && "value" in json) {
      return trimmedOrUndefined((json as { value?: unknown }).value);
    }
  }
  return undefined;
}

export function getSourceText(
  value: TextSource | RichTextSource | undefined,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return trimmedOrUndefined(value);
  if (typeof value === "object") return getObjectSourceText(value);
  return undefined;
}

/**
 * String-returning variant of getSourceText for call sites that prefer
 * an empty-string sentinel over `undefined` (e.g. when feeding into
 * `${title}` template literals or `.length` checks).
 */
export function getSourceTextOrEmpty(
  value: TextSource | RichTextSource | undefined,
): string {
  return getSourceText(value) ?? "";
}

/**
 * Inverse of `isEmptySource` for text-shaped sources. Convenience guard
 * for the `hasText(field) ? <Text /> : null` pattern used across cards.
 */
export function hasSourceText(value: TextSource | undefined): boolean {
  return !isEmptySource(value);
}

/**
 * Shared heading resolution used by blocks that support Title/Heading aliases.
 */
export function getTitleOrHeading(fields: {
  Title?: TextSource;
  Heading?: TextSource;
}): TextSource | undefined {
  // Pick the first NON-EMPTY of Title/Heading. A bare `Title ?? Heading`
  // would let a present-but-blank Title short-circuit the fallback and
  // mask a valid Heading, so resolve each side independently.
  return getNonEmptySource(fields?.Title) ?? getNonEmptySource(fields?.Heading);
}

/**
 * Narrow a text-or-rich-text source to plain string when possible.
 */
export function isStringSource(
  value: TextSource | RichTextSource | undefined,
): value is string {
  return typeof value === "string";
}

/**
 * Narrow a text-or-rich-text source to object rich-text-like values.
 */
export function isRichTextSource(
  value: TextSource | RichTextSource | undefined,
): value is RichTextSource {
  return typeof value === "object" && value !== null;
}

/**
 * Resolve a safe image alt string from an optional preferred source.
 * Supports plain strings and Sitecore-like field objects with `value`.
 *
 * **Default fallback is empty string** (presentational image, skipped
 * by screen readers) rather than the literal word `"Image"`. The
 * previous default leaked screen-reader noise on every image whose
 * Sitecore field hadn't filled in `alt` — authors writing meaningful
 * alt text still win, decorative images stay decorative.
 *
 * Callers that want a specific verbal fallback can still pass one
 * (e.g. `resolveImageAlt(field, "Author headshot")`) — most call
 * sites should NOT, because a generic fallback string is worse
 * than nothing for a11y.
 */
export function resolveImageAlt(preferred: unknown, fallback = ""): string {
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  if (
    typeof preferred === "object" &&
    preferred != null &&
    "value" in preferred
  ) {
    const value = (preferred as { value?: unknown }).value;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

/**
 * Extract a usable image src URL from an `ImageSource`. Returns
 * `undefined` for missing, empty, or whitespace-only values so callers
 * can `??` a placeholder without surfacing dead URLs to `<img>`.
 */
export function getImageSrc(
  image: ImageSource | undefined,
): string | undefined {
  if (image == null || typeof image !== "object") return undefined;

  const sitecoreValue = (image as { value?: unknown }).value;
  if (sitecoreValue && typeof sitecoreValue === "object") {
    const src = (sitecoreValue as { src?: unknown }).src;
    if (typeof src === "string" && src.trim()) return src.trim();
  }

  const direct = (image as { src?: unknown }).src;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  return undefined;
}

/**
 * Extract an `href` from a `LinkSource`, falling back to a configurable
 * placeholder when the value is missing or empty. Defaults to `"#"` for
 * the common card pattern of always rendering an anchor — pass `""` to
 * opt out of the placeholder and let the caller branch on emptiness.
 */
export function getLinkHref(
  link: LinkSource | undefined,
  fallback = "#",
): string {
  if (link == null || typeof link !== "object") return fallback;

  const sitecoreValue = (link as { value?: unknown }).value;
  if (sitecoreValue && typeof sitecoreValue === "object") {
    const href = (sitecoreValue as { href?: unknown }).href;
    if (typeof href === "string" && href.trim()) return href.trim();
  }

  const direct = (link as { href?: unknown }).href;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  return fallback;
}

/**
 * Extract the author-supplied label from a `LinkSource`. Falls back
 * to the `title` attribute when `text` is empty — some Sitecore link
 * fields ship a populated title without a text label, and surfacing
 * it keeps social/utility nav items readable. Returns `undefined`
 * when both are missing so callers can branch on a meaningful default.
 */
export function getLinkText(link: LinkSource | undefined): string | undefined {
  if (link == null || typeof link !== "object") return undefined;

  const sitecoreValue = (link as { value?: unknown }).value;
  if (sitecoreValue && typeof sitecoreValue === "object") {
    const text = (sitecoreValue as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) return text.trim();
    const title = (sitecoreValue as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title.trim();
  }

  const direct = (link as { text?: unknown; title?: unknown }).text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const directTitle = (link as { title?: unknown }).title;
  if (typeof directTitle === "string" && directTitle.trim())
    return directTitle.trim();

  return undefined;
}
