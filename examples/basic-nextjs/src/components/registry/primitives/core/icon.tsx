import { cva, type VariantProps } from "class-variance-authority";
import type { SVGProps } from "react";
import { cn } from "components/lib/registry/cn";

const iconVariants = cva("inline-flex items-center justify-center", {
  variants: {
    variant: {
      default: "",
      subtle: "p-1 rounded-md bg-primary-background",
      filled: "p-1 rounded-md",
    },
    colorScheme: {
      primary: "text-primary",
      neutral: "text-neutral",
      success: "text-success",
      destructive: "text-destructive",
      warning: "text-warning",
      yellow:
        "text-[var(--color-yellow-800)] dark:text-[var(--color-yellow-200)]",
      teal: "text-[var(--color-teal-800)] dark:text-[var(--color-teal-200)]",
      cyan: "text-[var(--color-cyan-800)] dark:text-[var(--color-cyan-200)]",
      blue: "text-[var(--color-blue-800)] dark:text-[var(--color-blue-200)]",
      purple: "text-info",
      pink: "text-[var(--color-pink-800)] dark:text-[var(--color-pink-200)]",
    },
  },
  compoundVariants: [
    {
      variant: "subtle",
      colorScheme: "primary",
      class: "bg-primary-background",
    },
    {
      variant: "subtle",
      colorScheme: "neutral",
      class: "bg-neutral-background",
    },
    {
      variant: "subtle",
      colorScheme: "success",
      class: "bg-success-background",
    },
    {
      variant: "subtle",
      colorScheme: "destructive",
      class: "bg-destructive-background",
    },
    {
      variant: "subtle",
      colorScheme: "warning",
      class: "bg-warning-background",
    },
    {
      variant: "subtle",
      colorScheme: "yellow",
      class: "bg-[var(--color-yellow-100)] dark:bg-[var(--color-yellow-800)]",
    },
    {
      variant: "subtle",
      colorScheme: "teal",
      class: "bg-[var(--color-teal-100)] dark:bg-[var(--color-teal-800)]",
    },
    {
      variant: "subtle",
      colorScheme: "cyan",
      class: "bg-[var(--color-cyan-100)] dark:bg-[var(--color-cyan-800)]",
    },
    {
      variant: "subtle",
      colorScheme: "blue",
      class: "bg-[var(--color-blue-100)] dark:bg-[var(--color-blue-800)]",
    },
    {
      variant: "subtle",
      colorScheme: "purple",
      class: "bg-info-background",
    },
    {
      variant: "subtle",
      colorScheme: "pink",
      class: "bg-[var(--color-pink-100)] dark:bg-[var(--color-pink-800)]",
    },
    {
      variant: "filled",
      colorScheme: "primary",
      class: "bg-primary text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "neutral",
      class: "bg-neutral text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "success",
      class: "bg-success text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "destructive",
      class: "bg-destructive text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "warning",
      class: "bg-warning text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "yellow",
      class:
        "bg-[var(--color-yellow-800)] dark:bg-[var(--color-yellow-200)] text-background",
    },
    {
      variant: "filled",
      colorScheme: "teal",
      class:
        "bg-[var(--color-teal-800)] dark:bg-[var(--color-teal-200)] text-background",
    },
    {
      variant: "filled",
      colorScheme: "cyan",
      class:
        "bg-[var(--color-cyan-800)] dark:bg-[var(--color-cyan-200)] text-background",
    },
    {
      variant: "filled",
      colorScheme: "blue",
      class:
        "bg-[var(--color-blue-800)] dark:bg-[var(--color-blue-200)] text-background",
    },
    {
      variant: "filled",
      colorScheme: "purple",
      class: "bg-info text-inverse-text",
    },
    {
      variant: "filled",
      colorScheme: "pink",
      class:
        "bg-[var(--color-pink-800)] dark:bg-[var(--color-pink-200)] text-background",
    },
  ],
  defaultVariants: {
    variant: "default",
    colorScheme: "primary",
  },
});

const iconSize = {
  default: "size-6",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
  xl: "size-9",
  xxl: "size-11",
} as const;

type IconSizeValue = keyof typeof iconSize | number | string;

type IconsProps = SVGProps<SVGSVGElement> & {
  path: string;
  title?: string;
  fill?: string;
  className?: string;
  svgClassName?: string;
  size?: IconSizeValue;
} & VariantProps<typeof iconVariants>;

function Icon({
  path,
  title,
  variant,
  size = "default",
  colorScheme,
  className,
  svgClassName,
  fill = "currentColor",
  width,
  height,
  style,
  ...props
}: IconsProps) {
  const isNamedSize = typeof size === "string" && Object.hasOwn(iconSize, size);
  const hasVariantProps = variant !== undefined || colorScheme !== undefined;
  const resolvedSvgClassName = cn(
    isNamedSize ? iconSize[size as keyof typeof iconSize] : undefined,
    !hasVariantProps ? className : undefined,
    svgClassName,
  );
  const resolvedStyle =
    !isNamedSize && size != null
      ? { ...style, transform: `scale(${size})` }
      : style;
  const ariaLabel =
    typeof title === "string" && title.trim().length > 0 ? title : undefined;
  const isDecorative = ariaLabel == null;

  return (
    <span
      data-slot="icon"
      data-variant={variant ?? "default"}
      data-color-scheme={colorScheme ?? "primary"}
      className={cn(iconVariants({ variant, colorScheme }), className)}
    >
      <svg
        viewBox="0 0 24 24"
        aria-label={ariaLabel}
        aria-hidden={isDecorative}
        width={isNamedSize ? undefined : (width ?? "1em")}
        height={isNamedSize ? undefined : (height ?? "1em")}
        className={resolvedSvgClassName}
        fill={fill}
        style={resolvedStyle}
        {...props}
      >
        {ariaLabel ? <title>{ariaLabel}</title> : null}
        <path d={path} />
      </svg>
    </span>
  );
}

export { Icon, iconVariants };
