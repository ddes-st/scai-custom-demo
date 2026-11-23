"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

const toggleVariants = cva(
  // on-state uses bg-muted (a dark-aware quiet surface) rather than
  // bg-neutral-background: the latter resolves to the fixed neutral-100
  // scale step in BOTH light and dark, so a selected toggle was a pale
  // patch in dark themes. bg-muted inverts correctly per mode.
  "inline-flex items-center justify-center gap-2 rounded-md text-base font-medium text-muted-foreground hover:bg-muted-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-muted data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        square: "bg-transparent rounded-md",
        rounded: "bg-transparent rounded-full",
      },
      size: {
        sm: "h-8 px-2 min-w-8 text-sm",
        default: "h-9 px-2 min-w-9",
        lg: "h-10 px-3 min-w-10 text-base",
      },
    },
    defaultVariants: {
      variant: "square",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      data-variant={variant ?? "square"}
      data-size={size ?? "default"}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
