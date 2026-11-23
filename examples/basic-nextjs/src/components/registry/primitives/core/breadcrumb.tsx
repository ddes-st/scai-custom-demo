import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "components/registry/primitives/core/dropdown-menu";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { Link } from "components/registry/primitives/editables/link";
import { cn } from "components/lib/registry/cn";
import type {
  HTMLLink,
  LinkField,
  LinkFieldValue,
} from "components/lib/registry/sitecore";

const Breadcrumb = React.forwardRef<
  React.ElementRef<"nav">,
  React.ComponentPropsWithoutRef<"nav">
>(({ className, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    data-slot="breadcrumb"
    className={cn(className)}
    {...props}
  />
));
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<
  React.ElementRef<"ol">,
  React.ComponentPropsWithoutRef<"ol">
>(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    data-slot="breadcrumb-list"
    className={cn(
      "wrap-break-word flex flex-wrap items-center gap-1.5 text-muted-foreground text-sm sm:gap-2.5",
      className,
    )}
    {...props}
  />
));
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<
  React.ElementRef<"li">,
  React.ComponentPropsWithoutRef<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-slot="breadcrumb-item"
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
));
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
    field?: LinkField | LinkFieldValue | HTMLLink;
  }
>(({ asChild, className, field, children, ...props }, ref) => {
  if (field) {
    return (
      <Link
        ref={ref}
        data-slot="breadcrumb-link"
        value={field as LinkField}
        className={cn("transition-colors hover:text-foreground", className)}
        {...props}
      >
        {children}
      </Link>
    );
  }

  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      data-slot="breadcrumb-link"
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    >
      {children}
    </Comp>
  );
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="breadcrumb-page"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props}
  />
));
BreadcrumbPage.displayName = "BreadcrumbPage";

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("inline-flex items-center [&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? (
        <ThemeIcon
          name="chevron-right"
          className="h-3.5 w-3.5 rtl:rotate-180"
        />
      )}
    </li>
  );
}

const BreadcrumbEllipsis = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="breadcrumb-ellipsis"
    role="presentation"
    aria-hidden="true"
    className={cn("flex size-9 items-center justify-center", className)}
    {...props}
  >
    <ThemeIcon name="dots-horizontal" className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
));
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";

export type BreadcrumbNavItem = { id: string; label: string; href: string };

/**
 * Trail-length treatment for `BreadcrumbNav`:
 *
 *   responsive  container-query driven (default) — narrow containers show
 *               first item + ellipsis dropdown + current page; wide
 *               containers expand to the full ancestor trail.
 *   full        the "long" breadcrumb — every ancestor is always visible,
 *               no ellipsis at any width.
 *   shortened   always collapsed — first item, ellipsis dropdown holding
 *               every other ancestor, current page.
 */
export type BreadcrumbTrailStyle = "responsive" | "full" | "shortened";

/**
 * Separator glyph between crumbs. `chevron` is the ThemeIcon default
 * baked into `BreadcrumbSeparator`; the text glyphs mirror the
 * separator vocabulary used elsewhere in the registry (link-list's
 * InlineSeparated row).
 */
export type BreadcrumbSeparatorGlyph = "chevron" | "slash" | "dot" | "pipe";

const SEPARATOR_TEXT_GLYPHS: Record<
  Exclude<BreadcrumbSeparatorGlyph, "chevron">,
  string
> = {
  slash: "/",
  dot: "·",
  pipe: "|",
};

/**
 * `BreadcrumbSeparator` renders its ThemeIcon chevron when children are
 * absent; the text glyphs ship as children.
 */
function separatorGlyphChildren(
  glyph: BreadcrumbSeparatorGlyph,
): React.ReactNode {
  if (glyph === "chevron") return undefined;
  return <span className="select-none">{SEPARATOR_TEXT_GLYPHS[glyph]}</span>;
}

type BreadcrumbNavProps = {
  items: BreadcrumbNavItem[];
  currentPage: string;
  className?: string;
  id?: string;
  /** Render a link for each ancestor; default is <a href={...}>{children}</a> */
  renderLink?: (
    item: BreadcrumbNavItem,
    children: React.ReactNode,
  ) => React.ReactElement;
  /** Long vs shortened vs container-query responsive trail. Default "responsive". */
  trailStyle?: BreadcrumbTrailStyle;
  /** Separator glyph between crumbs. Default "chevron". */
  separator?: BreadcrumbSeparatorGlyph;
  /** Show the home icon on the first crumb. Default true. */
  showHomeIcon?: boolean;
  /** Render the unlinked current-page crumb at the end. Default true. */
  showCurrentPage?: boolean;
};

/**
 * Composed breadcrumb trail over the primitive parts. Trail length is
 * driven by `trailStyle`: "responsive" (default) collapses intermediate
 * ancestors into an ellipsis dropdown on narrow containers and expands
 * on wide ones; "full" always shows every ancestor; "shortened" always
 * collapses to first + ellipsis + current. Separator glyph, home icon,
 * and the current-page crumb are each independently configurable.
 */
function BreadcrumbNav({
  items,
  currentPage,
  className,
  id,
  renderLink,
  trailStyle = "responsive",
  separator = "chevron",
  showHomeIcon = true,
  showCurrentPage = true,
}: BreadcrumbNavProps) {
  const [home, ...rest] = items;
  const intermediate = rest.slice(0, -1);
  const lastAncestor = rest.length ? rest[rest.length - 1] : undefined;
  const dropdownAncestors = rest;

  // Which structural slots render for this trail style. In "shortened"
  // the inline ancestor slots never render; in "full" the ellipsis
  // slot never renders. "responsive" renders both and lets container
  // queries arbitrate visibility.
  const showEllipsisSlot = trailStyle !== "full" && rest.length > 0;
  const showInlineAncestors = trailStyle !== "shortened";
  const hasIntermediate = showInlineAncestors && intermediate.length > 0;
  const hasLastAncestor = showInlineAncestors && Boolean(lastAncestor);
  const responsive = trailStyle === "responsive";
  // Visibility classes only apply in responsive mode; the fixed modes
  // simply render (or skip) each slot unconditionally.
  const ellipsisVisibility = responsive ? "@[1240px]:hidden" : undefined;
  const intermediateVisibility = responsive
    ? "hidden @[1240px]:inline-flex"
    : undefined;
  const lastAncestorVisibility = responsive
    ? "hidden @[820px]:inline-flex"
    : undefined;

  const hasCurrent = showCurrentPage && Boolean(currentPage);
  const separatorChildren = separatorGlyphChildren(separator);

  const defaultLink = (item: BreadcrumbNavItem, children: React.ReactNode) => (
    <a href={item.href}>{children}</a>
  );
  const link = renderLink ?? defaultLink;

  // Whether anything renders after the home slot / the ellipsis slot —
  // drives trailing-separator suppression when the current-page crumb
  // is hidden.
  const somethingAfterHome =
    showEllipsisSlot || hasIntermediate || hasLastAncestor || hasCurrent;
  const somethingAfterEllipsis =
    hasIntermediate || hasLastAncestor || hasCurrent;

  return (
    <Breadcrumb id={id} className={cn("w-full", className)}>
      <BreadcrumbList className="w-full py-2 text-foreground">
        {home && (
          <>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink
                className="flex items-center gap-2 whitespace-nowrap"
                title={home.label}
              >
                {link(
                  home,
                  <>
                    {showHomeIcon && (
                      <ThemeIcon
                        name="home"
                        className="size-4 text-foreground"
                        aria-label="Home"
                      />
                    )}
                    <span>{home.label}</span>
                  </>,
                )}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {somethingAfterHome && (
              <BreadcrumbSeparator>{separatorChildren}</BreadcrumbSeparator>
            )}
          </>
        )}

        {showEllipsisSlot && (
          <>
            <BreadcrumbItem className={cn("shrink-0", ellipsisVisibility)}>
              <DropdownMenu>
                <DropdownMenuTrigger render={<button type="button" className="flex items-center" />}><BreadcrumbEllipsis /><span className="sr-only">Open breadcrumb menu</span></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {dropdownAncestors.map((ancestor) => (
                    <DropdownMenuItem key={ancestor.id}>
                      {link(ancestor, ancestor.label)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            {somethingAfterEllipsis && (
              <BreadcrumbSeparator className={cn(ellipsisVisibility)}>
                {separatorChildren}
              </BreadcrumbSeparator>
            )}
          </>
        )}

        {hasIntermediate &&
          intermediate.map((ancestor) => (
            <React.Fragment key={ancestor.id}>
              <BreadcrumbItem
                className={cn("shrink-0", intermediateVisibility)}
              >
                <BreadcrumbLink
                  className="whitespace-nowrap"
                  title={ancestor.label}
                >
                  {link(ancestor, ancestor.label)}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className={cn(intermediateVisibility)}>
                {separatorChildren}
              </BreadcrumbSeparator>
            </React.Fragment>
          ))}

        {hasLastAncestor && lastAncestor && (
          <>
            <BreadcrumbItem className={cn("shrink-0", lastAncestorVisibility)}>
              <BreadcrumbLink
                className="whitespace-nowrap"
                title={lastAncestor.label}
              >
                {link(lastAncestor, lastAncestor.label)}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {hasCurrent && (
              <BreadcrumbSeparator className={cn(lastAncestorVisibility)}>
                {separatorChildren}
              </BreadcrumbSeparator>
            )}
          </>
        )}

        {hasCurrent && (
          <BreadcrumbItem className="min-w-0 flex-1">
            <BreadcrumbPage className="truncate" title={currentPage}>
              {currentPage}
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbNav,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
