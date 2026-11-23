import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "components/lib/registry/cn";

const buttonVariants = cva(
  [
    // Layout & Sizing
    "inline-flex items-center justify-center",
    "gap-2 whitespace-nowrap",
    "shrink-0",

    // Typography. Weight routes through the `--button-weight` chrome
    // token (600 fallback = the historical `font-semibold`) so a theme
    // measured from a source brand can re-weight every button at once.
    "text-base font-[var(--button-weight,600)] text-center leading-none",
    "[font-family:var(--button-font,inherit)]",
    "[text-transform:var(--button-text-transform,none)]",
    "tracking-[var(--button-letter-spacing,normal)]",

    // Anchor-underline defeat. When Button wraps a `<Link>` /
    // `<a>` via `asChild`, the global anchor `text-decoration:
    // underline` and `:hover { underline }` bleed through the Slot
    // composition and visually attach to the button text. Override
    // here so every consumer (alert-banner, accordion, card actions,
    // page-header, etc.) gets a clean button look without having to
    // remember the per-callsite `no-underline hover:no-underline`
    // override. The `link` variant explicitly re-enables hover
    // underline below for its own typographic role.
    "no-underline hover:no-underline",

    // Icon Styles
    "[&_svg]:pointer-events-none",
    "[&_svg]:w-[1.375rem] [&_svg]:h-[1.375rem]",
    "[&_svg]:shrink-0",

    // Interactive States
    "transition-all",
    "cursor-pointer",
    "disabled:pointer-events-none disabled:opacity-50",
    "[box-shadow:var(--button-shadow,none)]",

    // Focus & Validation States
    "outline-none",
    "focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    "aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        // Color-specific classes intentionally live in compoundVariants
        // (one per colorScheme). Base variant classes are kept color-
        // scheme-agnostic so they don't conflict with the compound's
        // theme-aware hover / active tokens (otherwise tailwind-merge
        // may not dedupe `*-600` vs `*-hover` and the wrong class wins).
        default: "",
        outline:
          // 2px border so outline reads with the same visual weight as
          // filled variants — 1px disappeared against light section
          // backgrounds and made the button feel like a plain anchor.
          "border-2 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        ghost: "bg-transparent",
        link: "underline-offset-4 hover:underline leading-normal tracking-normal shadow-none",
      },
      size: {
        default: "h-10 min-w-10 px-4 rounded-[var(--button-radius,999px)]",
        lg: "h-12 min-w-12 px-6 rounded-[var(--button-radius,999px)]",
        sm: "h-8 min-w-8 px-3 rounded-[var(--button-radius,999px)]",
        xs: "h-6 min-w-6 px-2 rounded-[var(--button-radius,999px)] text-xs [&>svg]:!w-[1.178rem] [&>svg]:!h-[1.178rem] pointer-coarse:h-9 pointer-coarse:min-w-9",
        icon: "size-10 rounded-[var(--button-icon-radius,999px)]",
        // New icon-specific sizes
        "icon-lg": "size-12 rounded-[var(--button-icon-radius,999px)]",
        "icon-sm": "size-8 rounded-[var(--button-icon-radius,999px)]",
        "icon-xs":
          "size-6 rounded-[var(--button-icon-radius,999px)] [&>svg]:!w-[1.178rem] [&>svg]:!h-[1.178rem] pointer-coarse:size-9",
      },
      colorScheme: {
        // `none` = transparent + inherit color. Per-variant compounds
        // below add the variant-specific shaping (e.g. `outline` adds
        // a current-color border).
        none: "",
        // White / black use the theme's white / black tokens
        // (`--color-theme-white` / `--color-theme-black`) — same as
        // the layout `backgroundColor` axis — so flipping a theme's
        // black/white pair re-tones every button that picked them.
        white: "",
        black: "",
        neutral: "",
        primary: "",
        // Gradient schemes use Tailwind gradient utilities directly
        // (not a CSS variable) so they always render regardless of
        // theme. `primary-gradient` runs primary → secondary;
        // `secondary-gradient` runs secondary → accent. Hover lifts
        // brightness instead of re-tinting the gradient — the
        // gradient itself is the brand signal.
        "primary-gradient": "",
        secondary: "",
        "secondary-gradient": "",
        tertiary: "",
        accent: "",
        "accent-2": "",
        "accent-3": "",
        destructive: "",
        success: "",
        warning: "",
        info: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        colorScheme: "primary",
        class:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
      },
      {
        variant: "default",
        colorScheme: "info",
        class:
          "bg-info text-info-foreground hover:bg-info-hover active:bg-info-active",
      },
      {
        variant: "default",
        colorScheme: "success",
        class:
          "bg-success text-success-foreground hover:bg-success-hover active:bg-success-active",
      },
      {
        variant: "default",
        colorScheme: "destructive",
        class:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover active:bg-destructive-active",
      },
      {
        variant: "default",
        colorScheme: "neutral",
        class:
          "bg-neutral text-neutral hover:bg-neutral-hover active:bg-neutral-active",
      },
      {
        // Primary gradient (primary → secondary). Brand-signal CTA.
        // Hover lifts brightness rather than re-tinting the gradient.
        variant: "default",
        colorScheme: "primary-gradient",
        class:
          "bg-gradient-to-br from-primary to-secondary text-primary-foreground hover:brightness-110 active:brightness-95",
      },
      {
        // Secondary gradient (secondary → accent). Companion to
        // primary-gradient for sections where primary is over-used.
        variant: "default",
        colorScheme: "secondary-gradient",
        class:
          "bg-gradient-to-br from-secondary to-accent text-secondary-foreground hover:brightness-110 active:brightness-95",
      },
      {
        // None = transparent fill. Default variant relies on hover
        // alpha for affordance since no border / fill is paintable.
        variant: "default",
        colorScheme: "none",
        class:
          "bg-transparent text-current hover:bg-foreground/5 active:bg-foreground/10",
      },
      {
        // White / black map to the theme's white / black tokens
        // (`bg-theme-white` / `bg-theme-black`) — NOT pure CSS white /
        // black — so theme overrides (off-white papers, soft blacks)
        // carry through. Foreground text uses the paired token for
        // contrast.
        variant: "default",
        colorScheme: "white",
        class:
          "bg-theme-white text-theme-black hover:brightness-95 active:brightness-90",
      },
      {
        variant: "default",
        colorScheme: "black",
        class:
          "bg-theme-black text-theme-white hover:brightness-110 active:brightness-95",
      },
      {
        // Warning was missing from the `default + colorScheme`
        // compound table; picking warning rendered without any
        // fill. Slot it in next to success / destructive so the
        // intent-driven schemes form a consistent set.
        variant: "default",
        colorScheme: "warning",
        class:
          "bg-warning text-warning-foreground hover:bg-warning-hover active:bg-warning-active",
      },
      {
        variant: "default",
        colorScheme: "secondary",
        class:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active",
      },
      {
        variant: "default",
        colorScheme: "tertiary",
        class:
          "bg-tertiary text-tertiary-foreground hover:bg-tertiary-hover active:bg-tertiary-active",
      },
      {
        variant: "default",
        colorScheme: "accent",
        class:
          "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-active",
      },
      {
        variant: "default",
        colorScheme: "accent-2",
        class:
          "bg-accent-2 text-accent-2-foreground hover:bg-accent-2-hover active:bg-accent-2-active",
      },
      {
        variant: "default",
        colorScheme: "accent-3",
        class:
          "bg-accent-3 text-accent-3-foreground hover:bg-accent-3-hover active:bg-accent-3-active",
      },
      {
        variant: "outline",
        colorScheme: "primary",
        class:
          "border text-primary hover:bg-primary-background hover:text-primary active:bg-primary-background-active",
      },
      {
        variant: "outline",
        colorScheme: "success",
        class:
          "border text-success hover:bg-success-background hover:text-success active:bg-success-background-active",
      },
      {
        variant: "outline",
        colorScheme: "destructive",
        class:
          "border text-destructive hover:bg-destructive-background hover:text-destructive active:bg-destructive-background-active",
      },
      {
        variant: "outline",
        colorScheme: "warning",
        class:
          "border text-warning hover:bg-warning-background hover:text-warning active:bg-warning-background-active",
      },
      {
        variant: "outline",
        colorScheme: "info",
        class:
          "border text-info hover:bg-info-background hover:text-info active:bg-info-background-active",
      },
      {
        // Gradient schemes' non-filled forms paint the border with a
        // gradient and tint the text toward the start color. Tailwind
        // doesn't support gradient borders out-of-the-box, so we
        // approximate with a solid border on the start color +
        // gradient text on hover. Hover/active fills a soft tinted
        // background so the button still feels interactive.
        variant: "outline",
        colorScheme: "primary-gradient",
        class:
          "border text-primary hover:bg-primary-background hover:text-primary active:bg-primary-background-active",
      },
      {
        variant: "outline",
        colorScheme: "secondary-gradient",
        class:
          "border text-secondary hover:bg-secondary-background hover:text-secondary active:bg-secondary-background-active",
      },
      {
        // Outline + none = transparent fill, current-color border +
        // text. Right for an unbranded outline on a colored surface
        // — the button inherits the parent's foreground.
        variant: "outline",
        colorScheme: "none",
        class:
          "border border-current text-current hover:bg-foreground/5 active:bg-foreground/10",
      },
      {
        variant: "outline",
        colorScheme: "white",
        class:
          "border border-theme-white text-theme-white hover:bg-theme-white/10 active:bg-theme-white/20",
      },
      {
        variant: "outline",
        colorScheme: "black",
        class:
          "border border-theme-black text-theme-black hover:bg-theme-black/10 active:bg-theme-black/20",
      },
      {
        variant: "outline",
        colorScheme: "neutral",
        class:
          "border text-foreground hover:bg-neutral-background hover:text-foreground active:bg-neutral-background-active",
      },
      {
        variant: "outline",
        colorScheme: "secondary",
        class:
          "border text-secondary hover:bg-secondary-background hover:text-secondary active:bg-secondary-background-active",
      },
      {
        variant: "outline",
        colorScheme: "tertiary",
        class:
          "border text-tertiary hover:bg-tertiary-background hover:text-tertiary active:bg-tertiary-background-active",
      },
      {
        variant: "outline",
        colorScheme: "accent",
        class:
          "border text-accent hover:bg-accent-background hover:text-accent active:bg-accent-background-active",
      },
      {
        variant: "outline",
        colorScheme: "accent-2",
        class:
          "border text-accent-2 hover:bg-accent-2-background hover:text-accent-2 active:bg-accent-2-background-active",
      },
      {
        variant: "outline",
        colorScheme: "accent-3",
        class:
          "border text-accent-3 hover:bg-accent-3-background hover:text-accent-3 active:bg-accent-3-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "primary",
        class:
          "text-primary hover:bg-primary-background hover:text-primary active:bg-primary-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "success",
        class:
          "text-success hover:bg-success-background hover:text-success active:bg-success-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "destructive",
        class:
          "text-destructive hover:bg-destructive-background hover:text-destructive active:bg-destructive-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "warning",
        class:
          "text-warning hover:bg-warning-background hover:text-warning active:bg-warning-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "info",
        class:
          "text-info hover:bg-info-background hover:text-info active:bg-info-background-active",
      },
      {
        // Gradient schemes in ghost form: text tint matches the
        // start color, hover surfaces a soft background. No gradient
        // text — text-gradient via background-clip is too fragile
        // across browsers + Slot composition.
        variant: "ghost",
        colorScheme: "primary-gradient",
        class:
          "text-primary hover:bg-primary-background hover:text-primary active:bg-primary-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "secondary-gradient",
        class:
          "text-secondary hover:bg-secondary-background hover:text-secondary active:bg-secondary-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "none",
        class: "text-current hover:bg-foreground/5 active:bg-foreground/10",
      },
      {
        variant: "ghost",
        colorScheme: "white",
        class:
          "text-theme-white hover:bg-theme-white/10 active:bg-theme-white/20",
      },
      {
        variant: "ghost",
        colorScheme: "black",
        class:
          "text-theme-black hover:bg-theme-black/10 active:bg-theme-black/20",
      },
      {
        variant: "ghost",
        colorScheme: "neutral",
        class:
          "text-foreground hover:bg-neutral-background hover:text-foreground active:bg-neutral-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "secondary",
        class:
          "text-secondary hover:bg-secondary-background hover:text-secondary active:bg-secondary-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "tertiary",
        class:
          "text-tertiary hover:bg-tertiary-background hover:text-tertiary active:bg-tertiary-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "accent",
        class:
          "text-accent hover:bg-accent-background hover:text-accent active:bg-accent-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "accent-2",
        class:
          "text-accent-2 hover:bg-accent-2-background hover:text-accent-2 active:bg-accent-2-background-active",
      },
      {
        variant: "ghost",
        colorScheme: "accent-3",
        class:
          "text-accent-3 hover:bg-accent-3-background hover:text-accent-3 active:bg-accent-3-background-active",
      },
      {
        variant: "link",
        colorScheme: "primary",
        class: "text-primary active:text-primary-700",
      },
      {
        variant: "link",
        colorScheme: "success",
        class: "text-success active:text-success-700",
      },
      {
        variant: "link",
        colorScheme: "destructive",
        class: "text-destructive active:text-destructive-700",
      },
      {
        variant: "link",
        colorScheme: "warning",
        class: "text-warning active:text-warning-700",
      },
      {
        variant: "link",
        colorScheme: "info",
        class: "text-info active:text-info-700",
      },
      {
        // Gradient schemes as link: text tint matches the start
        // color. (Gradient text via background-clip would conflict
        // with the link variant's hover-underline treatment.)
        variant: "link",
        colorScheme: "primary-gradient",
        class: "text-primary active:text-primary-700",
      },
      {
        variant: "link",
        colorScheme: "secondary-gradient",
        class: "text-secondary active:text-secondary-700",
      },
      {
        variant: "link",
        colorScheme: "none",
        class: "text-current",
      },
      {
        variant: "link",
        colorScheme: "white",
        class: "text-theme-white",
      },
      {
        variant: "link",
        colorScheme: "black",
        class: "text-theme-black",
      },
      {
        variant: "link",
        colorScheme: "neutral",
        class: "text-neutral active:text-neutral-700",
      },
      {
        variant: "link",
        colorScheme: "secondary",
        class: "text-secondary active:text-secondary-700",
      },
      {
        variant: "link",
        colorScheme: "tertiary",
        class: "text-tertiary active:text-tertiary-700",
      },
      {
        variant: "link",
        colorScheme: "accent",
        class: "text-accent active:text-accent-700",
      },
      {
        variant: "link",
        colorScheme: "accent-2",
        class: "text-accent-2 active:text-accent-2-700",
      },
      {
        variant: "link",
        colorScheme: "accent-3",
        class: "text-accent-3 active:text-accent-3-700",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      colorScheme: "primary",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(function Button(
  { className, variant, size, colorScheme, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  let resolvedColorSchemeFinal = colorScheme;

  if (!colorScheme) {
    switch (variant) {
      case "default":
      case "link":
        resolvedColorSchemeFinal = "primary";
        break;
      case "outline":
      case "ghost":
        resolvedColorSchemeFinal = "neutral";
        break;
      default:
        resolvedColorSchemeFinal = "primary";
    }
  }

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant ?? "default"}
      data-color-scheme={resolvedColorSchemeFinal}
      data-size={size ?? "default"}
      className={cn(
        buttonVariants({
          variant,
          size,
          colorScheme: resolvedColorSchemeFinal,
          className,
        }),
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
