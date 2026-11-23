"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";
import { Button } from "components/registry/primitives/core/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "components/registry/primitives/core/dialog";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { cn } from "components/lib/registry/cn";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0">
        <Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group]]:px-2 **:[[cmdk-input]]:h-12 **:[[cmdk-item]]:px-2">
          {children}
          <DialogPrimitive.Close style={{ display: "none" }} />
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  const [value, setValue] = React.useState("");

  const handleClear = () => {
    setValue("");
  };

  return (
    <div data-slot="command-input-wrapper" className="relative my-2 px-3">
      <CommandPrimitive.Input
        value={value}
        onValueChange={setValue}
        data-slot="command-input"
        aria-label={props["aria-label"] || "Search commands"}
        className={cn(
          "flex h-8 w-full min-w-0 rounded-sm border bg-background py-1 ps-10 pe-10 text-base outline-none transition-[color,box-shadow] selection:bg-primary selection:text-inverse-text file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "rounded-md border font-regular text-base placeholder-blackAlpha-400 focus:border",
          className,
        )}
        {...props}
      />
      <ThemeIcon
        name="search"
        className="absolute start-4 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 opacity-50"
      />
      {value && (
        <Button
          onClick={handleClear}
          variant="ghost"
          size="icon"
          colorScheme="neutral"
          aria-label="Clear search"
          className="absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
        >
          <ThemeIcon name="x" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "scrollbar-end-side max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden",
        className,
      )}
      {...props}
    >
      <div className="scrollbar-end-side-content">{props.children}</div>
    </CommandPrimitive.List>
  );
}

function CommandEmpty({
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:text-xs",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      // Decorative divider only. cmdk forces role="separator", which is an
      // illegal child of the command list's role="listbox"
      // (axe aria-required-children, critical) — hide it from the a11y tree so
      // the listbox exposes only options/groups.
      aria-hidden="true"
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-[var(--menu-item-radius,var(--radius-sm))] px-[var(--menu-item-padding-x,0.5rem)] py-[var(--menu-item-padding-y,0.375rem)] text-sm outline-hidden data-[disabled=true]:pointer-events-none data-[selected=true]:bg-(--menu-item-background-selected,var(--color-neutral-background)) data-[selected=true]:text-(--menu-item-foreground-focus,var(--color-foreground)) data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ms-auto text-muted-foreground text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
