"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type * as React from "react";

import { cn } from "components/lib/registry/cn";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const numericValue = typeof value === "number" ? value : 0;
  const normalizedValue = Math.min(100, Math.max(0, numericValue));
  const progressLabel =
    typeof value === "number" ? `Progress: ${normalizedValue}%` : "Progress";

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      aria-label={progressLabel}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full origin-left bg-primary transition-all rtl:origin-right"
        style={{ width: `${normalizedValue}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
