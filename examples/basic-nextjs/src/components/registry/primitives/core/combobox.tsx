"use client";

import * as React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "components/registry/primitives/core/avatar";
import { Button } from "components/registry/primitives/core/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "components/registry/primitives/core/command";
import { LibraryIcon } from "components/registry/primitives/core/library-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "components/registry/primitives/core/popover";
import { cn } from "components/lib/registry/cn";

function ComboboxContent({
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      className={cn("max-h-80 overflow-hidden", className)}
      {...props}
    />
  );
}

type Framework = {
  value: string;
  label: string;
};

type FrameworkComboboxProps = {
  frameworks: Framework[];
};

type IconOption = {
  value: string;
  label: string;
  icon: React.ReactNode;
};

type IconComboboxProps = {
  options: IconOption[];
  placeholder?: string;
};

type User = {
  id: string;
  username: string;
  avatar?: string;
};

type UserComboboxProps = {
  users: User[];
  selectedUserId: string;
};

type Timezone = {
  label: string;
  timezones: readonly {
    value: string;
    label: string;
  }[];
};

type TimezoneComboboxProps = {
  timezones: readonly Timezone[];
  selectedTimezone: Timezone["timezones"][number];
};

type ScrollableItem = {
  value: string;
  label: string;
};

type ScrollableComboboxProps = {
  items: ScrollableItem[];
  placeholder?: string;
};

function FrameworkCombobox({ frameworks }: FrameworkComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const contentId = React.useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select framework" className={cn(
                      "w-full justify-between rounded-md md:max-w-[200px]",
                      open && "ring-2 ring-primary",
                    )} />}>{value
                      ? frameworks.find((framework) => framework.value === value)?.label
                      : "Select framework..."}<LibraryIcon
                      name="chevrons-up-down"
                      className="text-muted-foreground"
                    /></PopoverTrigger>
      <ComboboxContent
        id={contentId}
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworks.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  {framework.label}
                  <LibraryIcon
                    name="check"
                    className={cn(
                      "ms-auto",
                      value === framework.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

function IconCombobox({
  options,
  placeholder = "Select option...",
}: IconComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const contentId = React.useId();

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select option" className={cn(
                      "w-full justify-between rounded-md md:max-w-[240px]",
                      open && "ring-2 ring-primary",
                    )} />}>{selectedOption ? (
                      <div className="flex items-center gap-2">
                        {selectedOption.icon}
                        {selectedOption.label}
                      </div>
                    ) : (
                      placeholder
                    )}<LibraryIcon
                      name="chevrons-up-down"
                      className="text-muted-foreground"
                    /></PopoverTrigger>
      <ComboboxContent
        id={contentId}
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search option..." />
          <CommandList>
            <CommandEmpty>No option found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  {option.icon}
                  {option.label}
                  <LibraryIcon
                    name="check"
                    className={cn(
                      "ms-auto",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

function UserCombobox({ users, selectedUserId }: UserComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(selectedUserId);
  const contentId = React.useId();

  const selectedUser = React.useMemo(
    () => users.find((user) => user.id === value),
    [value, users],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select user" className={cn(
                      "w-full justify-between rounded-md px-2 md:max-w-[200px]",
                      open && "ring-2 ring-primary",
                    )} />}>{selectedUser ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-5">
                          <AvatarImage
                            src={selectedUser.avatar}
                            alt={`${selectedUser.username} avatar`}
                          />
                          <AvatarFallback>{selectedUser.username[0]}</AvatarFallback>
                        </Avatar>
                        {selectedUser.username}
                      </div>
                    ) : (
                      "Select user..."
                    )}<LibraryIcon
                      name="chevrons-up-down"
                      className="text-muted-foreground"
                    /></PopoverTrigger>
      <ComboboxContent
        id={contentId}
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search user..." />
          <CommandList className="relative max-h-[300px] pb-12">
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.username}
                  onSelect={(currentValue) => {
                    const selected = users.find(
                      (u) =>
                        u.username.toLowerCase() === currentValue.toLowerCase(),
                    );
                    if (selected) {
                      setValue(selected.id === value ? "" : selected.id);
                    }
                    setOpen(false);
                  }}
                >
                  <Avatar className="size-5">
                    <AvatarImage
                      src={user.avatar}
                      alt={`${user.username} avatar`}
                    />
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  {user.username}
                  <LibraryIcon
                    name="check"
                    className={cn(
                      "ms-auto",
                      value === user.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="absolute start-0 end-0 bottom-0 z-10 rounded-b-md border-x border-b bg-background p-2">
            <Button
              variant="ghost"
              size="sm"
              colorScheme="primary"
              className="text-primary hover:text-primary active:text-primary"
              aria-label="Create new user"
            >
              <LibraryIcon name="plus" className="h-4 w-4" />
              Create user
            </Button>
          </div>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

function ScrollableCombobox({
  items,
  placeholder = "Select item...",
}: ScrollableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const contentId = React.useId();

  const selectedItem = React.useMemo(
    () => items.find((item) => item.value === value),
    [items, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select item" className={cn(
                      "w-full justify-between rounded-md md:max-w-[240px]",
                      open && "ring-2 ring-primary",
                    )} />}>{selectedItem ? selectedItem.label : placeholder}<LibraryIcon
                      name="chevrons-up-down"
                      className="text-muted-foreground"
                    /></PopoverTrigger>
      <ComboboxContent
        id={contentId}
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search item..." />
          <CommandList className="max-h-[240px] overflow-auto">
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <LibraryIcon
                    name="check"
                    className={cn(
                      "ms-auto",
                      value === item.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

function TimezoneCombobox({
  timezones,
  selectedTimezone,
}: TimezoneComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(selectedTimezone.value);
  const contentId = React.useId();

  const selectedGroup = React.useMemo(
    () =>
      timezones.find((group) =>
        group.timezones.find((tz) => tz.value === value),
      ),
    [value, timezones],
  );

  const selectedTimezoneLabel = React.useMemo(
    () => selectedGroup?.timezones.find((tz) => tz.value === value)?.label,
    [value, selectedGroup],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select timezone" className={cn(
                      "h-12 w-full justify-between rounded-md px-2.5 md:max-w-[200px]",
                      open && "ring-2 ring-primary",
                    )} />}>{selectedTimezone ? (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-normal text-muted-foreground text-xs">
                          {selectedGroup?.label}
                        </span>
                        <span>{selectedTimezoneLabel}</span>
                      </div>
                    ) : (
                      "Select timezone"
                    )}<LibraryIcon name="chevron-down" className="text-muted-foreground" /></PopoverTrigger>
      <ComboboxContent id={contentId} className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList className="relative max-h-[300px] pb-12">
            <CommandEmpty>No timezone found.</CommandEmpty>
            {timezones.map((region, index) => (
              <React.Fragment key={region.label}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={region.label}
                  className="**:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase"
                >
                  {region.timezones.map((timezone) => (
                    <CommandItem
                      key={timezone.value}
                      value={timezone.value}
                      onSelect={(currentValue) => {
                        setValue(
                          currentValue as Timezone["timezones"][number]["value"],
                        );
                        setOpen(false);
                      }}
                    >
                      {timezone.label}
                      <LibraryIcon
                        name="check"
                        className={cn(
                          "ms-auto",
                          value === timezone.value
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
          <div className="absolute start-0 end-0 bottom-0 z-10 rounded-b-md border-x border-b bg-background p-2">
            <Button
              variant="ghost"
              size="sm"
              colorScheme="primary"
              className="text-primary hover:text-primary active:text-primary"
              aria-label="Create new timezone"
            >
              <LibraryIcon name="plus" className="h-4 w-4" />
              Create timezone
            </Button>
          </div>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

function ComboboxWithCheckbox({ frameworks }: FrameworkComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedFrameworks, setSelectedFrameworks] = React.useState<
    Framework[]
  >([]);
  const contentId = React.useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" colorScheme="neutral" role="combobox" aria-expanded={open} aria-controls={open ? contentId : undefined} aria-label="Select frameworks (multi-select)" className={cn(
                      "w-fit min-w-[280px] justify-between rounded-md",
                      open && "ring-2 ring-primary",
                    )} />}>{selectedFrameworks.length > 0
                      ? selectedFrameworks.map((framework) => framework.label).join(", ")
                      : "Select frameworks (multi-select)..."}<LibraryIcon
                      name="chevrons-up-down"
                      className="text-muted-foreground"
                    /></PopoverTrigger>
      <ComboboxContent
        id={contentId}
        className="w-[min(300px,calc(100vw-2rem))] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworks.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.value}
                  onSelect={(currentValue) => {
                    setSelectedFrameworks(
                      selectedFrameworks.some((f) => f.value === currentValue)
                        ? selectedFrameworks.filter(
                            (f) => f.value !== currentValue,
                          )
                        : [...selectedFrameworks, framework],
                    );
                  }}
                >
                  <div
                    className="pointer-events-none size-4 shrink-0 select-none rounded-[4px] border border-input transition-all data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[selected=true]:text-inverse-text *:[svg]:opacity-0 data-[selected=true]:*:[svg]:opacity-100"
                    data-selected={selectedFrameworks.some(
                      (f) => f.value === framework.value,
                    )}
                  >
                    <LibraryIcon
                      name="check"
                      className="size-3.5 text-current"
                    />
                  </div>
                  {framework.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </ComboboxContent>
    </Popover>
  );
}

export {
  ComboboxWithCheckbox,
  FrameworkCombobox,
  IconCombobox,
  ScrollableCombobox,
  TimezoneCombobox,
  UserCombobox,
};
