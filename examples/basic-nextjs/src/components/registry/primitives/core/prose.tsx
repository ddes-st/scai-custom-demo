import type * as React from "react";

import { cn } from "components/lib/registry/cn";

/**
 * Wrapper for rich text / long-form content. Provides a consistent container
 * and optional typography styling so blocks can use a primitive instead of a plain div.
 */
function Prose({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="prose"
      className={cn(
        "[&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-accent",
        className,
      )}
      {...props}
    />
  );
}

export { Prose };
