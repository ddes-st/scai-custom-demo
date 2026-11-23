"use client";

import * as React from "react";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { useDirection } from "components/hooks/registry/use-direction";

/** Intl-based replacements for the small set of date-fns format strings
 *  Calendar used. Avoids a direct date-fns import from this primitive
 *  even though `react-day-picker` still pulls it transitively — keeps
 *  Calendar's own surface dependency-light. */
const monthShortFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const formatMonthShort = (date: Date) => monthShortFormatter.format(date);
const formatLongDate = (date: Date) => longDateFormatter.format(date);
const formatIsoDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

import {
  type DayButton,
  DayPicker,
  getDefaultClassNames,
} from "react-day-picker";

import {
  Button,
  buttonVariants,
} from "components/registry/primitives/core/button";
import { LibraryIcon } from "components/registry/primitives/core/library-icon";
import { cn } from "components/lib/registry/cn";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();
  const direction = useDirection();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      dir={direction}
      className={cn("p-3", className)}
      captionLayout={captionLayout}
      formatters={{
        // Use deterministic formatting to avoid locale hydration mismatches.
        formatMonthDropdown: (date) => formatMonthShort(date),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit bg-card", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months,
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({
            variant: "ghost",
            colorScheme: "neutral",
            size: "icon",
          }),
          "size-icon bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({
            variant: "ghost",
            colorScheme: "neutral",
            size: "icon",
          }),
          "size-icon bg-transparent p-0 opacity-50 hover:opacity-100 ",
        ),
        month_caption: cn(
          "flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative has-focus:border-ring border px-2 border-input has-focus:ring-ring/50 has-focus:ring-[3px] rounded-md",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "absolute bg-popover inset-0 opacity-0 ps-4 scrollbar-hidden w-full flex justify-center items-center  ",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md ps-2 pe-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-muted-foreground [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        month_grid: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] select-none",
          defaultClassNames.weekday,
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        week_number_header: cn(
          "select-none w-(--cell-size)",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-[0.8rem] select-none text-muted-foreground",
          defaultClassNames.week_number,
        ),
        range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground rounded-s-md rounded-e-none rtl:rounded-s-none rtl:rounded-e-md",
        range_middle:
          "aria-selected:bg-primary-background aria-selected:text-foreground rounded-none",
        range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground rounded-e-md rounded-s-none rtl:rounded-e-none rtl:rounded-s-md",
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          );
        },
        Chevron: ({ className, orientation, ...props }) => {
          const isRtl = direction === "rtl";
          if (orientation === "left") {
            return (
              <ThemeIcon
                name={isRtl ? "chevron-right" : "chevron-left"}
                className={cn("size-4 text-neutral", className)}
                {...props}
              />
            );
          }

          if (orientation === "right") {
            return (
              <ThemeIcon
                name={isRtl ? "chevron-left" : "chevron-right"}
                className={cn("size-4 text-neutral", className)}
                {...props}
              />
            );
          }
          return (
            <LibraryIcon
              name="chevron-down"
              className={cn("size-4", className)}
            />
          );
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-(--cell-size) items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label={`Select ${formatLongDate(day.date)}`}
      data-day={formatIsoDate(day.date)}
      data-selected={modifiers.selected ? "true" : "false"}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      aria-pressed={modifiers.selected || false}
      className={cn(
        buttonVariants({ variant: "ghost", colorScheme: "neutral" }),
        "size-8 rounded-md border border-transparent border-solid p-0 font-normal text-foreground transition-none hover:rounded-md",
        !modifiers.selected &&
          !modifiers.range_start &&
          !modifiers.range_end &&
          !modifiers.range_middle &&
          "hover:bg-primary hover:text-inverse-text",
        modifiers.selected &&
          !modifiers.range_start &&
          !modifiers.range_end &&
          !modifiers.range_middle &&
          "rounded-s-md bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        modifiers.range_start &&
          "rounded-s-md rounded-e-none bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rtl:rounded-s-none rtl:rounded-e-md",
        modifiers.range_middle &&
          "rounded-none bg-primary-background text-primary hover:bg-primary hover:text-primary-foreground",
        modifiers.range_end &&
          "rounded-s-none rounded-e-md bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rtl:rounded-s-md rtl:rounded-e-none",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
