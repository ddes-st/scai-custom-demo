"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

const switchVariants = cva(
  "peer data-[state=unchecked]:bg-(--control-switch-track,var(--color-muted)) focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-muted/80 inline-flex shrink-0 cursor-pointer items-center justify-start rtl:justify-end rounded-full border border-border transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        primary:
          "data-[state=checked]:bg-(--control-switch-track-checked,var(--color-primary))",
        destructive: "data-[state=checked]:bg-destructive",
        success: "data-[state=checked]:bg-success",
      },
      size: {
        sm: "h-4 w-7",
        default: "h-5 w-8",
        lg: "h-6 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

const switchThumbVariants = cva(
  "bg-(--control-switch-thumb,var(--color-background)) dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-foreground pointer-events-none block rounded-full ring-0 transition-transform data-[state=unchecked]:translate-x-0",
  {
    variants: {
      size: {
        sm: "size-3 data-[state=checked]:translate-x-3.5",
        default: "size-4 data-[state=checked]:translate-x-3.5",
        lg: "size-5 data-[state=checked]:translate-x-5.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Switch({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> &
  VariantProps<typeof switchVariants>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-variant={variant ?? "primary"}
      data-size={size ?? "default"}
      className={cn(switchVariants({ variant, size, className }))}
      aria-label={
        props["aria-label"] || props["aria-labelledby"]
          ? undefined
          : "Toggle switch"
      }
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(switchThumbVariants({ size }))}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch, switchVariants };
