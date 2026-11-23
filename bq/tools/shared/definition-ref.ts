/**
 * Shared cross-ref shapes for definition files.
 *
 * Sitecore tree vs BQ ownership:
 * - `{ definitionKey }` — another BQ definition (resolved at emit)
 * - `{ path }` — Sitecore **content tree** path (not a disk path)
 * - `{ guid }` — Sitecore item id
 * - `{ rule }` — Field Rules–relative name (`Required`, `Common/Is Email`)
 *
 * Media/image sources (exactly one): `url` | `base64` | `svgMarkup` | `path` | `guid` | `definitionKey`
 *
 * Emitters resolve these to whatever that Sitecore field’s YAML expects (GUID, path, XML, …).
 */

export type DefinitionKeyRef = {
  definitionKey: string;
};

/** Sitecore content-tree path, e.g. `/sitecore/media library/…`. */
export type SitecorePathRef = {
  path: string;
};

/** Sitecore item GUID (`{…}` or bare). */
export type SitecoreGuidRef = {
  guid: string;
};

/**
 * Name under `/sitecore/system/Settings/Validation Rules/Field Rules/`
 * (e.g. `Required`, `Common/Is Email`) — not a full tree path.
 */
export type FieldRuleRef = {
  rule: string;
};

/** Point at an existing Sitecore item or a BQ definition. */
export type SitecoreItemRef =
  | DefinitionKeyRef
  | SitecorePathRef
  | SitecoreGuidRef;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/**
 * True when `value` is a definition cross-ref (has `definitionKey`, not an inline model).
 * Inline `parameters: { sections: […] }` is excluded.
 */
export function isDefinitionKeyRef(value: unknown): value is DefinitionKeyRef {
  const record = asRecord(value);
  if (!record) return false;
  if (typeof record.definitionKey !== "string" || !record.definitionKey.trim()) {
    return false;
  }
  if (Array.isArray(record.sections)) return false;
  return true;
}

export function isSitecorePathRef(value: unknown): value is SitecorePathRef {
  const record = asRecord(value);
  return Boolean(
    record && typeof record.path === "string" && record.path.trim(),
  );
}

export function isSitecoreGuidRef(value: unknown): value is SitecoreGuidRef {
  const record = asRecord(value);
  return Boolean(
    record && typeof record.guid === "string" && record.guid.trim(),
  );
}

export function isFieldRuleRef(value: unknown): value is FieldRuleRef {
  const record = asRecord(value);
  return Boolean(
    record && typeof record.rule === "string" && record.rule.trim(),
  );
}

export function definitionKeyFromRef(ref: DefinitionKeyRef): string {
  const key = ref.definitionKey.trim();
  if (!key) throw new Error("definitionKey must be non-empty");
  return key;
}

export function sitecorePathFromRef(ref: SitecorePathRef): string {
  const p = ref.path.trim().replace(/\\/g, "/");
  if (!p) throw new Error("path must be non-empty");
  return p;
}

export function sitecoreGuidFromRef(ref: SitecoreGuidRef): string {
  const raw = ref.guid.trim();
  if (!raw) throw new Error("guid must be non-empty");
  const bare = raw.replace(/[{}]/g, "").toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      bare,
    )
  ) {
    throw new Error(`Invalid Sitecore guid: "${ref.guid}"`);
  }
  return bare;
}

export function fieldRuleFromRef(ref: FieldRuleRef): string {
  const rule = ref.rule.trim();
  if (!rule) throw new Error("rule must be non-empty");
  return rule;
}

/** Inline rendering-parameters model (`{ sections: […] }`). */
export function isParametersModelDef(
  value: unknown,
): value is { sections: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Array.isArray((value as { sections?: unknown }).sections)
  );
}

/** Inline headless variants list. */
export function isInlineVariantsList(
  value: unknown,
): value is Array<{ name: string }> {
  return Array.isArray(value);
}

const IMAGE_SOURCE_KEYS = [
  "url",
  "base64",
  "svgMarkup",
  "path",
  "guid",
  "definitionKey",
] as const;

export type ImageSourceKey = (typeof IMAGE_SOURCE_KEYS)[number];

/** Which single image/media source key is set (ignores empty strings). */
export function activeImageSourceKeys(
  value: Record<string, unknown>,
): ImageSourceKey[] {
  return IMAGE_SOURCE_KEYS.filter((key) => {
    const v = value[key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function assertSingleImageSource(
  value: Record<string, unknown>,
  label: string,
): ImageSourceKey {
  const keys = activeImageSourceKeys(value);
  if (keys.length === 0) {
    throw new Error(
      `${label}: Image value needs exactly one of url | base64 | svgMarkup | path | guid | definitionKey`,
    );
  }
  if (keys.length > 1) {
    throw new Error(
      `${label}: Image value must not mix sources (found: ${keys.join(", ")})`,
    );
  }
  return keys[0]!;
}
