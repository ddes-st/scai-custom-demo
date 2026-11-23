import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

const badgeVariants = cva(
  // Corner radius routes through the `--badge-radius` chrome token
  // (mirroring Button's `--button-radius` and Card's `--card-radius`)
  // so a theme can re-shape every badge at once. Fallback chain:
  // theme token → foundation `--radius-md` → hard 0.375rem.
  "inline-flex items-center justify-center rounded-[var(--badge-radius,var(--radius-md,0.375rem))] w-fit whitespace-nowrap shrink-0 leading-none gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden wrap-break-word",
  {
    variants: {
      variant: {
        default: "font-normal",
        bold: "uppercase font-bold",
        outline: "border border-border bg-transparent text-foreground",
        rounded: "rounded-full font-normal",
        "rounded-bold": "rounded-full uppercase font-bold",
      },
      size: {
        xs: "h-4 px-1.5 text-[10px]",
        sm: "h-5 px-2 text-xs",
        md: "h-6 px-2.5 text-sm",
        lg: "h-7 px-3 text-sm",
        xl: "h-8 px-3.5 text-base",
      },
      colorScheme: {
        // Cross-component scheme parity with `color-scheme@1`.
        // `none` = transparent + current color (right for inline
        // chip-on-colored-surface). `white` / `black` lean on
        // `bg-theme-{white,black}` so theme overrides flow through.
        // Gradient schemes paint the badge with the matching CTA
        // gradient — same pair Button uses.
        none: "bg-transparent text-current",
        white: "bg-theme-white text-theme-black",
        black: "bg-theme-black text-theme-white",
        neutral: "bg-neutral-background text-neutral",
        primary: "bg-primary-background text-primary",
        "primary-gradient":
          "bg-gradient-to-br from-primary to-secondary text-primary-foreground",
        secondary: "bg-secondary-background text-secondary",
        "secondary-gradient":
          "bg-gradient-to-br from-secondary to-accent text-secondary-foreground",
        tertiary: "bg-tertiary-background text-tertiary",
        accent: "bg-accent-background text-accent",
        "accent-2": "bg-accent-2-background text-accent-2",
        "accent-3": "bg-accent-3-background text-accent-3",
        info: "bg-info-background text-info",
        destructive: "bg-destructive-background text-destructive",
        success: "bg-success-background text-success",
        warning: "bg-warning-background text-warning",
        yellow:
          "bg-[var(--color-yellow-100)] text-[var(--color-yellow-800)] dark:bg-[var(--color-yellow-800)] dark:text-[var(--color-yellow-200)]",
        teal: "bg-[var(--color-teal-100)] text-[var(--color-teal-800)] dark:bg-[var(--color-teal-800)] dark:text-[var(--color-teal-200)]",
        cyan: "bg-[var(--color-cyan-100)] text-[var(--color-cyan-800)] dark:bg-[var(--color-cyan-800)] dark:text-[var(--color-cyan-200)]",
        blue: "bg-[var(--color-blue-100)] text-[var(--color-blue-800)] dark:bg-[var(--color-blue-800)] dark:text-[var(--color-blue-200)]",
        pink: "bg-[var(--color-pink-100)] text-[var(--color-pink-800)] dark:bg-[var(--color-pink-800)] dark:text-[var(--color-pink-200)]",
      },
      // Style axis (badge-style@1): `pill` is the classic filled chip
      // (everything above, unchanged); `eyebrow` is the editorial
      // eyebrow treatment — text-only in the role color, uppercase,
      // letter-spaced. Typography mirrors blocks/eyebrow.tsx's text
      // mode EXACTLY (font-medium + uppercase + tracking-[0.16em];
      // text size stays on the `size` axis, whose `md` default is the
      // eyebrow's text-sm) so a badge eyebrow reads identically to the
      // promo / article-header eyebrows. Declared AFTER `colorScheme`
      // so its bg/height/padding overrides win in tailwind-merge.
      badgeStyle: {
        pill: "",
        eyebrow:
          "h-auto rounded-none border-0 bg-transparent px-0 font-medium uppercase tracking-[0.16em]",
      },
    },
    compoundVariants: [
      // Eyebrow × gradient schemes: the chip form paints a gradient
      // background-image, which `bg-transparent` alone can't clear
      // (different tw-merge group) — clear it with bg-none and tint
      // the text toward the start color, mirroring blocks/eyebrow.tsx.
      {
        badgeStyle: "eyebrow",
        colorScheme: "primary-gradient",
        class: "bg-none text-primary",
      },
      {
        badgeStyle: "eyebrow",
        colorScheme: "secondary-gradient",
        class: "bg-none text-secondary",
      },
      // Eyebrow × white/black: the chip pairing puts the scheme on the
      // BACKGROUND (bg-theme-white + black text); text-only eyebrows
      // want the scheme as the TEXT color instead.
      {
        badgeStyle: "eyebrow",
        colorScheme: "white",
        class: "text-theme-white",
      },
      {
        badgeStyle: "eyebrow",
        colorScheme: "black",
        class: "text-theme-black",
      },
      // Eyebrow × neutral/none: the quiet default — inherit the
      // surface foreground at reduced opacity (blocks/eyebrow.tsx's
      // unset/neutral treatment) instead of a gray chip pairing.
      {
        badgeStyle: "eyebrow",
        colorScheme: "neutral",
        class: "text-current opacity-70",
      },
      {
        badgeStyle: "eyebrow",
        colorScheme: "none",
        class: "text-current opacity-70",
      },
    ],
    defaultVariants: {
      colorScheme: "neutral",
      size: "md",
      variant: "default",
      badgeStyle: "pill",
    },
  },
);

function Badge({
  className,
  variant,
  colorScheme,
  size = "md",
  badgeStyle = "pill",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  // Eyebrow keeps the colorScheme pairing even on `outline` (the
  // border is stripped by the eyebrow class anyway); the chip form's
  // outline variant stays scheme-less as before.
  const resolvedColorScheme =
    variant === "outline" && badgeStyle !== "eyebrow" ? null : colorScheme;

  return (
    <Comp
      data-slot="badge"
      data-variant={variant ?? "default"}
      data-size={size ?? "md"}
      data-color-scheme={colorScheme ?? "neutral"}
      data-badge-style={badgeStyle ?? "pill"}
      className={cn(
        badgeVariants({
          variant,
          colorScheme: resolvedColorScheme,
          size,
          badgeStyle,
        }),
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
