import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "components/lib/registry/cn";

const timelineRootVariants = cva("flex flex-col gap-0", {
  variants: {
    size: {
      sm: "[&_[data-slot=timeline-content]]:pb-3",
      md: "[&_[data-slot=timeline-content]]:pb-4",
      lg: "[&_[data-slot=timeline-content]]:pb-6",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

interface TimelineRootProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof timelineRootVariants> {}

function TimelineRoot({ className, size, ...props }: TimelineRootProps) {
  return (
    <div
      data-slot="timeline-root"
      data-size={size ?? "md"}
      className={cn(timelineRootVariants({ size }), className)}
      {...props}
    />
  );
}

// Timeline Item

interface TimelineItemProps extends React.ComponentProps<"div"> {}

function TimelineItem({ className, ...props }: TimelineItemProps) {
  return (
    <div
      data-slot="timeline-item"
      className={cn("relative flex gap-3", className)}
      {...props}
    />
  );
}

// Timeline Separator

interface TimelineSeparatorProps extends React.ComponentProps<"div"> {}

function TimelineSeparator({ className, ...props }: TimelineSeparatorProps) {
  return (
    <div
      data-slot="timeline-separator"
      className={cn("flex flex-col items-center gap-0", className)}
      {...props}
    />
  );
}

// Timeline Indicator

const timelineIndicatorVariants = cva(
  "relative z-10 flex shrink-0 items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        solid: "",
        outline: "border bg-background",
        subtle: "",
        plain: "bg-background",
      },
      size: {
        sm: "size-5",
        md: "size-8",
        lg: "size-10",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "sm",
    },
  },
);

type TimelineColorScheme =
  | "default"
  | "neutral"
  | "primary"
  | "success"
  | "destructive"
  | "warning"
  | "info";

type TimelineIndicatorVariant = NonNullable<
  VariantProps<typeof timelineIndicatorVariants>["variant"]
>;

const timelineIndicatorColorVariants: Record<
  TimelineColorScheme,
  Record<TimelineIndicatorVariant, string>
> = {
  default: {
    solid: "bg-foreground text-background",
    outline: "border-border text-foreground bg-background",
    subtle: "bg-muted text-muted-foreground",
    plain: "bg-background text-foreground",
  },
  neutral: {
    solid: "bg-neutral text-inverse-text",
    outline: "border-neutral/40 text-neutral bg-background",
    subtle: "bg-neutral-background text-neutral",
    plain: "bg-background text-neutral",
  },
  primary: {
    solid: "bg-primary text-primary-foreground",
    outline: "border-primary/40 text-primary bg-background",
    subtle: "bg-primary-background text-primary",
    plain: "bg-background text-primary",
  },
  success: {
    solid: "bg-success text-success-foreground",
    outline: "border-success/40 text-success bg-background",
    subtle: "bg-success-background text-success",
    plain: "bg-background text-success",
  },
  destructive: {
    solid: "bg-destructive text-destructive-foreground",
    outline: "border-destructive/40 text-destructive bg-background",
    subtle: "bg-destructive-background text-destructive",
    plain: "bg-background text-destructive",
  },
  warning: {
    solid: "bg-warning text-warning-foreground",
    outline: "border-warning/40 text-warning bg-background",
    subtle: "bg-warning-background text-warning",
    plain: "bg-background text-warning",
  },
  info: {
    solid: "bg-info text-info-foreground",
    outline: "border-info/40 text-info bg-background",
    subtle: "bg-info-background text-info",
    plain: "bg-background text-info",
  },
};

interface TimelineIndicatorProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof timelineIndicatorVariants> {
  colorScheme?: TimelineColorScheme;
}

function TimelineIndicator({
  className,
  variant,
  size,
  colorScheme = "default",
  ...props
}: TimelineIndicatorProps) {
  const resolvedVariant = variant ?? "solid";
  const colorClasses =
    timelineIndicatorColorVariants[colorScheme][resolvedVariant];

  return (
    <div
      data-slot="timeline-indicator"
      data-variant={resolvedVariant}
      data-color={colorScheme}
      data-size={size ?? "sm"}
      className={cn(
        timelineIndicatorVariants({ variant: resolvedVariant, size }),
        colorClasses,
        className,
      )}
      {...props}
    />
  );
}

// Timeline Connector

const timelineConnectorVariants = cva("flex-1 min-h-4", {
  variants: {
    variant: {
      solid: "w-0.25",
      dashed: "w-0 border-s-2 border-dashed",
      dotted: "w-0 border-s-2 border-dotted",
    },
  },
  defaultVariants: {
    variant: "solid",
  },
});

type TimelineConnectorVariant = NonNullable<
  VariantProps<typeof timelineConnectorVariants>["variant"]
>;

const timelineConnectorColorVariants: Record<
  TimelineColorScheme,
  Record<TimelineConnectorVariant, string>
> = {
  default: {
    solid: "bg-border",
    dashed: "border-border",
    dotted: "border-border",
  },
  neutral: {
    solid: "bg-neutral",
    dashed: "border-neutral/40",
    dotted: "border-neutral/40",
  },
  primary: {
    solid: "bg-primary",
    dashed: "border-primary",
    dotted: "border-primary",
  },
  success: {
    solid: "bg-success",
    dashed: "border-success",
    dotted: "border-success",
  },
  destructive: {
    solid: "bg-destructive",
    dashed: "border-destructive",
    dotted: "border-destructive",
  },
  warning: {
    solid: "bg-warning",
    dashed: "border-warning",
    dotted: "border-warning",
  },
  info: {
    solid: "bg-info",
    dashed: "border-info",
    dotted: "border-info",
  },
};

interface TimelineConnectorProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof timelineConnectorVariants> {
  colorScheme?: TimelineColorScheme;
}

function TimelineConnector({
  className,
  variant,
  colorScheme = "default",
  ...props
}: TimelineConnectorProps) {
  const resolvedVariant = variant ?? "solid";
  const colorClasses =
    timelineConnectorColorVariants[colorScheme][resolvedVariant];

  return (
    <div
      data-slot="timeline-connector"
      data-variant={resolvedVariant}
      data-color={colorScheme}
      className={cn(
        timelineConnectorVariants({ variant: resolvedVariant }),
        colorClasses,
        className,
      )}
      {...props}
    />
  );
}

//  Timeline Content

interface TimelineContentProps extends React.ComponentProps<"div"> {}

function TimelineContent({ className, ...props }: TimelineContentProps) {
  return (
    <div
      data-slot="timeline-content"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

// Timeline Title

interface TimelineTitleProps extends React.ComponentProps<"p"> {}

function TimelineTitle({ className, ...props }: TimelineTitleProps) {
  return (
    <p
      data-slot="timeline-title"
      className={cn("font-medium text-base text-foreground", className)}
      {...props}
    />
  );
}

// Timeline Description

interface TimelineDescriptionProps extends React.ComponentProps<"p"> {}

function TimelineDescription({
  className,
  ...props
}: TimelineDescriptionProps) {
  return (
    <p
      data-slot="timeline-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

export {
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIndicator,
  TimelineItem,
  TimelineRoot,
  TimelineSeparator,
  TimelineTitle,
};

// Compound component export
export const Timeline = {
  Root: TimelineRoot,
  Item: TimelineItem,
  Separator: TimelineSeparator,
  Indicator: TimelineIndicator,
  Connector: TimelineConnector,
  Content: TimelineContent,
  Title: TimelineTitle,
  Description: TimelineDescription,
};
