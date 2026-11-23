import { cn } from "components/lib/registry/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-(--color-skeleton,var(--color-accent))",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
