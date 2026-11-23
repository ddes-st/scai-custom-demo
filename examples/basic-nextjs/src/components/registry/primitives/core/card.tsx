import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

const cardVariants = cva(
  // Background defaults to TRANSPARENT so cards layer cleanly inside
  // colored bands / heros / dark sections. Theming opts back in via
  // the `--card-background` CSS variable when a per-tenant surface
  // fill is wanted, or via the `filled` / `colorScheme` variants
  // below. The previous fallback to `--color-background` rendered as
  // a hard white slab over every dark/branded section.
  //
  // Border WIDTH routes through the `--card-border-width` chrome token
  // (1px fallback = the historical `border` utility) so a theme can
  // express bordered-not-shadowed cards (>=1px + `--card-border`) as
  // well as truly borderless shadow-only cards (0). `border-[length:…]`
  // (not the `[border-width:…]` arbitrary property) keeps the class in
  // tailwind-merge's border-width group so consumer `border-0` /
  // `border-2` overrides still win. Internal dividers (CardHeader/
  // CardFooter `[.border-b]` / `[.border-t]`, consumer `divide-*` rows)
  // carry their own explicit utilities and are intentionally NOT tied
  // to this token — width 0 removes card chrome, not content dividers.
  "flex flex-col gap-6 rounded-[var(--card-radius,var(--radius-lg,0.75rem))] border-[length:var(--card-border-width,1px)] border-[color:var(--card-border,var(--color-border))] bg-[var(--card-background,transparent)] transition-shadow",
  {
    variants: {
      elevation: {
        theme: "shadow-[var(--card-shadow,none)]",
        none: "shadow-none",
        xs: "shadow-xs",
        sm: "shadow-sm",
        base: "shadow-base",
        md: "shadow-md",
        lg: "shadow-lg",
      },
      style: {
        flat: "border-transparent",
        // Outline cards use the border as their colorScheme *signal*,
        // so a theme that zeroes `--card-border-width` (borderless
        // shadow-only chrome) must not erase it — clamp to min 1px
        // while still following wider themed borders.
        outline: "border-[length:max(1px,var(--card-border-width,1px))]",
        filled: "bg-[var(--card-muted-background)] border-transparent",
        // Elevated: an OPAQUE, raised "paper" panel that is decoupled
        // from the band/page background (`--card-elevated-background`)
        // plus a real shadow — the surface stands off ANY band (light,
        // tinted, or a dark `.surface-invert` section) instead of
        // inheriting the band fill. `shadow-md` is declared after the
        // `elevation` variant's shadow so it wins in tailwind-merge (an
        // elevated card is always raised regardless of its `elevation`
        // value). Text keeps inheriting the ambient/`--card-foreground`
        // colour, which the surface tokens are tuned to stay legible on.
        elevated:
          "bg-[var(--card-elevated-background)] border-transparent shadow-md",
        // Surfaceless: force a transparent background (overriding any
        // theme `--card-background`), no border, no shadow — pure content
        // on the section background. Replaces the retired `bare`
        // appearance preset; the shadow-none wins the elevation shadow in
        // tailwind-merge (style is declared after elevation), so a bare
        // card never shows a surface regardless of its elevation value.
        bare: "bg-transparent border-transparent shadow-none",
      },
      padding: {
        sm: "px-3 py-3",
        md: "px-5 py-5",
        lg: "px-7 py-7",
      },
      // Drives the outline border color when `style=outline` (and any
      // future scheme-tinted card affordances). For `flat` / `filled`
      // the border is `transparent` regardless of scheme, so this only
      // visibly affects outline cards.
      colorScheme: {
        none: "",
        white: "",
        black: "",
        neutral: "",
        primary: "",
        "primary-gradient": "",
        secondary: "",
        "secondary-gradient": "",
        tertiary: "",
        accent: "",
        "accent-2": "",
        "accent-3": "",
        info: "",
        success: "",
        warning: "",
        destructive: "",
      },
    },
    compoundVariants: [
      // Outline cards consume the scheme for the border color. Pale
      // tint background stays whatever `--card-background` resolves to
      // — the saturated stroke does the colorScheme signaling.
      { style: "outline", colorScheme: "primary", class: "border-primary" },
      {
        style: "outline",
        colorScheme: "secondary",
        class: "border-secondary",
      },
      {
        style: "outline",
        colorScheme: "tertiary",
        class: "border-tertiary",
      },
      {
        style: "outline",
        colorScheme: "accent",
        class: "border-accent",
      },
      {
        style: "outline",
        colorScheme: "accent-2",
        class: "border-accent-2",
      },
      {
        style: "outline",
        colorScheme: "accent-3",
        class: "border-accent-3",
      },
      {
        style: "outline",
        colorScheme: "info",
        class: "border-info",
      },
      {
        style: "outline",
        colorScheme: "success",
        class: "border-success",
      },
      {
        style: "outline",
        colorScheme: "warning",
        class: "border-warning",
      },
      {
        style: "outline",
        colorScheme: "destructive",
        class: "border-destructive",
      },
      // neutral keeps the default `--card-border` token (matches the
      // base class set on the card root).

      // Filled cards override the muted-bg default with the
      // colorScheme's `--{scheme}-background` pale tint (same token
      // alert-banner uses). Foreground text uses the scheme's
      // saturated color so prose reads on the tint. `neutral` keeps
      // the muted bg + default foreground (no override needed).
      // Each filled tint also applies `surface-tinted` (globals.css)
      // so nested muted text/panels re-derive from the role color
      // instead of clashing gray-on-tint.
      {
        style: "filled",
        colorScheme: "primary",
        class:
          "bg-primary-background text-primary surface-tinted [--surface-tint:var(--color-primary)]",
      },
      {
        style: "filled",
        colorScheme: "secondary",
        class:
          "bg-secondary-background text-secondary surface-tinted [--surface-tint:var(--color-secondary)]",
      },
      {
        style: "filled",
        colorScheme: "tertiary",
        class:
          "bg-tertiary-background text-tertiary surface-tinted [--surface-tint:var(--color-tertiary)]",
      },
      {
        style: "filled",
        colorScheme: "accent",
        class:
          "bg-accent-background text-accent surface-tinted [--surface-tint:var(--color-accent)]",
      },
      {
        style: "filled",
        colorScheme: "accent-2",
        class:
          "bg-accent-2-background text-accent-2 surface-tinted [--surface-tint:var(--color-accent-2)]",
      },
      {
        style: "filled",
        colorScheme: "accent-3",
        class:
          "bg-accent-3-background text-accent-3 surface-tinted [--surface-tint:var(--color-accent-3)]",
      },
      {
        style: "filled",
        colorScheme: "info",
        class:
          "bg-info-background text-info surface-tinted [--surface-tint:var(--color-info)]",
      },
      {
        style: "filled",
        colorScheme: "success",
        class:
          "bg-success-background text-success surface-tinted [--surface-tint:var(--color-success)]",
      },
      {
        style: "filled",
        colorScheme: "warning",
        class:
          "bg-warning-background text-warning surface-tinted [--surface-tint:var(--color-warning)]",
      },
      {
        style: "filled",
        colorScheme: "destructive",
        class:
          "bg-destructive-background text-destructive surface-tinted [--surface-tint:var(--color-destructive)]",
      },
      // Outline cards for the new schemes — none uses current color
      // so the outline always reads against the surrounding surface;
      // white / black use the theme tokens; gradients fall back to
      // their start color for the stroke since gradient borders
      // aren't natively supported.
      {
        style: "outline",
        colorScheme: "none",
        class: "border-current",
      },
      {
        style: "outline",
        colorScheme: "white",
        class: "border-theme-white",
      },
      {
        style: "outline",
        colorScheme: "black",
        class: "border-theme-black",
      },
      {
        style: "outline",
        colorScheme: "primary-gradient",
        class: "border-primary",
      },
      {
        style: "outline",
        colorScheme: "secondary-gradient",
        class: "border-secondary",
      },
      // Flat cards keep a transparent border and the theme's own
      // `--card-background` surface, so the scheme can't tint a border
      // or a fill — instead it tints the TITLE (role text on the page
      // surface, a legal role composition). This gives flat cards a
      // visible colorScheme affordance: pick `accent` on a flat card
      // and the heading carries the accent color. `neutral` stays the
      // unstyled default; gradients tint with their start color.
      {
        style: "flat",
        colorScheme: "primary",
        class: "[&_[data-slot=card-title]]:text-primary",
      },
      {
        style: "flat",
        colorScheme: "primary-gradient",
        class: "[&_[data-slot=card-title]]:text-primary",
      },
      {
        style: "flat",
        colorScheme: "secondary",
        class: "[&_[data-slot=card-title]]:text-secondary",
      },
      {
        style: "flat",
        colorScheme: "secondary-gradient",
        class: "[&_[data-slot=card-title]]:text-secondary",
      },
      {
        style: "flat",
        colorScheme: "tertiary",
        class: "[&_[data-slot=card-title]]:text-tertiary",
      },
      {
        style: "flat",
        colorScheme: "accent",
        class: "[&_[data-slot=card-title]]:text-accent",
      },
      {
        style: "flat",
        colorScheme: "accent-2",
        class: "[&_[data-slot=card-title]]:text-accent-2",
      },
      {
        style: "flat",
        colorScheme: "accent-3",
        class: "[&_[data-slot=card-title]]:text-accent-3",
      },
      {
        style: "flat",
        colorScheme: "info",
        class: "[&_[data-slot=card-title]]:text-info",
      },
      {
        style: "flat",
        colorScheme: "success",
        class: "[&_[data-slot=card-title]]:text-success",
      },
      {
        style: "flat",
        colorScheme: "warning",
        class: "[&_[data-slot=card-title]]:text-warning",
      },
      {
        style: "flat",
        colorScheme: "destructive",
        class: "[&_[data-slot=card-title]]:text-destructive",
      },
      // Filled cards for the new schemes.
      {
        style: "filled",
        colorScheme: "none",
        class: "bg-transparent",
      },
      {
        style: "filled",
        colorScheme: "white",
        class: "bg-theme-white text-theme-black",
      },
      {
        style: "filled",
        colorScheme: "black",
        class: "bg-theme-black text-theme-white",
      },
      {
        style: "filled",
        colorScheme: "primary-gradient",
        class:
          "bg-gradient-to-br from-primary to-secondary text-primary-foreground",
      },
      {
        style: "filled",
        colorScheme: "secondary-gradient",
        class:
          "bg-gradient-to-br from-secondary to-accent text-secondary-foreground",
      },
    ],
    defaultVariants: {
      elevation: "theme",
      style: "flat",
      padding: "lg",
      colorScheme: "neutral",
    },
  },
);

function Card({
  className,
  elevation,
  style,
  padding,
  colorScheme,
  ...props
}: // `style` is a cva *variant* here (flat/outline/filled → `data-style`),
// not the DOM inline-style prop. Omit the native `style` so it doesn't
// intersect with `CSSProperties` (which produces the impossible type
// `CSSProperties & "flat"` and breaks every consumer of
// `ComponentProps<typeof Card>["style"]`). The component already
// destructures `style` out and never forwards it to the div, so this
// only tightens the type to match real behavior.
Omit<React.ComponentProps<"div">, "style"> &
  VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-elevation={elevation ?? "theme"}
      data-style={style ?? "flat"}
      data-padding={padding ?? "lg"}
      data-color-scheme={colorScheme ?? "neutral"}
      className={cn(
        cardVariants({ elevation, style, padding, colorScheme }),
        className,
      )}
      {...props}
    />
  );
}
Card.displayName = "Card";

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}
CardHeader.displayName = "CardHeader";

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // Titles read as headings, not body copy: default the family to the
        // theme heading font (Boldonse on SYNC, etc.). Overridable per card
        // via `--card-title-font`; falls back to inherit when no heading
        // font is set (default theme, where heading == sans, is unchanged).
        "wrap-break-word font-(--card-title-weight,600) leading-none tracking-(--card-title-tracking,normal) [font-family:var(--card-title-font,var(--font-heading,inherit))]",
        className,
      )}
      {...props}
    />
  );
}
CardTitle.displayName = "CardTitle";

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "wrap-break-word text-(--card-description-color,var(--color-muted-foreground)) text-sm",
        className,
      )}
      {...props}
    />
  );
}
CardDescription.displayName = "CardDescription";

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}
CardAction.displayName = "CardAction";

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("", className)} {...props} />
  );
}
CardContent.displayName = "CardContent";

// Footer surface tint. `none` (default) keeps the footer inheriting the
// card body surface — the historical rendering, byte-identical. A role
// value paints the footer as a soft-tinted band so it can read as a
// distinct region under the card content (e.g. a muted/branded footer
// band, the "Södra card" treatment). Saturated roles use the legal
// soft-surface composition (`bg-<X>-background` + `text-<X>`) so the
// band re-themes with the brand; `muted` is the shadcn quiet surface;
// `neutral` uses the neutral soft-surface pair. Never a hardcoded hex —
// every value resolves to a theme token.
const cardFooterVariants = cva("flex items-center [.border-t]:pt-6", {
  variants: {
    surface: {
      none: "",
      muted: "bg-muted text-muted-foreground",
      neutral: "bg-neutral-background text-neutral",
      primary: "bg-primary-background text-primary",
      secondary: "bg-secondary-background text-secondary",
      tertiary: "bg-tertiary-background text-tertiary",
      accent: "bg-accent-background text-accent",
      "accent-2": "bg-accent-2-background text-accent-2",
      "accent-3": "bg-accent-3-background text-accent-3",
      info: "bg-info-background text-info",
      success: "bg-success-background text-success",
      warning: "bg-warning-background text-warning",
      destructive: "bg-destructive-background text-destructive",
    },
  },
  defaultVariants: {
    surface: "none",
  },
});

function CardFooter({
  className,
  surface,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardFooterVariants>) {
  return (
    <div
      data-slot="card-footer"
      data-footer-surface={surface ?? "none"}
      className={cn(cardFooterVariants({ surface }), className)}
      {...props}
    />
  );
}
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
