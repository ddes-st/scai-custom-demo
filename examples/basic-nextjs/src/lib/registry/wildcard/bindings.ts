import {
  normalizeReferenceField,
  type WildcardFieldMap,
} from "components/lib/registry/wildcard/normalize";
import type { WildcardItemState } from "components/lib/registry/wildcard/use-wildcard-item";

/** Prop name → resolved-field name. */
export type WildcardBindings = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

/**
 * Parse a `WildcardBindings` rendering-param value. Accepts the raw
 * param string (JSON) or an already-parsed object. Entries must be
 * non-empty-string → non-empty-string; everything else is dropped.
 * Returns `undefined` when nothing usable remains (including malformed
 * JSON) so a bad param degrades to "no bindings" rather than a thrown
 * render.
 */
export function parseWildcardBindings(
  raw: unknown,
): WildcardBindings | undefined {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      // Malformed author input — treat as "no bindings".
      return undefined;
    }
  }
  if (!isRecord(candidate)) return undefined;
  const out: WildcardBindings = {};
  for (const [prop, fieldName] of Object.entries(candidate)) {
    const propKey = prop.trim();
    if (!propKey) continue;
    if (typeof fieldName !== "string" || !fieldName.trim()) continue;
    out[propKey] = fieldName.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Normalize a `{ value: … }` layout-service envelope: keep non-empty
 * text/scalar/image/link envelopes verbatim, drop everything else so
 * the authored prop wins.
 */
function normalizeValueEnvelope(
  value: Record<string, unknown>,
): unknown | undefined {
  const inner = value.value;
  // Text / rich-text: `{ value: string }` IS the editable source shape.
  if (typeof inner === "string") {
    return inner.trim().length > 0 ? value : undefined;
  }
  // Field<number> / Field<boolean> are legal layout-service scalars.
  if (typeof inner === "number" || typeof inner === "boolean") {
    return value;
  }
  if (isRecord(inner)) {
    // Image: `{ value: { src } }` matches ImageField.
    if (typeof inner.src === "string" && inner.src.trim().length > 0) {
      return value;
    }
    // General link: `{ value: { href } }` matches LinkField.
    if (typeof inner.href === "string" && inner.href.trim().length > 0) {
      return value;
    }
  }
  // Empty scalar / unrecognized envelope — skip honestly.
  return undefined;
}

/**
 * Normalize one resolved field value into the shape components expect
 * from the layout service, or `undefined` when the value is empty /
 * unrecognized (→ the binding is skipped and the authored prop wins).
 */
export function normalizeBoundFieldValue(value: unknown): unknown | undefined {
  if (value == null) return undefined;

  // Bare string (some feeds flatten scalars) → a valid TextSource.
  if (typeof value === "string") {
    return value.trim().length > 0 ? value : undefined;
  }

  // Multilist/Treelist reference → linked-item list.
  if (Array.isArray(value)) {
    const items = normalizeReferenceField(value);
    return items.length > 0 ? items : undefined;
  }

  if (!isRecord(value)) return undefined;

  if ("value" in value) {
    return normalizeValueEnvelope(value);
  }

  // Droplink single reference (item object without a `value` envelope).
  const items = normalizeReferenceField(value);
  return items.length > 0 ? items : undefined;
}

/**
 * Overlay wildcard-resolved fields onto a component's final props per
 * its `WildcardBindings` rendering param. Returns the input props
 * reference unchanged when inert (no provider state, unresolved item,
 * no parseable bindings, or no binding produced a value) so
 * `useMemo`/`React.memo` equality stays stable.
 */
export function applyWildcardBindings<TProps>(
  props: TProps,
  rawBindings: unknown,
  state: Pick<WildcardItemState, "status" | "fields"> | null | undefined,
): TProps {
  if (state?.status !== "resolved") return props;
  if (rawBindings == null) return props;
  const bindings = parseWildcardBindings(rawBindings);
  if (!bindings) return props;

  const fields: WildcardFieldMap = state.fields ?? {};
  let out: Record<string, unknown> | null = null;
  for (const [prop, fieldName] of Object.entries(bindings)) {
    const bound = normalizeBoundFieldValue(fields[fieldName]);
    if (bound === undefined) continue; // authored value remains the fallback
    if (!out) out = { ...(props as Record<string, unknown>) };
    out[prop] = bound; // resolved value wins
  }
  return (out ?? props) as TProps;
}
