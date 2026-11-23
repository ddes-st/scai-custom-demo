type FieldLike = { value?: unknown };

type LayoutWithRoute = {
  sitecore?: { route?: { fields?: unknown } | null };
};

/** True when a Sitecore field has text, an image src, or a link href. */
export function fieldHasValue(field?: FieldLike | null): boolean {
  const value = field?.value;
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") {
    const record = value as { src?: string; href?: string };
    return Boolean(record.src || record.href);
  }
  return false;
}

/** Prefer the rendering datasource field, then the page item field. */
export function preferField<T extends FieldLike>(
  own: T | undefined,
  fallback: T | undefined,
): T | undefined {
  return fieldHasValue(own) ? own : fallback || own;
}

export function routeFields(
  layout: LayoutWithRoute | undefined,
): Record<string, FieldLike> {
  const fields = layout?.sitecore?.route?.fields;
  if (!fields || typeof fields !== "object") return {};
  return fields as Record<string, FieldLike>;
}
