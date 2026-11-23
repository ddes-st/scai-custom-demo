"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { buttonVariants } from "components/registry/primitives/core/button";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { cn } from "components/lib/registry/cn";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}
Dialog.displayName = "Dialog";

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}
DialogTrigger.displayName = "DialogTrigger";

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}
DialogPortal.displayName = "DialogPortal";

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      data-dialog-close
      {...props}
    />
  );
}
DialogClose.displayName = "DialogClose";

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[var(--z-overlay,50)] bg-(--color-overlay,rgba(0,0,0,0.5)) [backdrop-filter:blur(var(--overlay-backdrop-blur,0px))] data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      {...props}
    />
  );
}

interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: DialogContentProps) {
  const sizeClasses: Record<NonNullable<DialogContentProps["size"]>, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "w-screen h-dvh max-w-none max-h-none rounded-none p-0",
  };

  function hasCloseButton(node: React.ReactNode): boolean {
    let found = false;

    React.Children.forEach(node, (child) => {
      if (found) return;

      if (React.isValidElement(child) && child.props != null) {
        const props = child.props as Record<string, unknown>;
        if (props["data-dialog-close"] === true) {
          found = true;
          return;
        }
        if (typeof props === "object" && "children" in props) {
          found = hasCloseButton(props.children as React.ReactNode);
        }
      }
    });

    return found;
  }

  const hasCustomCloseButton = hasCloseButton(children);

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[var(--z-modal,50)] flex items-center justify-center",
          size !== "full" && "p-4",
        )}
      >
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 pointer-events-auto grid w-full gap-4 border-solid bg-(--modal-background,var(--color-background)) text-(--modal-foreground,var(--color-foreground)) duration-200 [border-color:var(--modal-border,var(--color-border))] [border-width:var(--modal-border-width,0px)] [box-shadow:var(--modal-shadow,var(--shadow-lg))] data-[state=closed]:animate-out data-[state=open]:animate-in",
            size === "full"
              ? sizeClasses[size]
              : "max-w-[calc(100%-2rem)] rounded-[var(--modal-radius,var(--radius-lg))] px-[var(--modal-padding-x,1.75rem)] py-[var(--modal-padding-y,1.25rem)]",
            size !== "full" && sizeClasses[size],
            className,
          )}
          {...props}
        >
          {children}

          {!hasCustomCloseButton && (
            <DialogPrimitive.Close
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  colorScheme: "neutral",
                }),
                "absolute end-4 top-2.5 min-w-0 opacity-70 transition-opacity hover:opacity-100",
              )}
            >
              <ThemeIcon name="x" className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </div>
    </DialogPortal>
  );
}
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-start", className)}
      {...props}
    />
  );
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 pt-5 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("pb-5 font-semibold text-lg leading-none", className)}
      {...props}
    />
  );
}
DialogTitle.displayName = "DialogTitle";

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
