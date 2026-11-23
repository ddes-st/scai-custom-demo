"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

const tabsListVariants = cva(
  "inline-flex h-9 w-fit items-center justify-center",
  {
    variants: {
      variant: {
        line: "",
        "soft-rounded": "",
        segmented: "h-10 rounded-lg bg-muted p-1",
      },
    },
    defaultVariants: {
      variant: "line",
    },
  },
);

const tabsTriggerVariants = cva(
  "inline-flex h-9 items-center justify-center gap-1.5 text-base font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        line: "text-(--tabs-inactive-foreground,var(--color-neutral)) data-[state=active]:text-(--tabs-active-foreground,var(--color-primary)) [border-bottom-width:var(--tabs-indicator-thickness,2px)] border-border data-[state=active]:[border-bottom-color:var(--tabs-indicator-color,var(--color-primary))] hover:cursor-pointer px-4",
        "soft-rounded":
          "text-neutral data-[state=active]:text-primary data-[state=active]:bg-primary-background hover:cursor-pointer px-4 rounded-[9999px]",
        // Selected = a raised neutral pill (bg-background) lifting off the
        // bg-muted track via elevation, with the brand primary as the text
        // accent. Earlier this was bg-primary-background (a primary-50 tint)
        // on the neutral-100 track — near-identical lightness, so the
        // selected tab barely read on light themes. Contrast now comes from
        // the surface step + shadow, not a same-lightness hue.
        segmented:
          "h-8 text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-background hover:cursor-pointer px-3 rounded-[var(--tabs-radius,var(--radius-md))] data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "line",
    },
  },
);

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant ?? "line"}
      className={cn(tabsListVariants({ variant, className }))}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant ?? "line"}
      className={cn(tabsTriggerVariants({ variant, className }))}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
