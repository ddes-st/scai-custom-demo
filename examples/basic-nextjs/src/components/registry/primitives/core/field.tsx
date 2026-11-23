import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "components/lib/registry/cn";

// FieldSet - Container that renders a semantic fieldset
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="fieldset"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

// FieldLegend - Legend element for a FieldSet
const fieldLegendVariants = cva("", {
  variants: {
    variant: {
      legend: "text-lg font-semibold",
      label: "text-base font-medium",
    },
  },
  defaultVariants: {
    variant: "legend",
  },
});

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & VariantProps<typeof fieldLegendVariants>) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(fieldLegendVariants({ variant }), className)}
      {...props}
    />
  );
}

// FieldGroup - Layout wrapper that stacks Field components
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "@container/field-group mt-5 flex flex-col gap-3",
        className,
      )}
      {...props}
    />
  );
}

// Field - Core wrapper for a single field
const fieldVariants = cva("flex gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col gap-2.5",
      horizontal: "flex-row items-start gap-4",
      responsive:
        "flex-col gap-2.5 @md/field-group:flex-row @md/field-group:items-start @md/field-group:gap-4",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

function Field({
  className,
  orientation = "vertical",
  "data-invalid": dataInvalid,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    "data-invalid"?: boolean;
  }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: flexible field-grouping primitive; <fieldset> imposes form-field semantics and UA styling the variant system does not expect.
    <div
      data-slot="field"
      role="group"
      data-orientation={orientation}
      data-invalid={dataInvalid}
      className={cn(
        "group/field",
        fieldVariants({ orientation }),
        dataInvalid &&
          "data-[invalid=true]:[&_input]:border-destructive data-[invalid=true]:[&_select]:border-destructive data-[invalid=true]:[&_textarea]:border-destructive",
        "data-[orientation=horizontal]:**:data-[slot=input]:flex-1 data-[orientation=horizontal]:**:data-[slot=select-trigger]:flex-1 data-[orientation=horizontal]:**:data-[slot=textarea]:flex-1",
        "@md/field-group:data-[orientation=responsive]:**:data-[slot=input]:flex-1 @md/field-group:data-[orientation=responsive]:**:data-[slot=select-trigger]:flex-1 @md/field-group:data-[orientation=responsive]:**:data-[slot=textarea]:flex-1",
        className,
      )}
      {...props}
    />
  );
}

// FieldContent - Flex column that groups label and description
function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "flex min-w-0 flex-col gap-1",
        "group-data-[orientation=horizontal]/field:w-48 group-data-[orientation=horizontal]/field:shrink-0 group-data-[orientation=horizontal]/field:pt-1",
        "@md/field-group:group-data-[orientation=responsive]/field:w-48 @md/field-group:group-data-[orientation=responsive]/field:shrink-0 @md/field-group:group-data-[orientation=responsive]/field:pt-1",
        className,
      )}
      {...props}
    />
  );
}

// FieldLabel - Label styled for form fields. Consumers must pass
// `htmlFor` (or wrap a control inside) to associate the label with its
// input. The primitive itself can't statically guarantee that — it's a
// generic wrapper.
function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor / nested control is the consumer's responsibility (see JSDoc above)
    <label
      data-slot="field-label"
      className={cn(
        "flex select-none items-center gap-2 font-medium text-base text-neutral leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

// FieldTitle - Renders a title with label styling inside FieldContent
function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-title"
      className={cn("font-medium text-base", className)}
      {...props}
    />
  );
}

// FieldDescription - Helper text slot
function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-description"
      className={cn("-mt-1 text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

// FieldSeparator - Visual divider to separate sections
function FieldSeparator({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  if (children) {
    return (
      <div
        data-slot="field-separator"
        className={cn(
          "relative flex items-center gap-2 py-4",
          "before:flex-1 before:border-border before:border-t",
          "after:flex-1 after:border-border after:border-t",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      data-slot="field-separator"
      className={cn("border-border border-t", className)}
      {...props}
    />
  );
}

// FieldError - Accessible error container
function FieldError({
  className,
  errors,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const errorMessages = errors?.filter(Boolean) || [];
  const errorText = errorMessages.map(
    (error) => error?.message ?? "Unknown error",
  );

  if (errorMessages.length === 0 && !children) {
    return null;
  }

  return (
    <div
      data-slot="field-error"
      role="alert"
      aria-live="polite"
      className={cn("-mt-1 text-destructive text-sm", className)}
      {...props}
    >
      {children ||
        (errorMessages.length === 1 ? (
          <span>{errorMessages[0]?.message}</span>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {errorText.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
