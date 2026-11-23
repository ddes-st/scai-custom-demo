import * as React from "react";
import { cn } from "components/lib/registry/cn";
import type { Field } from "components/lib/registry/sitecore";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea"> & { field?: Field<string> }
>(function Textarea({ className, field, value, defaultValue, ...props }, ref) {
  const resolvedDefaultValue = defaultValue ?? field?.value;
  const isControlled = value !== undefined;

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      value={value}
      defaultValue={isControlled ? undefined : resolvedDefaultValue}
      className={cn(
        "flex min-h-16 w-full rounded-(--radius-md,0.5rem) border bg-(--input-background,var(--color-background)) px-3 py-2 text-base outline-none transition-[color] placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus-visible:border-primary focus-visible:ring-[1px] focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive md:text-sm dark:aria-invalid:ring-destructive/40",
        "border-(--input-border,var(--color-border)) [border-width:var(--input-border-width,1px)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
