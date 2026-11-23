import type { ExistingCreateProvenance, ScsField } from "./provenance";

export type { ScsField };
import { FIELD_IDS } from "./system-ids";

export type ScsVersionBlock = {
  /** Sitecore version number (1, 2, …). Defaults to 1 when omitted. */
  version?: number;
  /** Versioned fields */
  versionFields?: ScsField[];
};

export type ScsLanguageBlock = {
  /** Sitecore culture name, e.g. `en`, `nl-BE` */
  language: string;
  /** Unversioned language fields */
  languageFields?: ScsField[];
  /**
   * Numbered versions under this language.
   * Prefer this over `versionFields` when emitting more than Version 1.
   */
  versions?: ScsVersionBlock[];
  /** Legacy: single Version 1 field bag (used when `versions` is omitted). */
  versionFields?: ScsField[];
};

export type ScsItem = {
  /**
   * Optional legacy/provisional id. Authoring apply ignores this — identity
   * comes from find-by-path or createItem (returned itemId).
   */
  id?: string;
  parent: string;
  template: string;
  path: string;
  /**
   * Sitecore branch template ID the item was created from (SCS `BranchID:`).
   * Preserved from disk on update when present; omit for newly created items.
   */
  branchId?: string;
  sharedFields?: ScsField[];
  /**
   * Multi-language blocks. When omitted, falls back to en-only
   * `languageFields` / `versionFields` below.
   */
  languages?: ScsLanguageBlock[];
  /** Language "en" unversioned fields (legacy / single-lang) */
  languageFields?: ScsField[];
  /** Language "en" version 1 fields (legacy / single-lang) */
  versionFields?: ScsField[];
};

/**
 * Sitecore Multilist / TreeList raw field value for Authoring GraphQL.
 * Multiple IDs must be `|`-separated (not newlines — SCS YAML uses one-per-line,
 * but live CM storage and GraphQL updates expect pipes).
 */
export function formatMultilistItems(
  items: string[],
): Pick<ScsField, "value" | "multiline"> {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) return { value: "" };
  return { value: normalized.join("|") };
}

/**
 * Read `__Created` / `__Created by` / `__Updated` / `__Updated by` / `__Revision`
 * from an existing SCS YAML body.
 */
export function readExistingVersionProvenance(
  yaml: string,
): ExistingCreateProvenance {
  return {
    created: readVersionFieldValue(yaml, FIELD_IDS.Created),
    createdBy: readVersionFieldValue(yaml, FIELD_IDS.CreatedBy),
    owner: readVersionFieldValue(yaml, FIELD_IDS.Owner),
    updated: readVersionFieldValue(yaml, FIELD_IDS.Updated),
    updatedBy: readVersionFieldValue(yaml, FIELD_IDS.UpdatedBy),
    revision: readVersionFieldValue(yaml, FIELD_IDS.Revision),
  };
}

/** @deprecated Use {@link readExistingVersionProvenance}. */
export function readExistingCreateProvenance(
  yaml: string,
): ExistingCreateProvenance {
  return readExistingVersionProvenance(yaml);
}

function stripYamlBom(yaml: string): string {
  return String(yaml || "").replace(/^\uFEFF/, "");
}

function unquoteYamlScalar(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    try {
      return JSON.parse(t) as string;
    } catch {
      return t.slice(1, -1);
    }
  }
  return t;
}

function readVersionFieldValue(
  yaml: string,
  fieldId: string,
): string | undefined {
  const normalized = stripYamlBom(yaml).replace(/\r\n/g, "\n");
  const id = fieldId.toLowerCase();
  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/^\s*- ID: "([^"]+)"\s*$/);
    if (!match || match[1]!.toLowerCase() !== id) continue;

    // Hint line, then Value
    let j = i + 1;
    while (j < lines.length && /^\s*Hint:/.test(lines[j]!)) j += 1;
    const valueLine = lines[j];
    if (!valueLine) return undefined;

    const plain = valueLine.match(/^\s*Value:\s*(.*)$/);
    if (!plain) return undefined;
    const raw = plain[1]!;
    if (raw === "|") {
      const parts: string[] = [];
      j += 1;
      // Continuation lines are indented; stop before the next `- ID:` field entry.
      while (j < lines.length) {
        const line = lines[j]!;
        if (/^\s*- ID: "/.test(line)) break;
        if (/^\s*(Versions|Languages|Fields|SharedFields):/.test(line)) break;
        if (!/^\s{4,}/.test(line)) break;
        parts.push(line.replace(/^\s+/, ""));
        j += 1;
      }
      return parts.join("\n").trim();
    }
    return unquoteYamlScalar(raw);
  }
  return undefined;
}

export type ScsWriteResult = "created" | "updated" | "unchanged";

/** Authoring apply result — use `write` for stats; prefer `itemId` for parenting. */
export type ScsApplyWriteResult = {
  write: ScsWriteResult;
  itemId?: string;
  path?: string;
  created?: boolean;
};

export type ScsWriteStats = {
  created: number;
  updated: number;
  unchanged: number;
};

export function emptyWriteStats(): ScsWriteStats {
  return { created: 0, updated: 0, unchanged: 0 };
}

export function toScsWriteResult(
  result: ScsWriteResult | ScsApplyWriteResult,
): ScsWriteResult {
  return typeof result === "string" ? result : result.write;
}

export function recordWrite(
  stats: ScsWriteStats,
  result: ScsWriteResult | ScsApplyWriteResult,
): void {
  stats[toScsWriteResult(result)] += 1;
}

export function mergeWriteStats(...all: ScsWriteStats[]): ScsWriteStats {
  const out = emptyWriteStats();
  for (const stats of all) {
    out.created += stats.created;
    out.updated += stats.updated;
    out.unchanged += stats.unchanged;
  }
  return out;
}

/** e.g. `1/20 items created, 10/20 items updated, 9/20 items unchanged` */
export function formatWriteStats(stats: ScsWriteStats): string {
  const total = stats.created + stats.updated + stats.unchanged;
  if (total === 0) return "0 items written";
  const parts: string[] = [];
  if (stats.created) parts.push(`${stats.created}/${total} items created`);
  if (stats.updated) parts.push(`${stats.updated}/${total} items updated`);
  if (stats.unchanged) parts.push(`${stats.unchanged}/${total} items unchanged`);
  return parts.join(", ");
}
