/**
 * Ensure an ScsItem shape on CM via Authoring GraphQL (no YAML write).
 */
import {
  ensureItemByPath,
  updateItemTemplate,
  type AuthoringAuth,
  type AuthoringFieldInput,
} from "./authoring-items";
import { cacheAuthoringPathId } from "./authoring-path-cache";
import { ensureSystemLanguages } from "./ensure-languages";
import type { ScsField, ScsItem } from "./authoring-item-model";
import type { ScsWriteResult } from "./authoring-item-model";
import { TEMPLATE } from "./system-ids";

export type AuthoringApplyItemOptions = {
  endpointName?: string;
  auth?: AuthoringAuth;
  fetchImpl?: typeof fetch;
  language?: string;
  /**
   * Call-site compat with former writeScsItem options.
   * Authoring ensure does not stamp YAML provenance; accepted and ignored.
   */
  bqProvenance?: boolean;
};

/** Live CM identity from Authoring create/find — use for subsequent parent/template. */
export type AuthoringApplyItemResult = {
  write: ScsWriteResult;
  itemId: string;
  path: string;
  created: boolean;
};

/**
 * Normalize aliases to Authoring GraphQL field Names.
 * Live CM lists Display Name as `__Display name` (lowercase n).
 */
const AUTHORING_FIELD_NAME: Record<string, string> = {
  "__Display Name": "__Display name",
  __DisplayName: "__Display name",
};

/** Appearance fields Authoring rejects on `__Standard Values` items. */
const STANDARD_VALUES_SKIP_FIELDS = new Set(["__Icon", "__Sortorder"]);

function toAuthoringFieldName(hint: string): string {
  return AUTHORING_FIELD_NAME[hint] || hint;
}

function isStandardValuesPath(sitecorePath: string): boolean {
  return /\/__Standard Values$/i.test(sitecorePath.trim());
}

function isBaseTemplateFieldName(name: string): boolean {
  return /^__Base templates?$/i.test(name.trim());
}

/**
 * Parse `__Base template` pipe/newline GUID list into Authoring baseTemplates IDs.
 */
export function parseBaseTemplateIds(raw: string | undefined): string[] {
  return String(raw || "")
    .split(/[\r\n|]+/)
    .map((s) => s.trim())
    .filter((s) => /[{]?[0-9a-fA-F-]{36}[}]?/.test(s));
}

function fieldsFromScs(
  item: ScsItem,
  language = "en",
  options?: {
    standardValues?: boolean;
    includeShared?: boolean;
    /** Strip `__Base template` — applied via updateItemTemplate.baseTemplates. */
    stripBaseTemplate?: boolean;
  },
): AuthoringFieldInput[] {
  const out: AuthoringFieldInput[] = [];
  const push = (fields: ScsField[] | undefined) => {
    for (const f of fields || []) {
      const raw = String(f.hint || "").trim();
      if (!raw) continue;
      const name = toAuthoringFieldName(raw);
      // Skip system metadata that Authoring rejects / ignores on create.
      if (
        name === "__Revision" ||
        name === "__Updated" ||
        name === "__Updated by" ||
        name === "__Created" ||
        name === "__Created by" ||
        name === "Blob"
      ) {
        continue;
      }
      // Inheritance must use updateItemTemplate.baseTemplates, not updateItem.
      if (options?.stripBaseTemplate && isBaseTemplateFieldName(name)) {
        continue;
      }
      // Template icons/sort live on the template definition, not Std Values.
      if (options?.standardValues && STANDARD_VALUES_SKIP_FIELDS.has(name)) {
        continue;
      }
      out.push({ name, value: String(f.value ?? "") });
    }
  };

  // Shared once on the primary language pass (not re-sent per culture).
  if (options?.includeShared !== false) {
    push(item.sharedFields);
  }

  if (item.languages?.length) {
    const block = item.languages.find((l) => l.language === language);
    if (!block) {
      return [];
    }
    push(block.languageFields);
    if (block.versions?.length) {
      const version =
        block.versions.find((v) => v.version === 1) || block.versions[0];
      push(version?.versionFields);
    } else {
      push(block.versionFields);
    }
  } else {
    push(item.languageFields);
    push(item.versionFields);
  }

  // Dedupe by field name (last wins).
  const map = new Map<string, AuthoringFieldInput>();
  for (const f of out) map.set(f.name, f);
  return [...map.values()];
}

function iterScsFieldGroups(item: ScsItem): Array<ScsField[] | undefined> {
  return [
    item.sharedFields,
    ...(item.languages || []).flatMap((l) => [
      l.languageFields,
      l.versionFields,
      ...(l.versions || []).map((v) => v.versionFields),
    ]),
    item.languageFields,
    item.versionFields,
  ];
}

function extractIconHint(item: ScsItem): string | undefined {
  for (const group of iterScsFieldGroups(item)) {
    for (const f of group || []) {
      if (String(f.hint || "").trim() === "__Icon") {
        const value = String(f.value ?? "").trim();
        if (value) return value;
      }
    }
  }
  return undefined;
}

function extractBaseTemplateIds(item: ScsItem): string[] {
  for (const group of iterScsFieldGroups(item)) {
    for (const f of group || []) {
      const hint = String(f.hint || "").trim();
      if (!isBaseTemplateFieldName(hint)) continue;
      const ids = parseBaseTemplateIds(String(f.value ?? ""));
      if (ids.length) return ids;
    }
  }
  return [];
}

function isTemplateDefinitionItem(item: ScsItem): boolean {
  const templateId = String(item.template || "")
    .replace(/[{}]/g, "")
    .toLowerCase();
  return templateId === TEMPLATE.replace(/[{}]/g, "").toLowerCase();
}

/**
 * Ensure the item exists at `item.path` under `item.parent` with `item.template`.
 * Returns the live CM `itemId` from create/find — callers must use that for parenting.
 */
export async function ensureAuthoringItemFromScs(
  item: ScsItem,
  options: AuthoringApplyItemOptions = {},
): Promise<AuthoringApplyItemResult> {
  const path = String(item.path || "").trim();
  if (!path) {
    throw new Error("[bq:apply] ensureAuthoringItemFromScs requires item.path");
  }
  if (!item.parent) {
    throw new Error(`[bq:apply] ensureAuthoringItemFromScs requires item.parent for ${path}`);
  }
  if (!item.template) {
    throw new Error(
      `[bq:apply] ensureAuthoringItemFromScs requires item.template for ${path}`,
    );
  }

  const primaryLanguage = options.language || "en";
  const standardValues = isStandardValuesPath(path);
  const cultureNames = [
    ...new Set(
      (item.languages || [])
        .map((l) => String(l.language || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!cultureNames.includes(primaryLanguage)) {
    cultureNames.unshift(primaryLanguage);
  }
  // Culture versions need the language registered in the environment first
  // (Sites API POST /api/v1/languages → /sitecore/system/Languages/{culture}).
  await ensureSystemLanguages(cultureNames);

  const isTemplateDef = isTemplateDefinitionItem(item);
  const fields = fieldsFromScs(item, primaryLanguage, {
    standardValues,
    includeShared: true,
    stripBaseTemplate: isTemplateDef,
  });
  const result = await ensureItemByPath({
    path,
    parentId: item.parent,
    templateId: item.template,
    language: primaryLanguage,
    fields,
    endpointName: options.endpointName,
    auth: options.auth,
    fetchImpl: options.fetchImpl,
  });

  cacheAuthoringPathId(path, result.itemId);

  // Apply remaining language blocks (`__Display name` + versioned fields).
  for (const culture of cultureNames) {
    if (culture === primaryLanguage) continue;
    const cultureFields = fieldsFromScs(item, culture, {
      standardValues,
      includeShared: false,
      stripBaseTemplate: isTemplateDef,
    });
    if (!cultureFields.length) continue;
    await ensureItemByPath({
      path,
      parentId: item.parent,
      templateId: item.template,
      language: culture,
      fields: cultureFields,
      endpointName: options.endpointName,
      auth: options.auth,
      fetchImpl: options.fetchImpl,
    });
  }

  // Template definition: icon + baseTemplates via updateItemTemplate
  // (updateItem `__Base template` / `__Icon` do not set inheritance correctly).
  if (isTemplateDef && !standardValues) {
    const icon = extractIconHint(item);
    const baseTemplates = extractBaseTemplateIds(item);
    if (icon || baseTemplates.length) {
      try {
        await updateItemTemplate({
          templateId: result.itemId,
          ...(icon ? { icon } : {}),
          ...(baseTemplates.length ? { baseTemplates } : {}),
          path,
          endpointName: options.endpointName,
          auth: options.auth,
          fetchImpl: options.fetchImpl,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[bq:apply] updateItemTemplate failed for ${path}: ${msg.slice(0, 160)}`,
        );
      }
    }
  }

  return {
    write: result.created ? "created" : "updated",
    itemId: result.itemId,
    path: result.path || path,
    created: result.created,
  };
}
