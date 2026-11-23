"use client";

import { Image as SdkImage } from "@sitecore-content-sdk/nextjs";
import NextJsImage from "next/image";
import type { ComponentProps, ComponentType } from "react";
import { EditPlaceholder } from "components/registry/primitives/core/edit-placeholder";
import {
  FieldMetadata,
  getFieldMetadata,
} from "components/registry/primitives/editables/field-metadata";
import { resolveImageAlt } from "components/registry/primitives/editables/source-normalizers";
import { cn } from "components/lib/registry/cn";
import type { CmsProps, ImageField } from "components/lib/registry/sitecore";
import { isTrustedImageHost } from "components/lib/registry/trusted-image-hosts";

/**
 * Polymorphic input for the `<Image>` and `<NextImage>` editables.
 * Either a Sitecore `ImageField` or a plain `{ src, alt }` shape used
 * by ad-hoc data sources (presets, themes, fixtures).
 */
export type ImageSource =
  | ImageField
  | {
      src: string;
      alt?: string;
      value?: { src?: string; alt?: string };
    };

function isImageField(x: ImageSource): x is ImageField {
  if (x == null) return false;
  const v = (x as ImageField).value;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { src?: string }).src === "string"
  );
}

/** Resolve the underlying src string for either ImageSource shape. */
function resolveImageSrc(value: ImageSource | undefined): string | undefined {
  if (value == null) return undefined;
  if (isImageField(value)) {
    return (value.value as { src?: string } | undefined)?.src;
  }
  if (typeof value === "object" && "src" in value) {
    return (value as { src?: string }).src;
  }
  return undefined;
}

export type ImageProps = CmsProps & {
  value?: ImageSource;
  className?: string;
  width?: number;
  height?: number;
  /**
   * Replicate `next/image`'s `fill` layout on the UNOPTIMIZED path
   * (bare `<img>` / SDK `<Image>`). `next/image` `fill` applies
   * `position:absolute; inset:0; height:100%; width:100%` inline so the
   * element covers its `relative` parent and an `object-cover`/`object-
   * contain` className actually takes effect. The unoptimized element
   * gets none of that for free, so a `fill` image would otherwise render
   * at its NATURAL size in the top-left of the box, leaving the
   * container background (`bg-muted`) exposed. When set we apply the
   * equivalent utility classes and drop `width`/`height` (fill owns the
   * sizing). Mirrors {@link NextImageProps.fill}.
   */
  fill?: boolean;
  alt?: string;
  /**
   * Native `<img>` loading strategy, forwarded onto the underlying
   * element (both the SDK `<Image>` and the bare `<img>` branch).
   * Defaults to unset (browser default `eager`). Pass `"lazy"` for
   * below-the-fold images; brand/logo chrome above the fold should
   * stay eager.
   */
  loading?: "lazy" | "eager";
  /**
   * Native `<img>` decoding hint. Defaults to `"async"` so an
   * arbitrary-host logo never blocks paint while it decodes.
   */
  decoding?: "sync" | "async" | "auto";
  /**
   * Author-facing label rendered when the slot is empty and the page
   * is in editing mode. For Sitecore `ImageField` values this is
   * handed to the SDK's `emptyFieldEditingComponent`; for plain
   * `{src}` shapes it's our manual fallback. Block-variant styling
   * to match the image shape. Omit to keep the empty render as
   * `null`.
   */
  placeholder?: string;
};

/**
 * Editable image primitive. Dispatches on source type:
 *
 *   - **`ImageField`** (Sitecore shape) → delegated to `<SdkImage>`,
 *     which owns the empty-field editing contract via the SDK's
 *     native `emptyFieldEditingComponent` prop.
 *   - **Plain `{src}`** → bare `<img>`. Empty `src` + `isEditing` +
 *     `placeholder` falls back to `<EditPlaceholder>` so the slot
 *     stays visible in the showcase preview. An empty `src` with no
 *     placeholder renders `null` — never a broken `<img src="">`.
 */
export function Image({
  value,
  className,
  width,
  height,
  fill,
  alt,
  loading,
  decoding = "async",
  placeholder,
  isEditing,
  id: _id,
  styles: _styles,
  rendering: _rendering,
}: ImageProps) {
  // Replicate next/image `fill` on the unoptimized element: cover the
  // `relative` parent so a caller's `object-cover`/`object-contain`
  // className takes effect (see ImageProps.fill). Fill owns the sizing,
  // so width/height attributes are dropped when it's set.
  const fillClassName = fill ? "absolute inset-0 h-full w-full" : undefined;
  const resolvedWidth = fill ? undefined : width;
  const resolvedHeight = fill ? undefined : height;
  if (value != null && isImageField(value)) {
    const fieldValue = value.value as
      | { src?: string; alt?: string }
      | undefined;
    const imageFieldWithAlt = {
      ...value,
      value: {
        ...fieldValue,
        alt: resolveImageAlt(alt ?? fieldValue?.alt),
      },
    };
    // Only pass `emptyFieldEditingComponent` when we genuinely need
    // it — i.e. the field is empty AND a placeholder is configured.
    // The SDK's <Image> forwards unknown PascalCase props straight
    // onto the inner <img> when the field DOES have a src, so spreading
    // unconditionally produces a React DOM-attribute warning every
    // time the image is populated. Gating on `!hasSrc` keeps the
    // editing affordance for empty fields while keeping the populated
    // render warning-free.
    const hasSrc = Boolean(fieldValue?.src);
    const EmptyComponent: ComponentType | undefined =
      !hasSrc && placeholder
        ? () => <EditPlaceholder kind={placeholder} variant="block" />
        : undefined;
    // `loading` / `decoding` are forwarded straight onto the SDK's
    // underlying `<img>` (the SDK spreads unknown props onto the
    // element) — the SDK path is a bare, UNOPTIMIZED `<img>`, so a
    // brand logo from an arbitrary CDN host renders without needing an
    // `images.remotePatterns` allowlist entry or `dangerouslyAllowSVG`.
    return (
      <SdkImage
        field={imageFieldWithAlt}
        className={cn(fillClassName, className)}
        width={resolvedWidth}
        height={resolvedHeight}
        loading={loading}
        decoding={decoding}
        {...(EmptyComponent
          ? { emptyFieldEditingComponent: EmptyComponent }
          : {})}
      />
    );
  }

  // Plain `{src}` branch: render only when we have a real src.
  const plainImage =
    value && typeof value === "object" && "src" in value
      ? (value as { src?: string; alt?: string })
      : undefined;
  const src = plainImage?.src;
  if (!src) {
    if (isEditing && placeholder) {
      return <EditPlaceholder kind={placeholder} variant="block" />;
    }
    return null;
  }
  return (
    // biome-ignore lint/performance/noImgElement: this is the deliberate lightweight, unoptimized editable variant; the next/image-backed path is the sibling <NextImage> primitive.
    <img
      src={src}
      alt={resolveImageAlt(alt ?? plainImage?.alt)}
      className={cn(fillClassName, className)}
      width={resolvedWidth}
      height={resolvedHeight}
      loading={loading}
      decoding={decoding}
    />
  );
}

export type NextImageProps = {
  value?: ImageSource;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  alt?: string;
  /**
   * Author-facing label rendered when the slot is empty and the page is
   * in editing mode. Renders a block-style dashed stub so the slot stays
   * clickable. Omit to keep the empty render as `null`.
   *
   * The Sitecore SDK's native `emptyFieldEditingComponent` is not
   * available on this variant — `<NextImage>` bypasses `<SdkImage>` to
   * use Next's image pipeline — so the empty-edit path here is a manual
   * `<EditPlaceholder>` for both Sitecore-field and plain `{src}`
   * shapes. Same author-facing affordance, different plumbing.
   */
  placeholder?: string;
  /**
   * Override the optimization decision.
   *   - `true`  → always render the bare-`<img>` / SDK-`<Image>` path
   *               (no `/_next/image` proxy).
   *   - `false` → always optimize (the host MUST be in
   *               `images.remotePatterns`, else the optimizer 404s).
   *   - unset (default) → AUTO: optimize same-origin + trusted hosts
   *               (`isTrustedImageHost`); render everything else —
   *               notably brands' own dynamic image URLs — unoptimized.
   *
   * The auto default is what lets `images.remotePatterns` stay scoped to
   * first-party hosts without breaking unknown brand image URLs.
   *
   * Note: the Sitecore SDK's own `NextImage` also accepts `unoptimized`,
   * but only with a `field` (it errors on `src`); delegating to our
   * `<Image>` primitive keeps one branch correct for both the Sitecore
   * (`ImageField` → SDK `<Image>`) and plain-`{src}` shapes.
   */
  unoptimized?: boolean;
} & CmsProps &
  Omit<
    ComponentProps<typeof NextJsImage>,
    | "src"
    | "alt"
    | "width"
    | "height"
    | "fill"
    | "sizes"
    | "priority"
    | "className"
    // `placeholder` on `<NextJsImage>` is the blur-data API
    // (`"blur" | "empty" | data:image/...`). Our `placeholder` is the
    // author-facing empty-edit label — different concept, same name.
    // Override so the latter wins.
    | "placeholder"
  >;

/**
 * Build the optimised `next/image` element. Falls back to `fill` mode
 * when no width/height is resolvable, mirroring the legacy inline
 * branching for both the plain-`{src}` and Sitecore-field shapes.
 */
function renderNextJsImage({
  src,
  alt,
  width,
  height,
  fill,
  sizes,
  priority,
  className,
  rest,
}: {
  src: string;
  alt: string;
  width: number | undefined;
  height: number | undefined;
  fill: boolean;
  sizes: string | undefined;
  priority: boolean | undefined;
  className: string;
  rest: Record<string, unknown>;
}) {
  const sharedProps = {
    src,
    alt,
    sizes: fill ? (sizes ?? "100vw") : sizes,
    priority,
    className,
    ...rest,
  };
  if (fill) {
    return <NextJsImage fill {...sharedProps} />;
  }
  return <NextJsImage width={width} height={height} {...sharedProps} />;
}

/**
 * `next/image`-backed image primitive. Same `ImageSource` semantics as
 * `<Image>` but uses Next's optimization pipeline. Falls back to `fill`
 * mode when no width/height is resolvable from props or the field.
 *
 * Empty values never produce a broken `<img>`: a Sitecore field with
 * missing `src`, a plain `{src}` shape with an empty / missing `src`,
 * and a `null` value all render the empty branch — either an
 * `<EditPlaceholder>` (when `isEditing && placeholder`) or `null`.
 */
export function NextImage({
  value,
  className,
  width,
  height,
  fill,
  sizes,
  priority,
  unoptimized,
  alt,
  placeholder,
  isEditing,
  id: _id,
  styles: _styles,
  rendering: _rendering,
  ...rest
}: NextImageProps) {
  // Optimize only same-origin + trusted hosts; everything else — notably a
  // brand's OWN image URLs during page recreation (dynamic, unknowable
  // hosts) — renders UNOPTIMIZED through the bare-`<img>` / SDK-`<Image>`
  // primitive, bypassing the `/_next/image` proxy. The SDK path keeps
  // Sitecore field-editing chrome for `ImageField` values. An explicit
  // `unoptimized` prop overrides the host heuristic. This is what lets
  // next.config scope remotePatterns to first-party hosts without 404ing
  // unknown brand URLs. (fill/sizes/priority are next/image-only.)
  const renderUnoptimized =
    unoptimized ?? !isTrustedImageHost(resolveImageSrc(value));
  if (renderUnoptimized) {
    // Forward `loading` / `decoding` (native `<img>` attrs, carried in
    // `rest` off `ComponentProps<typeof NextJsImage>`) onto the bare
    // `<img>` so the unoptimized logo path keeps the same robustness
    // hints as a direct `<Image>` render.
    const { loading, decoding } = rest as {
      loading?: "lazy" | "eager";
      decoding?: "sync" | "async" | "auto";
    };
    return (
      <Image
        value={value}
        className={className}
        width={width}
        height={height}
        // Preserve next/image `fill` layout on the unoptimized branch —
        // without this a `fill` image (every image-led card / promo
        // media slot) collapses to its natural size and the container's
        // `bg-muted` shows around it.
        fill={fill}
        alt={alt}
        loading={loading}
        decoding={decoding}
        placeholder={placeholder}
        isEditing={isEditing}
      />
    );
  }
  // Chrome metadata flows in BOTH the empty and populated branches so
  // Pages can overlay the image-editing UI on either state. Layout
  // Service only ships `metadata` when serving Pages chrome (metadata
  // edit mode); runtime / preview requests omit it.
  const metadata = getFieldMetadata(value);

  const wrapWithChrome = (node: React.ReactNode) =>
    metadata ? <FieldMetadata metadata={metadata}>{node}</FieldMetadata> : node;

  const renderEmpty = () => {
    if (isEditing && placeholder) {
      return wrapWithChrome(
        <EditPlaceholder kind={placeholder} variant="block" />,
      );
    }
    return null;
  };
  if (value == null) return renderEmpty();
  if (!isImageField(value)) {
    const plainImage = value as { src?: string; alt?: string };
    if (!plainImage.src) return renderEmpty();
    // Fall back to fill mode when no dimensions are supplied — mirrors
    // the ImageField branch below. Without this, plain `{src}` shapes
    // (the picsum.photos defaults baked into every preview JSON) render
    // as width=0 height=0 — invisible despite the URL loading fine.
    const useFill = fill || (width == null && height == null);
    return renderNextJsImage({
      src: plainImage.src,
      alt: resolveImageAlt(alt ?? plainImage.alt),
      width,
      height,
      fill: useFill,
      sizes,
      priority,
      className: cn(className),
      rest,
    });
  }
  const fieldValue = value.value as
    | {
        src?: string;
        alt?: string;
        width?: number;
        height?: number;
      }
    | undefined;
  const src = fieldValue?.src ?? "";
  if (!src) return renderEmpty();
  const resolvedAlt = resolveImageAlt(alt ?? fieldValue?.alt);
  const resolvedWidth = width ?? fieldValue?.width;
  const resolvedHeight = height ?? fieldValue?.height;
  const useFill = fill || resolvedWidth == null || resolvedHeight == null;
  // Wrap the optimised next/image element with Pages chrome markers
  // so the field is visually editable. Without this wrap Pages can
  // see the rendered image but has nowhere to attach the chrome UI;
  // clicking the image in author mode does nothing.
  return wrapWithChrome(
    renderNextJsImage({
      src,
      alt: resolvedAlt,
      width: resolvedWidth,
      height: resolvedHeight,
      fill: useFill,
      sizes,
      priority,
      className: cn(className),
      rest,
    }),
  );
}
