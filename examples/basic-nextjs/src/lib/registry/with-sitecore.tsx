import { type ComponentType, cache, type JSX, useMemo } from "react";
import type { ComponentProps } from "components/lib/registry/sitecore-types";
import { applyWildcardBindings } from "components/lib/registry/wildcard/bindings";
import type { WildcardItemState } from "components/lib/registry/wildcard/use-wildcard-item";
import { useWildcardItemContext } from "components/lib/registry/wildcard/wildcard-item-context";

/**
 * Brand marker stamped on every adapter returned by `withSitecore` so
 * `withSitecoreModule` (and downstream tooling) can recognise an
 * already-wrapped component and skip it instead of double-wrapping.
 *
 * Uses `Symbol.for` so the brand survives a) cross-package boundaries
 * (each starter repo gets its own copy of `with-sitecore.tsx` from the
 * registry, but they all resolve the same symbol), and b) HMR / bundle
 * splitting (no module-instance comparison hazard).
 */
const WITH_SITECORE_BRAND: unique symbol = Symbol.for(
  "@registry/with-sitecore",
);

/**
 * Input shape every Sitecore-registered component receives from the
 * Layout Service via the SDK's component factory: `fields`, `params`,
 * `rendering`, and an optional `isEditing` flag resolved at the
 * rendering boundary.
 *
 * Generic over `TFields` so a per-component map can narrow to its own
 * field shape.
 *
 * All four payload keys are optional. In real production renders the
 * SDK component factory always supplies `rendering`, but holding it
 * required forces synthetic stubs onto every direct test invocation
 * (and onto any in-process renderer that doesn't route through the
 * SDK). The default map forwards `rendering` straight through to the
 * inner component when present and skips it cleanly when absent.
 */
export type SitecoreInput<TFields = Record<string, unknown>> = Omit<
  ComponentProps,
  "params" | "rendering"
> & {
  fields?: TFields;
  params?: ComponentProps["params"];
  rendering?: ComponentProps["rendering"];
};

/**
 * GUID → readable-name table for a single droplist param. Keys are
 * Sitecore item GUIDs (curly braces and case are normalized); values
 * are the readable token the component expects (e.g. `"primary"`).
 *
 * @example
 * ```ts
 * const COLOR_SCHEME_GUIDS: DroplistLookup = {
 *   "{1A2B3C4D-1111-2222-3333-444455556666}": "primary",
 *   "{2B3C4D5E-1111-2222-3333-444455556666}": "secondary",
 * };
 * ```
 */
export type DroplistLookup = Record<string, string>;

/**
 * Per-prop droplist tables for a component. Keys are camelCase prop
 * names (after `withSitecore`'s lowerFirst convention is applied to
 * Sitecore's PascalCase param names); values are the GUID-to-name
 * lookup tables.
 *
 * Typed so TypeScript narrows the keys to the wrapped component's
 * actual prop names — typos surface at registration, not at runtime.
 */
export type DroplistMap<TProps = Record<string, unknown>> = {
  [K in keyof TProps & string]?: DroplistLookup;
};

/**
 * Options bag for `withSitecore`. Use this form when you need to mix
 * concerns (droplist resolution + a custom map, Treelist flattening,
 * etc.).
 */
export type WithSitecoreOptions<TFields, TProps> = {
  /**
   * Per-prop GUID → readable-name lookup tables. When a param comes
   * through the layout service as a Sitecore item GUID (the case for
   * Droplink / Droplist / Droptree fields), the matching value from
   * this table is substituted before the prop is spread onto the
   * component. Non-GUID values and unknown GUIDs pass through
   * unchanged so authored content keeps working.
   */
  droplists?: DroplistMap<TProps>;
  /**
   * Names of Treelist / multi-reference fields whose linked-item
   * arrays should be flattened before the inner component sees them.
   *
   * The Sitecore Layout Service ships a Treelist as
   * `Array<{ id, name, fields: { Label, Content, … } }>`. Most
   * components expect to read item fields directly (`item.Label`)
   * rather than reaching into `item.fields`. Listing the field name
   * here hoists each linked item's `fields` onto the item itself,
   * keeping `id` + `name` available alongside.
   *
   * Field names are case-insensitive — pass either the recipe-side
   * PascalCase (`"Items"`) or the camelCased prop name (`"items"`).
   * Internal: the lookup compares against the lowerFirst form
   * (matching `defaultMap`'s convention).
   *
   * @example
   * ```ts
   * componentMap.set(
   *   "TabsBlock",
   *   withSitecore<TabsBlockFields, TabsBlockProps>(TabsBlock, {
   *     flattenLinkedItems: ["Items"],
   *   }),
   * );
   * ```
   *
   * Composes with `map` and `droplists`: when `map` is set it runs
   * first; the flattener then operates on the map's return value.
   * Composes with `droplists`: droplist resolution runs after
   * flattening.
   */
  flattenLinkedItems?: readonly string[];
  /**
   * Custom map taking full control of props translation. Composes with
   * `droplists` and `flattenLinkedItems`: when set, this `map` runs
   * first; flattening and droplist resolution apply to its return
   * value. Drop them entirely if your map handles those concerns
   * itself.
   */
  map?: (input: SitecoreInput<TFields>) => TProps;
};

/**
 * Shape of one element in a Layout-Service Treelist projection.
 * Generic over the picked item's `fields` shape so consumers can
 * narrow the inner type when declaring an adapter's input.
 */
export interface LinkedItem<TFields = Record<string, unknown>> {
  id?: string;
  name?: string;
  displayName?: string;
  templateName?: string;
  templateId?: string;
  /**
   * Resolved item URL — present when the referenced item is a PAGE
   * (string path in the classic projection; `{path, href}` object in
   * Edge GraphQL responses). Preserved by `flattenLinkedItems`.
   */
  url?: string | { path?: string; href?: string };
  fields?: TFields;
}

/**
 * Flatten a single linked-item value: hoist its `fields` to the top
 * level alongside `id` + `name` — and, when present, `displayName`
 * and the linked-item `url` (a Treelist entry that references a PAGE
 * item carries the page's resolved URL there; dropping it severed
 * page-linked entries from their destination). Field values spread
 * LAST so a real field wins over envelope metadata on a name
 * collision. Reference-equal pass-through when the input isn't a
 * linked-item shape so non-Treelist values flow through unchanged.
 */
const flattenLinkedItem = (item: unknown): unknown => {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return item;
  }
  const obj = item as Record<string, unknown> & { fields?: unknown };
  if (!("fields" in obj) || obj.fields == null) return item;
  const fields = obj.fields as Record<string, unknown>;
  return {
    id: obj.id,
    name: obj.name,
    ...(obj.displayName !== undefined ? { displayName: obj.displayName } : {}),
    ...(obj.url !== undefined ? { url: obj.url } : {}),
    ...fields,
  };
};

/**
 * Walk an array of linked-item values and flatten each. Returns the
 * input array reference unchanged when nothing needed flattening so
 * `useMemo`-driven equality checks stay stable.
 */
const flattenLinkedItemsArray = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  let changed = false;
  const next = value.map((entry) => {
    const flattened = flattenLinkedItem(entry);
    if (flattened !== entry) changed = true;
    return flattened;
  });
  return changed ? next : value;
};

/**
 * Apply `flattenLinkedItems` to a props object. For each named field,
 * the matching prop (case-insensitive via lowerFirst) is replaced
 * with its flattened array. Operates on a shallow copy so the input
 * is not mutated.
 */
const applyFlattenLinkedItems = <T,>(
  props: T,
  fieldNames: readonly string[] | undefined,
): T => {
  if (!fieldNames || fieldNames.length === 0) return props;
  const out = { ...(props as Record<string, unknown>) };
  for (const name of fieldNames) {
    const key = lowerFirst(name);
    if (!(key in out)) continue;
    out[key] = flattenLinkedItemsArray(out[key]);
  }
  return out as T;
};

// Match BOTH Sitecore GUID surface formats that may arrive in
// `params.<DroplistField>`:
//
//   - Layout Service shape       `{EEA4EEAC-36AB-4176-B716-5E00CA6B16FF}`
//     (and the same without braces) — hyphenated, mixed case.
//   - Edge GraphQL `item.id`     `A636DFF453EF479FB9A1603008B81086`
//     — 32 hex chars, no braces, no hyphens, mixed case.
//
// Earlier the regex only covered the hyphenated form. Editing hosts that
// fetch layout from Edge (most XM Cloud setups, and `SitecoreClient` when
// it routes through Edge for preview / production) deliver
// `params.FieldNames` in the no-hyphen form — the regex didn't match,
// `resolveParamsDroplists` skipped the value, and the SDK's
// `component[<rawGuid>]` lookup whiffed → Default fired for every
// variant. This expanded regex catches both, so the resolver actually
// runs whichever surface delivered the layout.
const SITECORE_GUID_RE =
  /^(\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?|[0-9a-f]{32})$/i;

/**
 * Reduce any of Sitecore's GUID surface formats to a single canonical
 * key. Sitecore emits GUIDs in three flavours depending on the
 * surface:
 *
 *   - Layout Service params (`"{EEA4EEAC-36AB-4176-B716-5E00CA6B16FF}"`)
 *     — braces, hyphens, mixed case.
 *   - Edge GraphQL `item.id` (`"A636DFF453EF479FB9A1603008B81086"`)
 *     — no braces, no hyphens, upper case.
 *   - Hand-authored droplist tables (any of the above, sometimes
 *     lowercase, sometimes without braces).
 *
 * Stripping braces + hyphens + lowercasing collapses them onto one
 * shape so the registry's lookup table works regardless of which
 * format either side produced.
 */
const normalizeGuid = (value: string): string =>
  value.replace(/[{}-]/g, "").toLowerCase();

const normalizeLookup = (lookup: DroplistLookup): DroplistLookup => {
  const out: DroplistLookup = {};
  for (const [key, value] of Object.entries(lookup)) {
    out[normalizeGuid(key)] = value;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Module-level GUID → readable-name registry.
//
// The Sitecore Layout Service returns Droplink-shaped rendering parameters
// as raw item GUIDs (e.g.
// `params.ColorScheme: "{EEA4EEAC-36AB-4176-B716-5E00CA6B16FF}"`). Without
// resolution, components receive opaque GUIDs and fall through to defaults.
// Per-component `droplists:` tables can't cover this when the GUIDs are
// per-tenant (every install gets fresh enum value items with site-scoped
// GUIDs derived via uuidv5(site, handle, valueName)).
//
// This registry is the project's canonical sync resolution path. The
// starter registers a deploy-time-emitted manifest once at boot:
//
//   import enumManifest from "./generated/enum-manifest.json";
//   registerDroplistValues(enumManifest);
//
// `withSitecore` then walks `params` on every render and replaces any
// GUID-shaped value whose normalised key is in the registry. Sync, no
// network, no per-component config.
//
// Why module-level (not React context):
//   - The mapping is install-time-immutable. A Provider would force every
//     `withSitecore`-wrapped component into the React tree below it; the
//     Sitecore SDK's component map renders components by name lookup,
//     making provider wrapping awkward (you'd need to wrap the
//     `componentMap` consumer, not individual components).
//   - Sync access from `useMemo` is cheap and non-rendering — no
//     Provider/context overhead per component.
//   - The registry is read-mostly: populate once at boot, consult on
//     every render. Module state matches the access pattern.
//
// Mutation footgun: HMR / dev re-imports can re-run `registerDroplistValues`
// — `register*` is therefore idempotent (later writes win on key
// collision). `clearDroplistValues` is for tests; production code should
// not need it.
// ---------------------------------------------------------------------------

const droplistRegistry: Map<string, string> = new Map();

/**
 * Merge a tenant-specific GUID → readable-name manifest into the
 * module's droplist registry. Subsequent `withSitecore` renders
 * sync-resolve any GUID-shaped param value whose normalised key is in
 * the registry, so components receive the readable token (`"primary"`)
 * instead of the raw GUID (`"{EEA4EEAC-…}"`).
 *
 * Idempotent. Keys are normalised (braces stripped, lowercased) before
 * insertion so the lookup matches whatever case/brace style the Layout
 * Service emits. Values that aren't non-empty strings are silently
 * skipped — a partial / lazily-built manifest is safe.
 *
 * @example
 * ```ts
 * import enumManifest from "@/generated/enum-manifest.json";
 * registerDroplistValues(enumManifest);
 * ```
 */
export function registerDroplistValues(
  manifest: Record<string, string> | undefined | null,
): void {
  if (!manifest) return;
  for (const [guid, name] of Object.entries(manifest)) {
    if (typeof name !== "string" || name.length === 0) continue;
    droplistRegistry.set(normalizeGuid(guid), name);
  }
}

/**
 * Drop the module's droplist registry. Provided for tests so cases stay
 * isolated; production callers should not need this — register once,
 * read forever.
 */
export function clearDroplistValues(): void {
  droplistRegistry.clear();
}

/**
 * Sync GUID → readable-name lookup against the module registry. Returns
 * the original value when it isn't a GUID, when the registry is empty,
 * or when the GUID isn't registered (so an incomplete manifest
 * degrades to "raw GUID visible in props" rather than a thrown render).
 *
 * Exposed so a custom `withSitecore` map can apply the same resolution
 * to a non-`params` location without re-implementing the GUID detection
 * + brace/case normalisation.
 */
export function resolveRegisteredDroplist(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (droplistRegistry.size === 0) return value;
  if (!SITECORE_GUID_RE.test(value)) return value;
  const resolved = droplistRegistry.get(normalizeGuid(value));
  return resolved ?? value;
}

/**
 * Walk a `params` object and replace any GUID-shaped value with its
 * resolved name from the module droplist registry. Reference-equal to
 * the input when nothing changed (preserves `useMemo` stability and
 * `React.memo` propagation).
 */
const resolveParamsViaRegistry = (
  params: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  if (!params || droplistRegistry.size === 0) return params;
  let changed = false;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const next = resolveRegisteredDroplist(value);
    if (next !== value) changed = true;
    out[key] = next as string;
  }
  return changed ? out : params;
};

/**
 * Resolve a Sitecore droplist value: if `value` looks like a Sitecore
 * item GUID and the lookup table has a matching entry (case- and
 * brace-insensitive), return the mapped value; otherwise return the
 * original value unchanged.
 *
 * Pass-through behavior is the safe default — non-GUID values
 * (already-resolved names) and unknown GUIDs both flow through, so a
 * stale or partial lookup table can't break a render.
 *
 * Use directly inside a custom map when only one or two params need
 * lookup. For the convention-map path, pass a `droplists` option to
 * `withSitecore` instead.
 */
export function resolveDroplistValue(
  value: unknown,
  lookup: DroplistLookup | undefined,
): unknown {
  if (typeof value !== "string" || !lookup) return value;
  if (!SITECORE_GUID_RE.test(value)) return value;
  // Normalize the lookup table on every call so the helper is correct
  // when used standalone with a verbatim author-supplied table. The
  // `withSitecore` options-bag path pre-normalizes once at registration
  // and bypasses this by passing an already-normalized table.
  const needle = normalizeGuid(value);
  if (needle in lookup) return lookup[needle];
  for (const [key, mapped] of Object.entries(lookup)) {
    if (normalizeGuid(key) === needle) return mapped;
  }
  return value;
}

/**
 * Apply a `DroplistMap` to a props object: for each key in the map,
 * resolve the corresponding prop's value through its lookup. Keys that
 * aren't present on `props` are skipped silently (the convention map
 * may not have produced them).
 *
 * Operates on a shallow copy so the input is not mutated.
 */
export function applyDroplists<TProps>(
  props: TProps,
  droplists: DroplistMap<TProps> | undefined,
): TProps {
  if (!droplists) return props;
  const out = { ...(props as Record<string, unknown>) };
  for (const [key, lookup] of Object.entries(droplists) as Array<
    [string, DroplistLookup | undefined]
  >) {
    if (key in out) out[key] = resolveDroplistValue(out[key], lookup);
  }
  return out as TProps;
}

// =============================================================================
// Server-side droplist resolution
//
// The page-level seam: walks a layout-service response (or a single
// component's params object), finds GUID-shaped values inside any
// `params` block, and substitutes the referenced item's system name.
//
// Sitecore returns droplist rendering parameters as raw item GUIDs in
// the `params` section of every rendering. By default they'd hit
// withSitecore-wrapped components as opaque braces-and-hyphens strings
// (`colorScheme: "{1A2B3C4D-…}"`). Resolving once at the page boundary
// means every component down-tree — Server, Client, RSC-data-fetched
// alike — sees the readable name (`colorScheme: "Primary"`) and the
// per-component `droplists` table is only needed for unusual cases.
// =============================================================================

/**
 * Resolve a Sitecore item GUID to a readable string. Return `undefined`
 * for GUIDs the resolver doesn't know about — the caller passes the
 * original value through unchanged.
 *
 * The default fetcher resolves to the item's system `name`. Use a
 * custom fetcher to resolve against `displayName`, a specific field,
 * or a different data source.
 */
export type SitecoreItemFetcher = (guid: string) => Promise<string | undefined>;

/**
 * Minimal client surface the default fetcher needs. Matches the
 * `BaseSitecoreClient.getData` signature from `@sitecore-content-sdk/core`,
 * so a consumer's existing `SitecoreClient` instance plugs in directly.
 */
export interface SitecoreItemDataClient {
  getData<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T>;
}

const ITEM_NAME_QUERY = /* GraphQL */ `
  query ResolveSitecoreItemName($id: String!, $language: String!) {
    item(path: $id, language: $language) {
      name
    }
  }
`;

/**
 * Build the default `SitecoreItemFetcher`: issues a small GraphQL
 * query against the supplied client to read the referenced item's
 * system `name`. Wrapped in React `cache()` so duplicate GUIDs in the
 * same render share one fetch.
 *
 * For cross-request persistence + invalidation on Sitecore publish,
 * compose with Next's `unstable_cache`:
 *
 * ```ts
 * import { unstable_cache } from "next/cache";
 *
 * const baseFetcher = createSitecoreItemNameFetcher(sitecoreClient);
 * export const fetchItemName = (guid: string) =>
 *   unstable_cache(() => baseFetcher(guid), ["sitecore-item-name", guid], {
 *     tags: [`sitecore-item:${guid}`],
 *     revalidate: 3600,
 *   })();
 * ```
 */
export function createSitecoreItemNameFetcher(
  client: SitecoreItemDataClient,
  options: { language?: string } = {},
): SitecoreItemFetcher {
  const language = options.language ?? "en";
  // Canonicalise to the braced-hyphenated `{...}` form. Sitecore's
  // Authoring GraphQL `item(path:)` argument is permissive about case
  // and brace presence, but a no-hyphen 32-char GUID is rejected as
  // "not a valid path or GUID" — Edge GraphQL emits exactly that
  // shape, so a `params.FieldNames = "A636DFF4..."` looked it up under
  // a key the API can't parse and the resolver returned `undefined`,
  // leaving the raw GUID on the component and the SDK whiffing.
  const toBracedGuid = (raw: string): string => {
    const trimmed = raw.replace(/[{}]/g, "");
    if (/^[0-9a-f]{32}$/i.test(trimmed)) {
      // 32-char no-hyphen → reinsert hyphens at 8-4-4-4-12.
      const parts = [
        trimmed.slice(0, 8),
        trimmed.slice(8, 12),
        trimmed.slice(12, 16),
        trimmed.slice(16, 20),
        trimmed.slice(20),
      ];
      return `{${parts.join("-")}}`;
    }
    return `{${trimmed}}`;
  };
  return cache(async (guid: string): Promise<string | undefined> => {
    try {
      const canonical = toBracedGuid(guid);
      const data = await client.getData<{ item?: { name?: string } | null }>(
        ITEM_NAME_QUERY,
        { id: canonical, language },
      );
      const name = data?.item?.name;
      return typeof name === "string" && name.length > 0 ? name : undefined;
    } catch {
      // Resolver failures must never break a render — the caller
      // passes the original GUID through unchanged when we return
      // undefined, so a transient GraphQL error degrades to "raw GUID
      // visible in props" rather than a thrown render.
      return undefined;
    }
  });
}

/**
 * Layer the static droplist registry in front of a live fetcher as an L1
 * cache. The build-time manifest (registered at boot via
 * `registerDroplistValues`) resolves known GUIDs **synchronously, with no
 * network** — which is every enum value that existed at build time, i.e. the
 * overwhelming common case in production. Only GUIDs the manifest doesn't
 * cover (e.g. enum items authored after the build, seen on the editing
 * canvas) fall through to `live`; a live hit then backfills the registry so
 * the next render of that GUID is also sync.
 *
 * This inverts the naive "live-resolve every GUID on every layout fetch" cost
 * model: the static manifest is the front door, live GraphQL is a miss-only
 * L2. Compose `live` with Next's `unstable_cache` (publish-tag invalidated)
 * if you also want misses persisted across requests.
 */
export function registryFirstFetcher(
  live: SitecoreItemFetcher,
): SitecoreItemFetcher {
  return async (guid: string): Promise<string | undefined> => {
    // L1 — manifest-fed registry. Sync, no network. `resolveRegisteredDroplist`
    // returns the input unchanged on a miss / empty registry.
    const registered = resolveRegisteredDroplist(guid);
    if (typeof registered === "string" && registered !== guid) {
      return registered;
    }
    // L2 — live CM lookup for GUIDs the manifest doesn't know about.
    const resolved = await live(guid);
    if (resolved) registerDroplistValues({ [guid]: resolved });
    return resolved;
  };
}

/**
 * Default keys to skip when walking a `params` object. `RenderingIdentifier`
 * is GUID-shaped but identifies the rendering instance (used as the DOM
 * `id` attribute), not a Sitecore item — resolving it would always miss
 * and pollute the resolver's cache with non-existent lookups.
 */
const DEFAULT_PARAMS_SKIP_KEYS: readonly string[] = ["RenderingIdentifier"];

const isPlainParamsObject = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (v) => v === undefined || v === null || typeof v === "string",
  );

/**
 * Resolve droplist GUIDs inside a single `params` object. For each key,
 * if the value matches the Sitecore GUID shape, look it up via the
 * fetcher and substitute the result. Unknown GUIDs and non-GUID values
 * pass through unchanged.
 *
 * **Structural sharing**: returns the *same reference* the caller
 * passed in when nothing needed substituting. Allocations are
 * proportional to the number of changed entries, not to the size of
 * the input — important for large layout payloads where most
 * `params` blocks have no droplist values.
 *
 * Use at the component-level seam when a component does its own data
 * fetching (RSC `await`) and the result has a `params` shape that
 * needs resolution before it reaches the presentation layer.
 */
export async function resolveParamsDroplists<
  T extends Record<string, string | undefined> | undefined,
>(
  params: T,
  fetcher: SitecoreItemFetcher,
  options: { skipKeys?: Iterable<string> } = {},
): Promise<T> {
  if (!params) return params;
  const skip = new Set(options.skipKeys ?? DEFAULT_PARAMS_SKIP_KEYS);
  const resolutions = await Promise.all(
    Object.entries(params).map(async ([key, value]) => {
      if (skip.has(key)) return { key, value, changed: false };
      if (typeof value !== "string" || !SITECORE_GUID_RE.test(value)) {
        return { key, value, changed: false };
      }
      const resolved = await fetcher(value);
      if (resolved === undefined || resolved === value) {
        return { key, value, changed: false };
      }
      return { key, value: resolved, changed: true };
    }),
  );
  if (!resolutions.some((entry) => entry.changed)) return params;
  const out: Record<string, string | undefined> = { ...params };
  for (const { key, value } of resolutions) out[key] = value;
  return out as T;
}

/**
 * Walk an arbitrary layout-service response and resolve droplist GUIDs
 * inside every `params` object encountered. Returns a new tree —
 * the input is not mutated.
 *
 * **Structural sharing**: subtrees with no GUID substitutions retain
 * their original references; only the path from the root down to each
 * substituted `params` block is cloned. Allocations scale with the
 * number of changed `params` blocks, not the size of the layout. For a
 * 500-node layout with 5 droplist substitutions, this allocates the
 * spine (~20–30 nodes) instead of all 500.
 *
 * Generic over `T` so it accepts the full `LayoutServiceData`, the
 * `Page` envelope returned by `sitecoreClient.getPage`, or any nested
 * subtree that contains rendering definitions.
 *
 * Use at the page-level seam — call once in the page Server Component
 * after fetching layout, before passing into the rendering pipeline:
 *
 * ```ts
 * const fetchItemName = createSitecoreItemNameFetcher(sitecoreClient);
 * const page = await sitecoreClient.getPage(slug);
 * const resolved = await resolveLayoutDroplists(page, fetchItemName);
 * return <SitecoreLayout layoutData={resolved.layout} />;
 * ```
 */
export async function resolveLayoutDroplists<T>(
  data: T,
  fetcher: SitecoreItemFetcher,
  options: { skipKeys?: Iterable<string> } = {},
): Promise<T> {
  const skip = options.skipKeys ?? DEFAULT_PARAMS_SKIP_KEYS;

  const walk = async (node: unknown): Promise<unknown> => {
    if (Array.isArray(node)) {
      const next = await Promise.all(node.map(walk));
      // Reference-equal element-by-element ⇒ nothing changed in this
      // subtree, return the original array reference unchanged.
      const changed = next.some((value, index) => value !== node[index]);
      return changed ? next : node;
    }
    if (node === null || typeof node !== "object") return node;
    const resolutions = await Promise.all(
      Object.entries(node).map(async ([key, value]) => {
        if (key === "params" && isPlainParamsObject(value)) {
          const resolved = await resolveParamsDroplists(value, fetcher, {
            skipKeys: skip,
          });
          return { key, value: resolved, changed: resolved !== value };
        }
        const next = await walk(value);
        return { key, value: next, changed: next !== value };
      }),
    );
    if (!resolutions.some((entry) => entry.changed)) return node;
    const out: Record<string, unknown> = {
      ...(node as Record<string, unknown>),
    };
    for (const { key, value } of resolutions) out[key] = value;
    return out;
  };

  return (await walk(data)) as T;
}

/**
 * Methods on a SitecoreClient-shaped instance whose return value carries
 * layout-service `params` blocks containing Droplist GUIDs.
 *
 * - `getPage`               normal page render (production traffic)
 * - `getDesignLibraryData`  the Pages Design Library editor surface
 * - `getPreview`            preview / draft render mode
 *
 * `wrapSitecoreClient` proxies just these — every other method passes
 * through unchanged. Future SDK methods that ALSO return a layout
 * envelope can be added here when the corresponding render path
 * surfaces unresolved GUIDs.
 */
const LAYOUT_FETCH_METHODS = new Set<PropertyKey>([
  "getPage",
  "getDesignLibraryData",
  "getPreview",
]);

/**
 * Wrap a `SitecoreClient` so its layout-fetch methods automatically
 * resolve Droplist rendering-parameter GUIDs into readable item names
 * before the layout reaches any component. Without this, every
 * `withSitecore`-wrapped component receives `params: { ColorScheme:
 * "{1A2B...}" }` — the CVA variant matcher gets no match, components
 * render with base classes only, and the deployed site looks like
 * "raw Tailwind".
 *
 * Implementation note: returns a `Proxy` rather than mutating the
 * input. The Proxy preserves the input's identity for ALL non-wrapped
 * methods (they `bind` to the underlying instance so `this` inside the
 * SDK code resolves correctly). The `getData` method on the input is
 * also re-used as the fetcher's data source — so the resolver inherits
 * the same auth/endpoint/cache config as the rest of your client.
 *
 * @example
 * ```ts
 * import { SitecoreClient } from "@sitecore-content-sdk/nextjs/client";
 * import { wrapSitecoreClient } from "@/lib/registry/with-sitecore";
 * import config from "../sitecore.config";
 *
 * export const sitecoreClient = wrapSitecoreClient(new SitecoreClient(config));
 * ```
 */
export function wrapSitecoreClient<T extends SitecoreItemDataClient>(
  client: T,
): T {
  // Static-first: the manifest-fed registry resolves known GUIDs sync (no
  // network); only items the build-time manifest doesn't cover fall through
  // to a live query (and backfill the registry). See `registryFirstFetcher`.
  const fetcher = registryFirstFetcher(createSitecoreItemNameFetcher(client));
  return new Proxy(client, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original !== "function") return original;
      if (!LAYOUT_FETCH_METHODS.has(prop)) {
        // Bind to the underlying instance so `this` inside the SDK
        // method points at the real SitecoreClient, not the Proxy.
        return (original as (...args: unknown[]) => unknown).bind(target);
      }
      return async (...args: unknown[]) => {
        let result: unknown;
        try {
          result = await Reflect.apply(
            original as (...a: unknown[]) => Promise<unknown>,
            target,
            args,
          );
        } catch (error) {
          // A layout-fetch that throws during the production build's
          // static prerender must not abort `next build`. Content SDK's
          // `getPage` throws (rather than returning null) when the layout
          // response is empty — e.g. a page whose content isn't resolvable
          // at the build's configured endpoint (not yet published, or a
          // preflight build pointed at a placeholder Edge context). Swallow
          // to null so the route's own `if (!page) notFound()` /
          // `return {}` guards turn it into a 404 page and the build keeps
          // prerendering the pages that DO resolve — the preflight still
          // catches real compile/component-map breaks. At runtime we
          // re-throw, so a genuine fetch failure stays visible instead of
          // silently 404-ing a live site. `NEXT_PHASE` is set to
          // `phase-production-build` by Next only during `next build`.
          if (process.env.NEXT_PHASE === "phase-production-build") {
            console.warn(
              `[wrapSitecoreClient] ${String(prop)} threw during build prerender; treating the page as not-found so the build continues:`,
              error,
            );
            return null;
          }
          throw error;
        }
        if (!result) return result;
        return await resolveLayoutDroplists(result, fetcher);
      };
    },
  });
}

/**
 * Lowercase the first character of a string. Used to convert Sitecore's
 * PascalCase field/param names (`Label`, `ColorScheme`) into the camelCase
 * convention React props use (`label`, `colorScheme`).
 */
function lowerFirst(key: string): string {
  return key.charAt(0).toLowerCase() + key.slice(1);
}

function lowerFirstKeys(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[lowerFirst(k)] = v;
  }
  return out;
}

/**
 * Default Sitecore→props convention: spread `fields` and `params` as props
 * with PascalCase keys lowercased to camelCase, plus pass `isEditing` through
 * so components can gate empty-state chrome on it.
 *
 * `id` is also derived from `params.RenderingIdentifier` and spread last so
 * components extending `CmsProps` get the canonical DOM-id slot populated
 * automatically — the bare params spread would only produce
 * `renderingIdentifier`, which doesn't match `CmsProps.id`. `styles` is
 * already lowercase in `params` and so flows through the params spread
 * unchanged. The `id`/`styles` overrides win against any same-named field
 * (very unlikely in practice — Sitecore field names are conventionally
 * PascalCase nouns like `Title`, not `Id`).
 *
 * `rendering` is always forwarded — it's already part of `CmsProps` so
 * the cost is one prop that field-only components ignore, and any
 * component rendering nested `<Placeholder rendering=…/>` gets it for
 * free without an extra opt-in flag at registration time.
 */
function defaultMap<P>({
  fields,
  params,
  isEditing,
  rendering,
}: SitecoreInput): P {
  return {
    ...lowerFirstKeys(fields as Record<string, unknown> | undefined),
    ...lowerFirstKeys(params as Record<string, unknown> | undefined),
    // Forward the raw layout-service envelope alongside the flattened
    // convenience props. Components written to the flat camelCase
    // convention ignore these; components written to the JSS contract
    // (`fields.Label`, `params.RenderingIdentifier` — e.g.
    // utility-trigger, the image block) need them, and without this
    // passthrough the SDK/composed render path silently dropped their
    // datasource (chrome rendered as empty shells). Spread AFTER the
    // flat props so an unlikely field literally named `Fields`/`Params`
    // can't clobber the envelope.
    fields,
    params,
    isEditing,
    id: params?.RenderingIdentifier,
    styles: params?.styles,
    rendering,
  } as P;
}

const isOptionsBag = <TFields, TProps>(
  value: unknown,
): value is WithSitecoreOptions<TFields, TProps> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Wrap a CMS-agnostic presentation component with a Sitecore adapter.
 *
 * The returned component accepts the layout-service `{fields, params, rendering}`
 * shape and renders the inner component with translated props.
 *
 * Call shapes:
 *   - `withSitecore(Component)` — convention-only. Spreads fields+params
 *     (camelCased), `isEditing`, and `rendering`. The default for any
 *     component-map entry the generator produces.
 *   - `withSitecore(Component, mapFn)` — custom map takes full control of
 *     the props. For variant-token disambiguation, parsing "1"/"true"
 *     booleans, computed props, etc.
 *   - `withSitecore(Component, { droplists, map, flattenLinkedItems })` —
 *     options bag. The `droplists` table auto-resolves Sitecore item GUIDs
 *     to readable names so a `colorScheme: "{abc-…}"` param arrives as
 *     `colorScheme: "primary"` on the component. Composes with `map` and
 *     `flattenLinkedItems`.
 *
 * Field objects (`Field<T>`, `ImageField`, etc.) are passed through as-is by
 * both the default convention and well-written maps, so the inner component
 * can render them via `<Text field=…/>`, `<Image field=…/>`, etc. — EE inline
 * editing depends on those wrappers being in the rendered tree.
 *
 * @example Convention with droplist resolution (the common case)
 * ```ts
 * const COLOR_SCHEME_GUIDS = {
 *   "{1A2B3C4D-…}": "primary",
 *   "{2B3C4D5E-…}": "secondary",
 * } satisfies DroplistLookup;
 *
 * componentMap.set(
 *   "BadgeBlock",
 *   withSitecore(BadgeBlock, { droplists: { colorScheme: COLOR_SCHEME_GUIDS } }),
 * );
 * ```
 */
export function withSitecore<TFields, TPresentationProps>(
  Component: ComponentType<TPresentationProps>,
  mapOrOptions?:
    | ((input: SitecoreInput<TFields>) => TPresentationProps)
    | WithSitecoreOptions<TFields, TPresentationProps>,
) {
  let map: ((input: SitecoreInput<TFields>) => TPresentationProps) | undefined;
  let droplists: DroplistMap<TPresentationProps> | undefined;
  let flattenLinkedItems: readonly string[] | undefined;

  if (typeof mapOrOptions === "function") {
    map = mapOrOptions;
  } else if (isOptionsBag<TFields, TPresentationProps>(mapOrOptions)) {
    map = mapOrOptions.map;
    droplists = mapOrOptions.droplists;
    flattenLinkedItems = mapOrOptions.flattenLinkedItems;
  }

  // Normalize the lookup tables once at registration time so each
  // render is a plain object lookup. Without this, every render would
  // rebuild the brace-stripped/lowercased index for every droplist.
  const normalizedDroplists = droplists
    ? Object.fromEntries(
        Object.entries(droplists)
          .filter((entry): entry is [string, DroplistLookup] =>
            Boolean(entry[1]),
          )
          .map(([key, lookup]) => [key, normalizeLookup(lookup)]),
      )
    : undefined;

  function SitecoreAdapter(input: SitecoreInput<TFields>) {
    // Memoize on the four layout-service input slots. Sitecore's
    // component factory hands us referentially stable `fields`/`params`/
    // `rendering` objects between renders unless the layout actually
    // changed, so this short-circuits the map + droplist substitution
    // work and — more importantly — preserves the `finalProps`
    // reference. That keeps `React.memo`-wrapped inner components from
    // re-rendering when nothing they care about has changed.
    const { fields, params, isEditing, rendering } = input;
    // Ambient wildcard-experience item (see `wildcard-experience@1` +
    // src/lib/registry/wildcard/). `useWildcardItemContext` lives in a
    // `"use client"` module: on the client it reads the context (null
    // when no provider is mounted — the overwhelming common case); in a
    // react-server render the import is a client reference and invoking
    // it throws, which we treat exactly like "no provider" — the
    // bindings overlay is a client-boundary mechanism by design (the
    // wildcard resolver itself is a client hook). The call is
    // unconditional within each environment, so hook ordering is stable.
    let wildcardItem: WildcardItemState | null = null;
    try {
      // The call is unconditional within each environment: on the client
      // it always runs in the same position; in a react-server render it
      // always throws at the client-reference boundary before any hook
      // dispatcher is touched. Ordering is stable per renderer — which is
      // what the rule protects.
      // biome-ignore lint/correctness/useHookAtTopLevel: stable per-renderer ordering — see comment above.
      wildcardItem = useWildcardItemContext();
    } catch {
      // Server render — client context unavailable; stay inert and let
      // authored props flow through unchanged.
    }
    const finalProps = useMemo(() => {
      // Resolve any Droplink-param GUIDs against the module-level
      // registry BEFORE the custom map runs, so map authors see
      // already-resolved tokens (`"primary"`) rather than raw GUIDs.
      // Reference-equal passthrough when the registry is empty or
      // nothing matched, preserving `useMemo` stability.
      const resolvedParams = resolveParamsViaRegistry(params);
      const memoInput = {
        fields,
        params: resolvedParams,
        isEditing,
        rendering,
      } as SitecoreInput<TFields>;
      const baseProps = map
        ? map(memoInput)
        : defaultMap<TPresentationProps>(memoInput as SitecoreInput);
      // Apply Treelist linked-item flattening before droplist
      // resolution. The flattened arrays carry hoisted field shapes
      // (`{id, name, Label, Content, ...}`) which is what most
      // consumers want; droplist substitution then operates on the
      // post-flatten props.
      const flattenedProps = applyFlattenLinkedItems(
        baseProps,
        flattenLinkedItems,
      );
      const mappedProps = applyDroplists(
        flattenedProps,
        normalizedDroplists as DroplistMap<TPresentationProps> | undefined,
      );
      // LAST step: wildcard field bindings. When this rendering sits
      // inside a `wildcard-experience@1` wrapper (ambient resolved item
      // via WildcardItemContext) AND carries a `WildcardBindings` param
      // (JSON prop-name → resolved-field-name map), overlay the mapped
      // resolved fields onto the final props — resolved values win,
      // authored values remain the fallback for unbound / empty fields.
      // Reference-equal pass-through when inert, preserving memo
      // stability for every non-wildcard page.
      return applyWildcardBindings(
        mappedProps,
        resolvedParams?.WildcardBindings,
        wildcardItem,
      ) as TPresentationProps & JSX.IntrinsicAttributes;
      // `wildcardItem` participates in the deps: the provider's state
      // transitions (loading → resolved) must recompute the overlay.
    }, [fields, params, isEditing, rendering, wildcardItem]);
    return <Component {...finalProps} />;
  }
  SitecoreAdapter.displayName = `Sitecore(${Component.displayName ?? Component.name ?? "Component"})`;
  // Brand the adapter so `withSitecoreModule` can detect "already
  // wrapped" exports and skip them (avoids the
  // `withSitecore(withSitecore(Component))` foot-gun when a component
  // file exports its own pre-wrapped variants).
  (SitecoreAdapter as unknown as Record<symbol, boolean>)[WITH_SITECORE_BRAND] =
    true;
  return SitecoreAdapter;
}

/**
 * Brand a component as ALREADY speaking the SDK's native prop shape so
 * `withSitecoreModule` registers it unwrapped. The `withSitecore`
 * adapter maps layout-service input into presentation props — and in
 * doing so DROPS the SDK-injected `page` and `componentMap` props. Most
 * components never miss them, but a component that renders a nested
 * `<AppPlaceholder>` (the partial-design dynamic placeholder) needs
 * both: without `page` the SDK placeholder throws
 * (`page.mode.isEditing` on undefined) — and because every placeholder
 * child is wrapped in the SDK's CLIENT ErrorBoundary, a server-side
 * throw during static prerender makes React serialize the errored
 * subtree (component map of functions included) across the client
 * boundary, surfacing as the misleading "Functions cannot be passed
 * directly to Client Components" build failure instead of the real
 * TypeError.
 */
export function sitecorePassthrough<T>(component: T): T {
  (component as Record<symbol, boolean>)[WITH_SITECORE_BRAND] = true;
  return component;
}

/**
 * Detect whether a value is the output of a `withSitecore(...)` call
 * (and therefore already speaks the layout-service input shape).
 *
 * Used by `withSitecoreModule` to skip re-wrapping. Exported so callers
 * authoring custom component-map templates can replicate the same
 * "skip if already wrapped" rule.
 */
export function isSitecoreWrapped(value: unknown): boolean {
  if (typeof value !== "function" && typeof value !== "object") return false;
  if (value === null) return false;
  return Boolean((value as Record<symbol, unknown>)[WITH_SITECORE_BRAND]);
}

const isComponentLike = (value: unknown): boolean => {
  if (typeof value === "function") return true;
  // `forwardRef` / `memo` / `lazy` / context-provider components are
  // objects with a `$$typeof` symbol — accept them so a starter repo
  // can ship a `forwardRef`-wrapped variant export without losing
  // Sitecore wrapping.
  if (typeof value === "object" && value !== null) {
    return "$$typeof" in value;
  }
  return false;
};

const isModuleMetaKey = (key: string): boolean =>
  // ESM module-namespace objects expose `__esModule`/etc. to interop
  // shims; carrying these into the entry value confuses Sitecore's
  // variant lookup (`component.__esModule` would be truthy and look
  // like a variant). Skip them at merge time.
  key === "__esModule" || key === "Symbol(Symbol.toStringTag)";

/**
 * React component-naming convention: variant exports start with an
 * uppercase letter. `Default`, `Author`, `FullWidth`, `BoxedAccordion`
 * — all PascalCase. Helper utilities (`parseHeadingLayout`,
 * `buildClassName`, `cn`, etc.) are camelCase and MUST be excluded
 * from the component map.
 *
 * Why this filter is load-bearing for `'use client'` modules:
 *
 *   A `'use client'` file's exports are emitted as client references
 *   regardless of whether they're React components or plain helper
 *   functions. When the server-side component map calls a wrapped
 *   helper at render time (the `withSitecore`-wrapped output invokes
 *   the inner function as if it were a component), Next.js intercepts
 *   the cross-boundary invocation and throws:
 *
 *     "Attempted to call parseHeadingLayout() from the server but
 *      parseHeadingLayout is on the client."
 *
 *   Without this filter, every camelCase helper re-exported from a
 *   `*.helpers.tsx` (`'use client'`) sibling lands in the server map
 *   and explodes during prerender. With it, only PascalCase exports
 *   (which by convention are React components) survive — helpers stay
 *   in the source module where their callers can import them
 *   directly, not via the component map.
 *
 * Lowercase plain identifiers (`default` from `export default Foo`)
 * are also excluded here — but NOT forgotten: the SDK's default-variant
 * lookup is `component.default || component.Default || component`, so
 * an entry with neither key makes that chain return the entry OBJECT
 * itself. `ensureDefaultVariant` backstops this after the filter runs
 * (see its doc comment for the prerender failure this prevents).
 */
const isVariantExportName = (key: string): boolean => /^[A-Z]/.test(key);

/**
 * One entry in a Sitecore-adapter spec. Either a custom map function
 * (used as `withSitecore`'s `map` option, the common case for simple
 * field/param translation) or a full options bag for the multi-concern
 * case (droplists + map + Treelist flattening).
 *
 * Generic over `TFields` / `TProps` so an adapter file can carry exact
 * types per variant — `<TFields>` flows from the layout service input
 * the variant authoring expects, `<TProps>` from the inner component.
 */
export type SitecoreAdapterEntry<TFields = unknown, TProps = unknown> =
  | ((input: SitecoreInput<TFields>) => TProps)
  | WithSitecoreOptions<TFields, TProps>;

/**
 * Per-variant adapter spec for a component module. Keys MUST mirror
 * the export names of the paired component module (`default` for the
 * default export, PascalCase named exports otherwise — same lookup
 * key the Sitecore Content SDK uses to resolve variants).
 *
 * Convention (matched by the auto-generated component-map): an adapter
 * file sits next to its component file and named with the `.sitecore`
 * suffix, e.g.:
 *
 * ```
 * src/components/.../avatar-block.tsx           ← components / variants
 * src/components/.../avatar-block.sitecore.ts   ← per-variant adapter
 * ```
 *
 * The adapter file's `default` export pairs with the component file's
 * `default` export; named exports in the adapter file pair with named
 * exports in the component file by exact name.
 *
 * Each entry's value can be:
 *   - A **function** `(input) => props` — used as the variant's custom
 *     map (the most common case: parse param tokens, lowercase
 *     booleans, derive variant flags).
 *   - A **`WithSitecoreOptions` bag** — full surface (droplists + map +
 *     Treelist flattening). Use when one variant needs droplist
 *     resolution or Treelist linked-item flattening.
 */
export type SitecoreAdapter = Record<
  string,
  SitecoreAdapterEntry<unknown, unknown>
>;

const isAdapterCarrier = (
  value: unknown,
): value is { adapter: SitecoreAdapter | undefined } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "adapter" in (value as Record<string, unknown>) &&
  // Distinguish from a regular module namespace that happens to export
  // a value named `adapter`: the carrier object has ONLY `adapter` as
  // an own enumerable key. Module namespaces routinely have many keys
  // (default + variants), so this disambiguation is unambiguous in
  // practice.
  Object.keys(value as Record<string, unknown>).length === 1;

/**
 * Same shape as `isAdapterCarrier` but for the `{ defaultOptions }`
 * variant — applies one set of `withSitecore` options to every
 * variant the module exports, without enumerating each variant by
 * name. This is what the component-map generator emits when it
 * derives `flattenLinkedItems` from the component's recipe at build
 * time — every variant of an `AccordionBlock` consumes the same
 * `Items` Treelist, so a single `defaultOptions: { flattenLinkedItems:
 * ["Items"] }` works for all variants without enumerating Default /
 * Media / Headless separately.
 *
 * Per-variant `adapter:` overrides take precedence over
 * `defaultOptions` when both are present (the adapter is hand-
 * authored / variant-specific, the defaults are recipe-derived).
 */
const isDefaultOptionsCarrier = (
  value: unknown,
): value is { defaultOptions: WithSitecoreOptions<unknown, unknown> } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "defaultOptions" in (value as Record<string, unknown>) &&
  Object.keys(value as Record<string, unknown>).length === 1;

const resolveAdapterEntry = (
  adapter: SitecoreAdapter | undefined,
  exportName: string,
): SitecoreAdapterEntry | undefined => {
  if (!adapter) return undefined;
  if (exportName in adapter) return adapter[exportName];
  // Sitecore SDK falls through `component.default || component.Default
  // || component` for the default-variant lookup; mirror that
  // tolerance for the adapter side so a file that authors `Default` as
  // a named export pairs with a component file using `export default`,
  // and vice versa.
  if (exportName === "default" && "Default" in adapter) {
    return adapter.Default;
  }
  if (exportName === "Default" && "default" in adapter) {
    return adapter.default;
  }
  return undefined;
};

const wrapWithAdapter = (
  value: ComponentType<Record<string, unknown>>,
  entry: SitecoreAdapterEntry | undefined,
): unknown => {
  if (entry === undefined) return withSitecore(value);
  return withSitecore(
    value,
    entry as
      | ((input: SitecoreInput) => Record<string, unknown>)
      | WithSitecoreOptions<unknown, Record<string, unknown>>,
  );
};

/**
 * Merge one or more module-namespace objects (`import * as Foo from
 * "..."`) into a single component map entry value, with each
 * component-shaped export wrapped via `withSitecore` so the layout
 * service can hand the entry raw `{fields, params, rendering,
 * isEditing}` and have it threaded into the inner component.
 *
 * This is the `componentMap.set("AvatarBlock", …)` entry value the
 * Sitecore Content SDK starter expects. The SDK looks up variants via
 * case-sensitive `component[variantName]` indexing on this object
 * (`Default`, `Author`, `FullWidth`, …), so each named export becomes
 * a variant available to authors.
 *
 * Behavior:
 *   - **Already-wrapped exports pass through**. A file exporting
 *     `export default withSitecore(Inner)` won't be double-wrapped —
 *     `withSitecore` brands its output and we detect it.
 *   - **Non-component exports pass through**. Constants, types
 *     (erased), helper functions: kept as-is so Sitecore variant
 *     lookup `component[name]` still works for any consumer that
 *     reaches into the namespace for non-component values.
 *   - **Module-meta keys (`__esModule`) are dropped**. They'd confuse
 *     the SDK's variant lookup ("`__esModule` looks like a variant").
 *   - **Later modules win on key collision**, matching the SDK's
 *     `{ ...A, ...B }` merge order. Use multi-arg form for sibling
 *     variant files (`avatar-block.tsx` + `avatar-block.author.tsx`).
 *   - **`{ adapter }` carrier opts each variant into custom mapping**.
 *     When present, each component export's name is looked up in
 *     `adapter`; a matching function/options-bag entry is passed to
 *     `withSitecore` as the per-variant `map` / options. Missing
 *     entries fall through to convention-only wrapping.
 *
 * @example Single file, multiple named exports (default + variants)
 * ```ts
 * import * as AvatarBlock from "@/components/.../avatar-block";
 * componentMap.set("AvatarBlock", withSitecoreModule(AvatarBlock));
 * // → { default: SitecoreAdapter, Author: SitecoreAdapter }
 * ```
 *
 * @example Sibling variant files
 * ```ts
 * import * as AvatarBlockBase from "@/components/.../avatar-block";
 * import * as AvatarBlockTeam from "@/components/.../avatar-block.team";
 * componentMap.set(
 *   "AvatarBlock",
 *   withSitecoreModule(AvatarBlockBase, AvatarBlockTeam),
 * );
 * ```
 *
 * @example Sibling adapter file (auto-discovered by the generator)
 * ```ts
 * // accordion-block.sitecore.ts
 * export default ({ fields, params }: SitecoreInput<…>) => ({ … });
 * export const Media: WithSitecoreOptions<…, …> = {
 *   droplists: { colorScheme: COLOR_SCHEME_GUIDS },
 *   map: ({ fields, params, rendering }) => ({ … }),
 * };
 *
 * // generated component-map.ts (sketch)
 * import * as AccordionBlock from "@/components/.../accordion-block";
 * import * as AccordionBlockSitecore from "@/components/.../accordion-block.sitecore";
 * componentMap.set(
 *   "AccordionBlock",
 *   withSitecoreModule(AccordionBlock, { adapter: AccordionBlockSitecore }),
 * );
 * ```
 *
 * @example Pre-wrapped exports passed through
 * ```ts
 * // hero-banner.tsx
 * export default withSitecore(HeroDefault, { droplists: { … } });
 * export const FullWidth = withSitecore(HeroFullWidth);
 *
 * // generated component-map.ts
 * componentMap.set("HeroBanner", withSitecoreModule(HeroBanner));
 * // → both exports detected via the brand and passed through unchanged.
 * ```
 */
export function withSitecoreModule(
  // The generator (and hand-authored callers) routinely pass several
  // sibling-file namespaces with structurally distinct exports — e.g.
  // `withSitecoreModule(SectionWrapper, SectionWrapperHelpers,
  // SectionWrapperSubscribeFooterClient)`. Binding a single `T` across
  // all args via `<T extends Record<string, unknown>>` rejects that
  // case at the SECOND arg ("not assignable to T"). Runtime-wise we
  // iterate each arg independently and treat its values as
  // `Record<string, unknown>`, so per-arg type unification offers no
  // benefit, only friction.
  ...args: Array<
    | Record<string, unknown>
    | { adapter: SitecoreAdapter | undefined }
    | { defaultOptions: WithSitecoreOptions<unknown, unknown> }
  >
): Record<string, unknown> {
  const { adapter, defaultOptions, modules } = partitionModuleArgs(args);
  const out: Record<string, unknown> = {};
  for (const mod of modules) {
    flattenModuleInto(out, mod, adapter, defaultOptions);
  }
  // SDK-native fallback: a module whose ONLY component export is
  // `default` — e.g. the Content SDK scaffold's stock
  // `PartialDesignDynamicPlaceholder` — is authored against the SDK's
  // native prop shape (`page`/`componentMap` injected by
  // `AppPlaceholder`), not the registry presentation contract. The
  // PascalCase variant filter above drops `default`, which would leave
  // this entry with no component at all — and the SDK's variant
  // fallback (`component.default || component.Default || component`)
  // would then hand React the entry OBJECT as an element type: a
  // server-side throw that static prerender reports as the misleading
  // "Functions cannot be passed directly to Client Components" build
  // failure (the SDK's client ErrorBoundary makes React serialize the
  // errored subtree). Register the default export RAW — unwrapped — so
  // the SDK renders it natively; wrapping it in `withSitecore` would
  // strip the injected `page` and crash the nested placeholder instead.
  if (!Object.values(out).some((value) => isComponentLike(value))) {
    for (const mod of modules) {
      const def = (mod as Record<string, unknown>).default;
      if (isComponentLike(def)) {
        out.default = def;
        break;
      }
    }
  }
  ensureDefaultVariant(out, modules, adapter, defaultOptions);
  return out;
}

/**
 * Guarantee the SDK's default-variant lookup resolves to a COMPONENT.
 *
 * `getComponentForRendering` (Content SDK `@sitecore-content-sdk/react`,
 * `components/Placeholder/placeholder-utils.js`) resolves the default
 * variant via
 *
 *   component.default || component.Default || component
 *
 * — i.e. when a rendering carries no `params.FieldNames` (or carries
 * `"Default"`), an entry record with NEITHER key falls through to the
 * record OBJECT itself, which `AppPlaceholder` then hands to
 * `React.createElement` as an element type. During static prerender the
 * SDK wraps every placeholder child in its CLIENT ErrorBoundary, so
 * React (Flight) tries to serialize that invalid element across the
 * server→client boundary and the build fails with the misleading
 *
 *   "Functions cannot be passed directly to Client Components …
 *    {LanguageSwitcher: function Sitecore()}"
 *
 * instead of an element-type error. That was exactly the
 * language-switcher case: its module exports `LanguageSwitcher` (named)
 * + `default` (alias) + `componentType` — the PascalCase filter kept
 * only `LanguageSwitcher`, leaving no default-variant key. Every other
 * registry component happens to export a PascalCase `Default`, which is
 * why only language-switcher blew up.
 *
 * Resolution order (first hit wins):
 *   1. A module's component-like `default` export that aliases a named
 *      export already in the record → reuse the wrapped named variant
 *      (one adapter identity for both lookups).
 *   2. A module's component-like `default` export → wrap it (respecting
 *      the `Default`/`default` adapter entry and `defaultOptions`),
 *      pass through if already `withSitecore`-branded.
 *   3. No default export but exactly ONE component in the record →
 *      alias it as `Default` (unambiguous single-variant module).
 *
 * A multi-variant module with no `default` export stays untouched —
 * picking a variant silently would hide an authoring error; the SDK
 * hazard there is the author's signal to export a `Default`.
 */
function ensureDefaultVariant(
  out: Record<string, unknown>,
  modules: Record<string, unknown>[],
  adapter: SitecoreAdapter | undefined,
  defaultOptions: WithSitecoreOptions<unknown, unknown> | undefined,
): void {
  if ("default" in out || "Default" in out) return;
  const componentValues = Object.values(out).filter(isComponentLike);
  // No components at all → the SDK-native raw-`default` fallback above
  // owns that case (and an all-constants entry has nothing to render).
  if (componentValues.length === 0) return;
  for (const mod of modules) {
    const def = (mod as Record<string, unknown>).default;
    if (!isComponentLike(def)) continue;
    // `export default X` re-exporting a named variant we already
    // wrapped: alias the wrapped adapter instead of double-wrapping,
    // so `entry.Default` and `entry.<Name>` share one identity.
    const aliasKey = Object.keys(mod).find(
      (key) =>
        key !== "default" && mod[key] === def && isComponentLike(out[key]),
    );
    if (aliasKey !== undefined) {
      out.Default = out[aliasKey];
      return;
    }
    out.Default = isSitecoreWrapped(def)
      ? def
      : wrapWithAdapter(
          def as ComponentType<Record<string, unknown>>,
          resolveAdapterEntry(adapter, "Default") ?? defaultOptions,
        );
    return;
  }
  if (componentValues.length === 1) {
    out.Default = componentValues[0];
  }
}

interface PartitionedModuleArgs {
  adapter: SitecoreAdapter | undefined;
  defaultOptions: WithSitecoreOptions<unknown, unknown> | undefined;
  modules: Record<string, unknown>[];
}

/** Split the variadic args into the adapter carrier, the defaultOptions
 *  carrier, and the plain export namespaces. */
function partitionModuleArgs(
  args: Array<
    | Record<string, unknown>
    | { adapter: SitecoreAdapter | undefined }
    | { defaultOptions: WithSitecoreOptions<unknown, unknown> }
  >,
): PartitionedModuleArgs {
  let adapter: SitecoreAdapter | undefined;
  let defaultOptions: WithSitecoreOptions<unknown, unknown> | undefined;
  const modules: Record<string, unknown>[] = [];
  for (const arg of args) {
    if (!arg) continue;
    if (isAdapterCarrier(arg)) {
      // Last carrier wins. In practice the generator emits exactly one
      // (sourced from a single sibling `.sitecore.ts` file); a hand-
      // authored second carrier is an authoring slip we'd rather
      // collapse silently than reject loudly.
      adapter = arg.adapter ?? undefined;
      continue;
    }
    if (isDefaultOptionsCarrier(arg)) {
      defaultOptions = arg.defaultOptions;
      continue;
    }
    modules.push(arg);
  }
  return { adapter, defaultOptions, modules };
}

/** Copy a module's variant exports into `out`, wrapping component-like
 *  values with their resolved adapter entry. */
function flattenModuleInto(
  out: Record<string, unknown>,
  mod: Record<string, unknown>,
  adapter: SitecoreAdapter | undefined,
  defaultOptions: WithSitecoreOptions<unknown, unknown> | undefined,
): void {
  for (const [key, value] of Object.entries(mod)) {
    if (isModuleMetaKey(key)) continue;
    // Drop non-PascalCase exports entirely — see `isVariantExportName`
    // for the full rationale. This is the filter that keeps client-
    // boundary helpers (`parseHeadingLayout`, `cn`, etc.) re-exported
    // from `'use client'` sibling files out of the server-side
    // component map, where invoking them at render time would trip
    // Next.js's cross-boundary guard.
    if (!isVariantExportName(key)) continue;
    if (isComponentLike(value) && !isSitecoreWrapped(value)) {
      // Per-variant adapter entries take precedence over the
      // module-wide `defaultOptions` (the adapter is hand-authored
      // and may compose with `defaultOptions`-style fields via its
      // own `flattenLinkedItems` etc.). When no per-variant entry
      // exists, fall back to `defaultOptions` so recipe-derived
      // options apply to every variant without enumerating each.
      const variantEntry = resolveAdapterEntry(adapter, key) ?? defaultOptions;
      out[key] = wrapWithAdapter(
        value as ComponentType<Record<string, unknown>>,
        variantEntry,
      );
    } else {
      out[key] = value;
    }
  }
}
