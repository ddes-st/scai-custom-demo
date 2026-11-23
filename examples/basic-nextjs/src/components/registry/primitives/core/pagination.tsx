import type * as React from "react";

import {
  type Button,
  buttonVariants,
} from "components/registry/primitives/core/button";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { Link } from "components/registry/primitives/editables/link";
import { cn } from "components/lib/registry/cn";
import type {
  HTMLLink,
  LinkField,
  LinkFieldValue,
} from "components/lib/registry/sitecore";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkBaseProps = {
  isActive?: boolean;
  field?: LinkField | LinkFieldValue | HTMLLink;
  styleVariant?: "default" | "minimal";
  as?: "a" | "button";
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  Omit<React.ComponentProps<"a">, "type"> &
  React.ComponentProps<"button">;

function PaginationLink({
  className,
  isActive,
  size = "icon",
  field,
  styleVariant = "default",
  as = "a",
  ...props
}: PaginationLinkBaseProps) {
  const sharedProps = {
    "aria-current": isActive ? "page" : undefined,
    "data-slot": "pagination-link",
    "data-active": isActive,
    className: cn(
      buttonVariants({
        colorScheme: "neutral",
        size,
      }),
      styleVariant === "minimal"
        ? "shadow-none rounded-md border-0 bg-transparent px-2 text-neutral font-medium hover:bg-transparent active:bg-transparent"
        : "shadow-none rounded-md text-neutral bg-transparent disabled:text-neutral/40 font-medium hover:bg-neutral-background active:bg-primary-background",
      isActive
        ? styleVariant === "minimal"
          ? "bg-transparent text-foreground font-semibold"
          : "bg-primary-background text-neutral hover:bg-primary-background active:bg-primary-background font-medium"
        : undefined,
      className,
    ),
  } as const;

  if (field && as !== "button") {
    const { value: _value, ...anchorProps } =
      props as React.ComponentProps<"a"> & {
        value?: unknown;
      };
    void _value;
    return (
      <Link value={field as LinkField} {...sharedProps} {...anchorProps} />
    );
  }

  if (as === "button") {
    const buttonProps = props as React.ComponentProps<"button">;
    return <button type="button" {...sharedProps} {...buttonProps} />;
  }

  return <a {...sharedProps} {...(props as React.ComponentProps<"a">)} />;
}

type PaginationNavProps = React.ComponentProps<typeof PaginationLink> & {
  showLabel?: boolean;
  showIcon?: boolean;
  label?: string;
};

function PaginationPrevious({
  className,
  showLabel = false,
  showIcon = true,
  label = "Previous",
  ...props
}: PaginationNavProps) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size={showLabel ? "default" : "icon"}
      className={cn("gap-1 px-2.5 sm:ps-2.5", className)}
      {...props}
    >
      {showIcon ? (
        <ThemeIcon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
      ) : null}
      {showLabel ? <span>{label}</span> : null}
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  showLabel = false,
  showIcon = true,
  label = "Next",
  ...props
}: PaginationNavProps) {
  const labelNode = showLabel ? <span>{label}</span> : null;
  const iconNode = showIcon ? (
    <ThemeIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
  ) : null;

  return (
    <PaginationLink
      aria-label="Go to next page"
      size={showLabel ? "default" : "icon"}
      className={cn("gap-1 px-2.5 sm:pe-2.5", className)}
      {...props}
    >
      {showLabel && showIcon ? (
        <>
          {labelNode}
          {iconNode}
        </>
      ) : (
        <>
          {iconNode}
          {labelNode}
        </>
      )}
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-9 items-center justify-center text-neutral",
        className,
      )}
      {...props}
    >
      <ThemeIcon name="dots-horizontal" className="h-3 w-3" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
