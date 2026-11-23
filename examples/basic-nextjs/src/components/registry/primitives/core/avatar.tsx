"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type * as React from "react";

import { Card } from "components/registry/primitives/core/card";
import { cn } from "components/lib/registry/cn";

const avatarSizes = {
  sm: "size-8",
  default: "size-10",
  lg: "size-12",
} as const;

function Avatar({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: keyof typeof avatarSizes;
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className="relative inline-flex shrink-0 rounded-full"
      {...props}
    >
      <Card
        elevation="none"
        style="flat"
        padding="sm"
        className={cn(
          "flex flex-row gap-0 overflow-hidden rounded-full bg-transparent p-0",
          avatarSizes[size],
          className,
        )}
      >
        {children}
      </Card>
    </AvatarPrimitive.Root>
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute -end-0.5 -bottom-0.5 flex size-3 items-center justify-center rounded-full border-2 border-background bg-primary",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "flex items-center -space-x-2 **:data-[slot=avatar]:ring-2 **:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-group-count"
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs ring-2 ring-background",
        className,
      )}
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
