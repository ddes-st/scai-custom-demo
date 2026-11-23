"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type * as React from "react";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";

import { cn } from "components/lib/registry/cn";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // 16px on fine pointers (mouse/trackpad) where pixel-tight
        // hit areas are fine; bumped to 24px on coarse pointers
        // (touch) so the tap target is closer to the WCAG 2.5.5
        // 44px-min recommendation. Surrounding labels typically
        // extend the active area further.
        "peer pointer-coarse:size-6 size-[var(--control-size,1rem)] shrink-0 rounded-[var(--control-radius,0.25rem)] border border-input outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-(--control-checked-background,var(--color-primary)) data-[state=checked]:text-(--control-checked-foreground,var(--color-primary-foreground)) dark:bg-input/30 dark:data-[state=checked]:bg-(--control-checked-background,var(--color-primary)) dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex size-full items-center justify-center text-current"
      >
        <ThemeIcon name="check" className="h-3 w-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
