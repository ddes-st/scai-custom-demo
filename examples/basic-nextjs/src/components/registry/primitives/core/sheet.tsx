"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import type * as React from "react";
import { buttonVariants } from "components/registry/primitives/core/button";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { cn } from "components/lib/registry/cn";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-(--color-overlay,rgba(0,0,0,0.5)) data-[state=closed]:animate-out data-[state=open]:animate-in",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "end",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "bottom" | "start" | "end";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-(--drawer-background,var(--color-background)) transition ease-in-out [box-shadow:var(--drawer-shadow,var(--shadow-lg))] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500",
          // Inline-end sheet: positioning auto-flips via `end-0` +
          // `border-s`. tw-animate-css has no logical slide utilities,
          // so the slide direction uses an `ltr:` / `rtl:` pair so the
          // sheet always animates in from the edge it lands on.
          side === "end" && [
            "inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm",
            "ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right",
            "rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left",
          ],
          side === "start" && [
            "inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm",
            "ltr:data-[state=closed]:slide-out-to-left ltr:data-[state=open]:slide-in-from-left",
            "rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right",
          ],
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className={cn(
            buttonVariants({
              variant: "ghost",
              colorScheme: "neutral",
              size: "icon",
            }),
            "absolute end-4 top-2.5 opacity-70 transition-opacity hover:opacity-100",
          )}
        >
          <ThemeIcon name="x" className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex justify-end gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
