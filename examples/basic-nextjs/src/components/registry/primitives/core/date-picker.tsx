"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  isValid,
  parse,
  startOfDay,
} from "date-fns";
import * as React from "react";
import type { DateRange, DropdownProps } from "react-day-picker";

import { Button } from "components/registry/primitives/core/button";
import { Calendar } from "components/registry/primitives/core/calendar";
import { Input } from "components/registry/primitives/core/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "components/registry/primitives/core/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/registry/primitives/core/select";
import { ThemeIcon } from "components/registry/primitives/core/theme-icon";
import { cn } from "components/lib/registry/cn";
import type { Field } from "components/lib/registry/sitecore";

export function CustomDropdown({
  options = [],
  value,
  onChange,
  disabled,
  name,
  id,
}: DropdownProps) {
  return (
    <Select
      disabled={disabled}
      name={name}
      value={value != null ? String(value) : ""}
      onValueChange={(val) => {
        const e = {
          target: { value: val },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange?.(e);
      }}
    >
      <SelectTrigger
        id={id}
        size="sm"
        className="z-50 bg-transparent px-3 text-sm dark:bg-transparent dark:hover:bg-transparent [&_svg:not([class*='text-'])]:text-accent"
      >
        <SelectValue />
      </SelectTrigger>

      <SelectContent className="borde min-w-20 rounded-md p-0">
        {options.map(({ value: v, label, disabled }) => (
          <SelectItem
            key={String(v)}
            value={String(v)}
            disabled={disabled}
            className="cursor-pointer px-3 py-1.5 text-sm"
          >
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface DatePickerProps {
  selected?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholderText?: string;
  dateFormat?: string;
  minDate?: Date;
  maxDate?: Date;
  showIcon?: boolean;
  inputClassName?: string;
  field?: Field<string>;
}

interface DatePickerNaturalLanguageProps {
  selected?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholderText?: string;
  minDate?: Date;
  maxDate?: Date;
  inputClassName?: string;
  field?: Field<string>;
}

interface DatePickerWithInputProps {
  selected?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholderText?: string;
  minDate?: Date;
  maxDate?: Date;
  inputClassName?: string;
  field?: Field<string>;
}

function buildDisabledMatcher(minDate?: Date, maxDate?: Date) {
  if (minDate && maxDate) return [{ before: minDate }, { after: maxDate }];
  if (minDate) return { before: minDate };
  if (maxDate) return { after: maxDate };
  return undefined;
}

const inputDateFormats = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "M/d/yyyy",
  "MMM d, yyyy",
  "MMMM d, yyyy",
];

function parseDateInput(input: string, baseDate: Date) {
  const value = input.trim();
  if (!value) return null;

  const base = startOfDay(baseDate);
  for (const formatString of inputDateFormats) {
    const parsed = parse(value, formatString, base);
    if (isValid(parsed)) {
      return startOfDay(parsed);
    }
  }

  const fallback = new Date(value);
  return isValid(fallback) ? startOfDay(fallback) : null;
}

function parseNaturalLanguageDate(input: string, baseDate: Date) {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const base = startOfDay(baseDate);

  if (value === "today") return base;
  if (value === "tomorrow") return addDays(base, 1);
  if (value === "yesterday") return addDays(base, -1);

  const nextMatch = value.match(/^next\s+(week|month|year)$/);
  if (nextMatch) {
    switch (nextMatch[1]) {
      case "week":
        return addWeeks(base, 1);
      case "month":
        return addMonths(base, 1);
      case "year":
        return addYears(base, 1);
      default:
        break;
    }
  }

  const inMatch = value.match(
    /^(in\s+)?(\d+)\s+(day|days|week|weeks|month|months|year|years)$/,
  );
  if (inMatch) {
    const amount = Number(inMatch[2]);
    const unit = inMatch[3];
    if (!Number.isNaN(amount)) {
      switch (unit) {
        case "day":
        case "days":
          return addDays(base, amount);
        case "week":
        case "weeks":
          return addWeeks(base, amount);
        case "month":
        case "months":
          return addMonths(base, amount);
        case "year":
        case "years":
          return addYears(base, amount);
        default:
          break;
      }
    }
  }

  for (const formatString of inputDateFormats) {
    const parsed = parse(value, formatString, base);
    if (isValid(parsed)) {
      return startOfDay(parsed);
    }
  }

  const fallback = new Date(value);
  return isValid(fallback) ? startOfDay(fallback) : null;
}

function resolveFieldDate(field?: Field<string>) {
  const value = field?.value;
  if (!value) return null;
  const parsed = new Date(value);
  return isValid(parsed) ? startOfDay(parsed) : null;
}

function DatePicker({
  selected,
  onChange,
  placeholderText = "Pick a date",
  minDate,
  maxDate,
  showIcon,
  inputClassName,
  field,
}: DatePickerProps) {
  const fieldDate = React.useMemo(() => resolveFieldDate(field), [field]);
  const resolvedSelected = selected ?? fieldDate;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant={"outline"} colorScheme={"neutral"} className={cn(
                      "flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=open]:border data-[state=open]:border-primary data-placeholder:text-muted-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='text-'])]:text-muted-foreground",
                      !resolvedSelected && "text-muted-foreground",
                      inputClassName,
                    )} />}><div className="flex items-center gap-2 overflow-hidden">
                      {showIcon && (
                        <ThemeIcon
                          name="calendar"
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                        />
                      )}
                      <span className="truncate">
                        {resolvedSelected ? (
                          format(resolvedSelected, "MMM d, yyyy")
                        ) : (
                          <span>{placeholderText}</span>
                        )}
                      </span>
                    </div><ThemeIcon
                      name="calendar"
                      className="h-4 w-4 shrink-0 text-muted-foreground opacity-0"
                    /></PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={resolvedSelected || undefined}
          onSelect={(date) => onChange?.(date || null)}
          disabled={buildDisabledMatcher(minDate, maxDate)}
          captionLayout="dropdown"
          components={{ Dropdown: CustomDropdown }}
        />
      </PopoverContent>
    </Popover>
  );
}

function DatePickerNaturalLanguage({
  selected,
  onChange,
  placeholderText = 'Try "tomorrow"',
  minDate,
  maxDate,
  inputClassName,
  field,
}: DatePickerNaturalLanguageProps) {
  const fieldDate = React.useMemo(() => resolveFieldDate(field), [field]);
  const initialDate = selected ?? fieldDate ?? null;
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | null>(
    initialDate,
  );
  const [inputValue, setInputValue] = React.useState(() =>
    initialDate ? format(initialDate, "MMM d, yyyy") : "",
  );

  React.useEffect(() => {
    if (selected !== undefined) {
      setInternalDate(selected);
      setInputValue(selected ? format(selected, "MMM d, yyyy") : "");
      return;
    }

    if (fieldDate) {
      setInternalDate(fieldDate);
      setInputValue(format(fieldDate, "MMM d, yyyy"));
    } else if (fieldDate === null) {
      setInternalDate(null);
      setInputValue("");
    }
  }, [fieldDate, selected]);

  const resolvedDate = selected ?? internalDate;

  const commitDate = React.useCallback(
    (date: Date | null) => {
      if (selected === undefined) {
        setInternalDate(date);
      }
      onChange?.(date);
      setInputValue(date ? format(date, "MMM d, yyyy") : "");
    },
    [onChange, selected],
  );

  const commitInput = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      commitDate(null);
      return;
    }
    const parsed = parseNaturalLanguageDate(trimmed, new Date());
    if (!parsed) return;
    if (minDate && parsed < minDate) return;
    if (maxDate && parsed > maxDate) return;
    commitDate(parsed);
  }, [commitDate, inputValue, minDate, maxDate]);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitInput}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitInput();
            setOpen(false);
          }
        }}
        placeholder={placeholderText}
        className={cn("min-w-0", inputClassName)}
        aria-label="Date input"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" size="icon" aria-label="Open calendar" />}><ThemeIcon name="calendar" className="h-4 w-4" /></PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={resolvedDate || undefined}
            onSelect={(date) => {
              commitDate(date || null);
              setOpen(false);
            }}
            disabled={buildDisabledMatcher(minDate, maxDate)}
            captionLayout="dropdown"
            components={{ Dropdown: CustomDropdown }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DatePickerWithInput({
  selected,
  onChange,
  placeholderText = "MM/DD/YYYY",
  minDate,
  maxDate,
  inputClassName,
  field,
}: DatePickerWithInputProps) {
  const fieldDate = React.useMemo(() => resolveFieldDate(field), [field]);
  const initialDate = selected ?? fieldDate ?? null;
  const [open, setOpen] = React.useState(false);
  const [internalDate, setInternalDate] = React.useState<Date | null>(
    initialDate,
  );
  const [inputValue, setInputValue] = React.useState(() =>
    initialDate ? format(initialDate, "MM/dd/yyyy") : "",
  );

  React.useEffect(() => {
    if (selected !== undefined) {
      setInternalDate(selected);
      setInputValue(selected ? format(selected, "MM/dd/yyyy") : "");
      return;
    }

    if (fieldDate) {
      setInternalDate(fieldDate);
      setInputValue(format(fieldDate, "MM/dd/yyyy"));
    } else if (fieldDate === null) {
      setInternalDate(null);
      setInputValue("");
    }
  }, [fieldDate, selected]);

  const resolvedDate = selected ?? internalDate;

  const commitDate = React.useCallback(
    (date: Date | null) => {
      if (selected === undefined) {
        setInternalDate(date);
      }
      onChange?.(date);
      setInputValue(date ? format(date, "MM/dd/yyyy") : "");
    },
    [onChange, selected],
  );

  const commitInput = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      commitDate(null);
      return;
    }
    const parsed = parseDateInput(trimmed, new Date());
    if (!parsed) return;
    if (minDate && parsed < minDate) return;
    if (maxDate && parsed > maxDate) return;
    commitDate(parsed);
  }, [commitDate, inputValue, minDate, maxDate]);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitInput}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitInput();
            setOpen(false);
          }
        }}
        placeholder={placeholderText}
        className={cn("min-w-0", inputClassName)}
        aria-label="Date input"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" size="icon" aria-label="Open calendar" />}><ThemeIcon name="calendar" className="h-4 w-4" /></PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={resolvedDate || undefined}
            onSelect={(date) => {
              commitDate(date || null);
              setOpen(false);
            }}
            disabled={buildDisabledMatcher(minDate, maxDate)}
            captionLayout="dropdown"
            components={{ Dropdown: CustomDropdown }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DatePickerSimple() {
  const [date, setDate] = React.useState<Date>();

  return (
    <Popover>
      <PopoverTrigger render={<Button variant={"outline"} colorScheme={"neutral"} className={cn(
                      "flex h-10 w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=open]:border data-[state=open]:border-primary data-placeholder:text-muted-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='text-'])]:text-muted-foreground",
                      !date && "text-muted-foreground",
                    )} />}><ThemeIcon
                      name="calendar"
                      className="h-4 w-4 text-muted-foreground"
                    />{date ? format(date, "PPP") : <span>Pick a date</span>}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          captionLayout="dropdown"
          components={{ Dropdown: CustomDropdown }}
        />
      </PopoverContent>
    </Popover>
  );
}

function DatePickerWithRange() {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  });

  return (
    <Popover>
      <PopoverTrigger render={<Button id="date" variant={"outline"} colorScheme={"neutral"} className={cn(
                      "flex h-10 w-fit items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=open]:border data-[state=open]:border-primary data-placeholder:text-muted-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:hover:bg-input/50 [&_svg:not([class*='text-'])]:text-muted-foreground",
                      !date && "text-muted-foreground",
                    )} />}><ThemeIcon
                      name="calendar"
                      className="h-4 w-4 text-muted-foreground"
                    />{date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
          captionLayout="dropdown"
          components={{ Dropdown: CustomDropdown }}
        />
      </PopoverContent>
    </Popover>
  );
}

export {
  DatePicker,
  DatePickerNaturalLanguage,
  DatePickerSimple,
  DatePickerWithInput,
  DatePickerWithRange,
};
