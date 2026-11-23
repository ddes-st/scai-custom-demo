import * as React from "react";
import { cn } from "components/lib/registry/cn";
import type { Field } from "components/lib/registry/sitecore";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> & { field?: Field<string> }
>(function Input(
  { className, type, field, value, defaultValue, ...props },
  ref,
) {
  const resolvedDefaultValue = defaultValue ?? field?.value;
  const isControlled = value !== undefined;

  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      value={value}
      defaultValue={isControlled ? undefined : resolvedDefaultValue}
      className={cn(
        "flex h-[var(--input-height,2.5rem)] w-full min-w-0 rounded-[var(--input-radius,var(--radius-md))] border bg-(--input-background,var(--color-background)) px-[var(--input-padding-x,0.75rem)] py-1 text-(--input-foreground,var(--color-foreground)) text-base outline-none transition-[color] [box-shadow:var(--input-shadow,none)] selection:bg-primary selection:text-inverse-text file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-(--input-placeholder,var(--color-muted-foreground)) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled,0.5)] md:text-sm",
        "border-(--input-border,var(--color-border)) [border-width:var(--input-border-width,1px)]",
        "focus-visible:border-primary",
        "focus:border-primary focus:ring-1 focus:ring-primary aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
