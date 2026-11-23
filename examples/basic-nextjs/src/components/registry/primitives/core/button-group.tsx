import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { Button } from "components/registry/primitives/core/button";
import { cn } from "components/lib/registry/cn";

function ButtonGroup({
  className,
  variant = "default",
  appearance = "default",
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "rounded";
  /** When "outline", the group has the outer border (and rounded corners); items only render dividers. Use with outline ButtonGroupItem variant. */
  appearance?: "default" | "outline";
  /** Flow direction. "vertical" stacks children with no rounded-corner adjustments — mostly a typed accept for shadcn-shaped consumers. */
  orientation?: "horizontal" | "vertical";
}) {
  const variantClassName =
    variant === "rounded"
      ? "rounded-full"
      : "rounded-[var(--button-radius,999px)]";

  return (
    // biome-ignore lint/a11y/useSemanticElements: a button cluster is an ARIA "group"; <fieldset> implies form-field grouping that does not apply here.
    <div
      data-slot="button-group"
      role="group"
      data-variant={variant}
      data-appearance={appearance}
      dir="inherit"
      className={cn(
        "group/button-group inline-flex items-center overflow-hidden",
        orientation === "vertical" && "flex-col",
        variantClassName,
        appearance === "outline" && "border border-border dark:border-input",
        className,
      )}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  asChild,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="button-group-text"
      className={cn(
        "inline-flex items-center px-3 text-muted-foreground text-sm",
        className,
      )}
      {...props}
    />
  );
}

function ButtonGroupItem({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="button-group-item"
      variant={variant}
      size={size}
      className={cn(
        "rounded-none! px-4 shadow-none",
        "first:rounded-s-(--button-radius,999px)! first:rounded-e-0!",
        "last:rounded-s-0! last:rounded-e-(--button-radius,999px)!",
        "group-data-[variant=rounded]/button-group:first:rounded-s-full! group-data-[variant=rounded]/button-group:first:rounded-e-0!",
        "group-data-[variant=rounded]/button-group:last:rounded-s-0! group-data-[variant=rounded]/button-group:last:rounded-e-full!",
        // Outline appearance: group has outer border; items get an
        // inline-end divider that auto-flips under RTL via the logical
        // `border-e` utility. The previous physical `border-r!` +
        // `rtl:border-l!` pair did the same thing manually — collapsed
        // here now that the Tailwind v4 rtl variant is registered.
        "group-data-[appearance=outline]/button-group:border-0!",
        "group-data-[appearance=outline]/button-group:first:border-s-0!",
        "group-data-[appearance=outline]/button-group:last:border-e-0!",
        "group-data-[appearance=outline]/button-group:ms-0",
        "group-data-[appearance=outline]/button-group:border-border group-data-[appearance=outline]/button-group:border-e! group-data-[appearance=outline]/button-group:dark:border-input",
        "-ms-px first:ms-0",
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupItem, ButtonGroupText };
