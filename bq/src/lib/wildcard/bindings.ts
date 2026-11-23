import { normalizeReferenceField, type WildcardFieldMap } from './normalize';
import type { WildcardItemState } from './use-wildcard-item';

export type WildcardBindings = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export function parseWildcardBindings(raw: unknown): WildcardBindings | undefined {
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  if (!isRecord(candidate)) return undefined;
  const out: WildcardBindings = {};
  for (const [prop, fieldName] of Object.entries(candidate)) {
    const propKey = prop.trim();
    if (!propKey) continue;
    if (typeof fieldName !== 'string' || !fieldName.trim()) continue;
    out[propKey] = fieldName.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeValueEnvelope(value: Record<string, unknown>): unknown | undefined {
  const inner = value.value;
  if (typeof inner === 'string') {
    return inner.trim().length > 0 ? value : undefined;
  }
  if (typeof inner === 'number' || typeof inner === 'boolean') {
    return value;
  }
  if (isRecord(inner)) {
    if (typeof inner.src === 'string' && inner.src.trim().length > 0) return value;
    if (typeof inner.href === 'string' && inner.href.trim().length > 0) return value;
  }
  return undefined;
}

export function normalizeBoundFieldValue(value: unknown): unknown | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    return value.trim().length > 0 ? value : undefined;
  }
  if (Array.isArray(value)) {
    const items = normalizeReferenceField(value);
    return items.length > 0 ? items : undefined;
  }
  if (!isRecord(value)) return undefined;
  if ('value' in value) {
    return normalizeValueEnvelope(value);
  }
  const items = normalizeReferenceField(value);
  return items.length > 0 ? items : undefined;
}

export function applyWildcardBindings<TProps>(
  props: TProps,
  rawBindings: unknown,
  state: Pick<WildcardItemState, 'status' | 'fields'> | null | undefined,
): TProps {
  if (state?.status !== 'resolved') return props;
  if (rawBindings == null) return props;
  const bindings = parseWildcardBindings(rawBindings);
  if (!bindings) return props;

  const fields: WildcardFieldMap = state.fields ?? {};
  let out: Record<string, unknown> | null = null;
  for (const [prop, fieldName] of Object.entries(bindings)) {
    const bound = normalizeBoundFieldValue(fields[fieldName]);
    if (bound === undefined) continue;
    if (!out) out = { ...(props as Record<string, unknown>) };
    out[prop] = bound;
  }
  return (out ?? props) as TProps;
}
