import type * as React from "react";

import { cn } from "components/lib/registry/cn";

function TypographyH1({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="typography-h1"
      className={cn(
        // `font-heading` (the theme's heading family) needs to ship
        // on the primitive — heading callsites in heros and promos
        // were rendering with the body font because the primitive
        // never pinned the heading family.
        //
        // Weight reads through the `--heading-weight` theme token
        // (fallback 600 = the previous pinned font-semibold) so a
        // theme can set a global heading weight without per-callsite
        // params. Callers can still pass font-* classes to override.
        "scroll-m-20 font-(--heading-weight,600) font-heading text-4xl tracking-tight lg:text-5xl",
        className,
      )}
      {...props}
    />
  );
}

function TypographyH2({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="typography-h2"
      className={cn(
        "scroll-m-20 border-b pb-2 font-(--heading-weight,600) font-heading text-3xl tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function TypographyH3({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="typography-h3"
      className={cn(
        "scroll-m-20 font-(--heading-weight,600) font-heading text-2xl tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function TypographyH4({ className, ...props }: React.ComponentProps<"h4">) {
  return (
    <h4
      data-slot="typography-h4"
      className={cn(
        "scroll-m-20 font-(--heading-weight,600) font-heading text-xl tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function TypographyP({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="typography-p"
      className={cn("not-first:mt-6 leading-7", className)}
      {...props}
    />
  );
}

function TypographyBlockquote({
  className,
  ...props
}: React.ComponentProps<"blockquote">) {
  return (
    <blockquote
      data-slot="typography-blockquote"
      className={cn("mt-6 border-s-2 ps-6 italic", className)}
      {...props}
    />
  );
}

function TypographyList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="typography-list"
      className={cn(
        "[&>li]:wrap-break-word my-6 ms-6 min-w-0 max-w-full list-disc pe-4 [&>li]:mt-2",
        className,
      )}
      {...props}
    />
  );
}

function TypographyInlineCode({
  className,
  ...props
}: React.ComponentProps<"code">) {
  return (
    <code
      data-slot="typography-inline-code"
      className={cn(
        "relative rounded bg-muted-hover px-[0.3rem] py-[0.2rem] font-mono text-sm",
        className,
      )}
      {...props}
    />
  );
}

function TypographyLead({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="typography-lead"
      className={cn("text-muted-foreground text-xl", className)}
      {...props}
    />
  );
}

function TypographyLarge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="typography-large"
      className={cn("font-semibold text-lg", className)}
      {...props}
    />
  );
}

function TypographySmall({
  className,
  ...props
}: React.ComponentProps<"small">) {
  return (
    <small
      data-slot="typography-small"
      className={cn("font-medium text-sm leading-none", className)}
      {...props}
    />
  );
}

function TypographyMuted({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="typography-muted"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function TypographyDisplay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="typography-display"
      className={cn(
        // Display = oversized heading; pin to `font-heading` so the
        // theme's display family flows through without each callsite
        // having to remember to override.
        "font-(--heading-weight,600) font-heading text-2xl tabular-nums tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export {
  TypographyBlockquote,
  TypographyDisplay,
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyInlineCode,
  TypographyLarge,
  TypographyLead,
  TypographyList,
  TypographyMuted,
  TypographyP,
  TypographySmall,
};
