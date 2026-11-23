import { cn } from "components/lib/registry/cn";

export interface EditPlaceholderProps {
  /** Short noun describing what the author should fill in (e.g. "Heading", "Image", "CTA"). */
  kind: string;
  /** Inline = pill for in-line slots; block = full-width dashed box for sections. */
  variant?: "inline" | "block";
  className?: string;
}

/**
 * Visual stub rendered by CMS-aware components when a field is missing AND
 * the page is in editing mode. Caller decides when to render — this primitive
 * is just the consistent visual.
 *
 * Usage:
 *   if (!label) return isEditing ? <EditPlaceholder kind="Badge" /> : null;
 */
export function EditPlaceholder({
  kind,
  variant = "inline",
  className,
}: EditPlaceholderProps) {
  if (variant === "block") {
    return (
      <div
        data-slot="edit-placeholder"
        className={cn(
          "rounded-md border border-border/60 border-dashed bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm",
          className,
        )}
      >
        + {kind}
      </div>
    );
  }
  return (
    <span
      data-slot="edit-placeholder"
      className={cn(
        "inline-flex items-center rounded border border-border/60 border-dashed bg-muted/30 px-2 py-0.5 text-muted-foreground text-xs",
        className,
      )}
    >
      + {kind}
    </span>
  );
}
