import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { cn } from "components/lib/registry/cn";

const alertVariants = cva(
  "relative w-full rounded-md px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>span]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-4 has-[>span]:gap-x-4 gap-y-0.5 items-center [&>svg]:size-4 [&>span]:size-4 [&>svg]:text-current [&>span]:text-current",
  {
    variants: {
      variant: {
        default:
          "surface-tinted [--surface-tint:var(--color-primary)] bg-primary-background text-primary [&>svg]:text-primary-500 dark:[&>svg]:text-primary-200 [&>span]:text-primary-500 dark:[&>span]:text-primary-200",
        primary:
          "surface-tinted [--surface-tint:var(--color-primary)] bg-primary-background text-primary [&>svg]:text-primary-500 dark:[&>svg]:text-primary-200 [&>span]:text-primary-500 dark:[&>span]:text-primary-200",
        secondary:
          "surface-tinted [--surface-tint:var(--color-secondary)] bg-secondary-background text-secondary [&>svg]:text-secondary-500 dark:[&>svg]:text-secondary-200 [&>span]:text-secondary-500 dark:[&>span]:text-secondary-200",
        tertiary:
          "surface-tinted [--surface-tint:var(--color-tertiary)] bg-tertiary-background text-tertiary [&>svg]:text-tertiary-500 dark:[&>svg]:text-tertiary-200 [&>span]:text-tertiary-500 dark:[&>span]:text-tertiary-200",
        accent:
          "surface-tinted [--surface-tint:var(--color-accent)] bg-accent-background text-accent [&>svg]:text-accent-500 dark:[&>svg]:text-accent-200 [&>span]:text-accent-500 dark:[&>span]:text-accent-200",
        "accent-2":
          "surface-tinted [--surface-tint:var(--color-accent-2)] bg-accent-2-background text-accent-2 [&>svg]:text-accent-2-500 dark:[&>svg]:text-accent-2-200 [&>span]:text-accent-2-500 dark:[&>span]:text-accent-2-200",
        "accent-3":
          "surface-tinted [--surface-tint:var(--color-accent-3)] bg-accent-3-background text-accent-3 [&>svg]:text-accent-3-500 dark:[&>svg]:text-accent-3-200 [&>span]:text-accent-3-500 dark:[&>span]:text-accent-3-200",
        neutral:
          "surface-tinted [--surface-tint:var(--color-neutral)] bg-neutral-background text-neutral [&>svg]:text-neutral-500 dark:[&>svg]:text-neutral-200 [&>span]:text-neutral-500 dark:[&>span]:text-neutral-200",
        info: "surface-tinted [--surface-tint:var(--color-info)] bg-info-background text-info [&>svg]:text-info-500 dark:[&>svg]:text-info-200 [&>span]:text-info-500 dark:[&>span]:text-info-200",
        // None / white / black for cross-component scheme parity.
        // None inherits foreground, white/black ride the theme tokens.
        none: "bg-transparent text-current [&>svg]:text-current [&>span]:text-current",
        white:
          "bg-theme-white text-theme-black [&>svg]:text-theme-black [&>span]:text-theme-black",
        black:
          "bg-theme-black text-theme-white [&>svg]:text-theme-white [&>span]:text-theme-white",
        // Primary / secondary gradient — used by AI assistant surfaces.
        "primary-gradient":
          "bg-gradient-to-br from-primary to-secondary text-primary-foreground [&>svg]:text-primary-foreground [&>span]:text-primary-foreground",
        "secondary-gradient":
          "bg-gradient-to-br from-secondary to-accent text-secondary-foreground [&>svg]:text-secondary-foreground [&>span]:text-secondary-foreground",
        destructive:
          "surface-tinted [--surface-tint:var(--color-destructive)] bg-destructive-background text-destructive [&>svg]:text-destructive-500 dark:[&>svg]:text-destructive-200 [&>span]:text-destructive-500 dark:[&>span]:text-destructive-200",
        warning:
          "surface-tinted [--surface-tint:var(--color-warning)] bg-warning-background text-warning [&>svg]:text-warning-500 dark:[&>svg]:text-warning-200 [&>span]:text-warning-500 dark:[&>span]:text-warning-200",
        success:
          "surface-tinted [--surface-tint:var(--color-success)] bg-success-background text-success [&>svg]:text-success-500 dark:[&>svg]:text-success-200 [&>span]:text-success-500 dark:[&>span]:text-success-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Icon mapping per variant. Semantic feedback schemes get unique icons
// (info/check/warning/alert); brand-accent schemes fall back to the
// generic "info" icon — color carries the meaning, the icon is just
// decorative.
const variantIcons = {
  default: "info",
  primary: "info",
  secondary: "info",
  tertiary: "info",
  accent: "info",
  "accent-2": "info",
  "accent-3": "info",
  neutral: "info",
  info: "info",
  none: "info",
  white: "info",
  black: "info",
  "primary-gradient": "info",
  "secondary-gradient": "info",
  destructive: "alert",
  warning: "warning",
  success: "check",
} as const;

type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    showIcon?: boolean;
    iconPath?: string;
  };

function Alert({
  className,
  variant = "default",
  showIcon = true,
  iconPath,
  ...props
}: AlertProps) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {variant && showIcon && (
        <ThemeIcon
          name={(iconPath ?? variantIcons[variant]) as string}
          className="h-4 w-4 text-current"
        />
      )}
      {props.children}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-base [&_p]:leading-relaxed",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
