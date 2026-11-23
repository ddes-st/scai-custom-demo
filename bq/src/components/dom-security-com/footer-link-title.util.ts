/**
 * Normalize footer / mega link-list Title values.
 * Empty seeds and accidental quote-only values (`""`, `''`) must not render.
 */
export function normalizeLinkListTitle(
  raw: string | null | undefined,
): string {
  let value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";

  // Strip a single wrapping quote pair from bad emits / CM values.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  // Literal two-quote leftovers after strip or as field value.
  if (!value || value === '""' || value === "''") return "";
  return value;
}
