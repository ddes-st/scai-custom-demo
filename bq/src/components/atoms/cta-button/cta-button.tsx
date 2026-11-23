"use client";

import { Link as SitecoreLink, type LinkField } from "@sitecore-content-sdk/nextjs";
import type { ComponentProps, ReactNode } from "react";
import { FaIcon } from "components/icons/fa-icon";
import type { FaIconStyle } from "components/icons/resolve-fa-icon";
import {
  isEnabled,
  parseButtonVariant,
  type CmsProps,
} from "components/lib/cms";
import { cn } from "components/lib/utils";
import {
  Button as PrimitiveButton,
  buttonVariants,
} from "components/primitives/button";
import type { VariantProps } from "class-variance-authority";
import { ComponentProps as LibComponentProps } from "lib/component-props";

type PrimitiveButtonSize = NonNullable<
  ComponentProps<typeof PrimitiveButton>["size"]
>;
type SharedSize = "default" | "xs" | "sm" | "md" | "lg" | "xl";
export type CtaButtonSize = PrimitiveButtonSize | SharedSize;
export type CtaButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;

const SHARED_TO_PRIMITIVE_SIZE: Record<SharedSize, PrimitiveButtonSize> = {
  default: "default",
  xs: "xs",
  sm: "sm",
  md: "default",
  lg: "lg",
  xl: "lg",
};

function resolveButtonSize(
  size: CtaButtonSize | undefined,
): PrimitiveButtonSize | undefined {
  if (!size) return undefined;
  return (
    SHARED_TO_PRIMITIVE_SIZE[size as SharedSize] ??
    (size as PrimitiveButtonSize)
  );
}

function trailingArrow(): ReactNode {
  return (
    <FaIcon
      name="arrow-right"
      className="size-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
    />
  );
}

function leadingIconNode(
  iconName: string | undefined,
  iconStyle: FaIconStyle | undefined,
): ReactNode {
  const name = iconName?.trim().toLowerCase();
  if (!name || name === "none") return undefined;
  return (
    <FaIcon name={name} faStyle={iconStyle ?? "solid"} className="size-4 shrink-0" />
  );
}

export type LinkSource =
  | LinkField
  | {
      href?: string;
      text?: string;
      value?: { href?: string; text?: string };
    };

function isLinkField(value: LinkSource | undefined): value is LinkField {
  if (!value || typeof value !== "object") return false;
  const v = (value as LinkField).value;
  return typeof v === "object" && v !== null;
}

function resolveLooseLink(value: LinkSource | undefined): {
  href: string;
  text: string;
} | null {
  if (!value || isLinkField(value)) return null;
  const href = value.href ?? value.value?.href ?? "";
  const text = value.text ?? value.value?.text ?? "";
  if (!href && !text) return null;
  return { href: href || "#", text: text || href };
}

export interface CtaButtonProps
  extends Omit<ComponentProps<typeof PrimitiveButton>, "size" | "variant">,
    CmsProps {
  size?: CtaButtonSize;
  variant?: CtaButtonVariant | string;
  /**
   * Sitecore link field or Storybook `{ href, text }` shape.
   * Used when `children` is not provided.
   */
  link?: LinkSource;
  /** Font Awesome Free icon id for the leading icon. */
  iconName?: string;
  /** Font Awesome style: solid | regular | brands */
  iconStyle?: FaIconStyle | string;
  /** Trailing arrow; accepts Sitecore string booleans. */
  showArrow?: string | boolean;
  /**
   * Sitecore datasource fields (layout service). Prefer `link` for Storybook.
   */
  fields?: {
    Link?: LinkField;
    link?: LinkField;
  };
}

function composeButtonContent({
  asChild,
  children,
  leadingIcon,
  wantsArrow,
}: {
  asChild: boolean | undefined;
  children: ReactNode;
  leadingIcon: ReactNode;
  wantsArrow: boolean;
}): ReactNode {
  if (asChild || !(leadingIcon || wantsArrow)) return children;
  return (
    <>
      {leadingIcon}
      {children}
      {wantsArrow ? trailingArrow() : null}
    </>
  );
}

/**
 * CTA atom: Sitecore-aware wrapper over the shadcn button primitive.
 * Storybook: pass `link` / `children` / `isEditing` — no Sitecore context required.
 */
export function CtaButton({
  children,
  link,
  fields,
  iconName,
  iconStyle = "solid",
  variant = "default",
  size = "default",
  showArrow,
  asChild,
  className,
  styles,
  id,
  isEditing,
  rendering: _rendering,
  params,
  ...buttonProps
}: CtaButtonProps) {
  const resolvedSize = resolveButtonSize(size);
  const paramIconName =
    iconName ??
    (typeof params?.IconName === "string" ? params.IconName : undefined);
  const paramIconStyle =
    (iconStyle as FaIconStyle | undefined) ??
    (typeof params?.IconStyle === "string"
      ? (params.IconStyle as FaIconStyle)
      : "solid");
  const paramShowArrow =
    showArrow ??
    (params?.ShowArrow as string | boolean | undefined);
  const paramVariant =
    typeof params?.Variant === "string" ? params.Variant : undefined;
  const paramSize =
    typeof params?.Size === "string"
      ? (params.Size as CtaButtonSize)
      : undefined;

  const effectiveVariant = parseButtonVariant(
    paramVariant ??
      (typeof variant === "string" ? variant : undefined) ??
      "default",
  );
  const effectiveSize = resolveButtonSize(paramSize ?? size);
  const leadingIcon = leadingIconNode(paramIconName, paramIconStyle);
  const wantsArrow = isEnabled(paramShowArrow);
  const composedClassName = cn(
    wantsArrow && "group",
    className,
    styles?.trimEnd(),
  );

  const fieldLink = fields?.Link ?? fields?.link;
  const resolvedLink = link ?? fieldLink;

  if (children !== undefined && children !== null) {
    return (
      <PrimitiveButton
        id={id}
        variant={effectiveVariant}
        size={effectiveSize ?? resolvedSize}
        asChild={asChild}
        className={composedClassName}
        {...buttonProps}
      >
        {composeButtonContent({
          asChild,
          children,
          leadingIcon,
          wantsArrow,
        })}
      </PrimitiveButton>
    );
  }

  if (isLinkField(resolvedLink)) {
    return (
      <PrimitiveButton
        id={id}
        variant={effectiveVariant}
        size={effectiveSize ?? resolvedSize}
        className={composedClassName}
        asChild
        {...buttonProps}
      >
        <SitecoreLink
          field={resolvedLink}
          editable={Boolean(isEditing)}
          showLinkTextWithChildrenPresent
        >
          {leadingIcon}
          {wantsArrow ? trailingArrow() : null}
        </SitecoreLink>
      </PrimitiveButton>
    );
  }

  const loose = resolveLooseLink(resolvedLink);
  if (loose) {
    return (
      <PrimitiveButton
        id={id}
        variant={effectiveVariant}
        size={effectiveSize ?? resolvedSize}
        className={composedClassName}
        asChild
        {...buttonProps}
      >
        <a href={loose.href}>
          {leadingIcon}
          {loose.text}
          {wantsArrow ? trailingArrow() : null}
        </a>
      </PrimitiveButton>
    );
  }

  if (isEditing) {
    return (
      <PrimitiveButton
        id={id}
        variant={effectiveVariant}
        size={effectiveSize ?? resolvedSize}
        className={cn(composedClassName, "border-dashed opacity-70")}
        type="button"
        {...buttonProps}
      >
        {leadingIcon}
        Link
        {wantsArrow ? trailingArrow() : null}
      </PrimitiveButton>
    );
  }

  return null;
}

export type SitecoreCtaButtonProps = LibComponentProps & {
  fields?: CtaButtonProps["fields"];
  params?: CtaButtonProps["params"] & {
    Variant?: string;
    Size?: string;
    ShowArrow?: string;
    IconName?: string;
    IconStyle?: string;
  };
  isEditing?: boolean;
};

/**
 * Sitecore component-map entry. Reads editing mode from params when provided;
 * Pages can also wrap with context later.
 */
export const Default = (props: SitecoreCtaButtonProps) => {
  const variant = props.params?.Variant;
  const size = props.params?.Size as CtaButtonSize | undefined;
  return (
    <CtaButton
      {...props}
      variant={variant}
      size={size}
      iconName={props.params?.IconName}
      iconStyle={props.params?.IconStyle}
      showArrow={props.params?.ShowArrow}
      id={props.params?.RenderingIdentifier}
      styles={props.params?.styles}
    />
  );
};

export default CtaButton;

/** Include in both server and client Sitecore component maps. */
export const componentType = "universal";
