import { applyAuthoringItem } from "./authoring-apply-bridge";
import {
  collectFieldValidatorSharedFields,
  resolveDataFieldValidators,
} from "./field-validators";
import type { ScsField } from "./provenance";
import {
  emptyWriteStats,
  mergeWriteStats,
  recordWrite,
  type ScsWriteStats,
} from "./authoring-item-model";
import { collectDescriptionLanguageFields } from "./standard-fields";
import { buildTemplateFieldSharedFields } from "./template-field-shared";
import { isMultilineFieldValue } from "./template-field-defaults";
import {
  resolveSiteContentFieldValue,
  type SiteContentMediaContext,
} from "./site-content-items";
import { resolveSortOrder } from "./sort-order";
import { proposeValidItemName } from "./naming";
import { DATA_SECTION, FIELD_DEFINITION, FIELD_IDS } from "./system-ids";
import type { DataFieldDef, DataSectionDef } from "../definitions/types";

export type TemplateFieldSource = {
  id: string;
  value: string;
};

export type AppliedTemplateField = {
  field: DataFieldDef;
  id: string;
  sectionName: string;
  sortOrder: number;
};

export type ApplyTemplateSectionsAndFieldsOptions = {
  handle: string;
  sections: DataSectionDef[];
  /** Parent template item ID (sections are children of this). */
  templateId: string;
  /** @deprecated Ignored — Authoring apply has no template YAML tree. */
  templateDiskDir?: string;
  templateSitecorePath: string;
  stats: ScsWriteStats;
  /** Stable ID key for a section item. */
  sectionIdKey: (sectionName: string) => string;
  /** Stable ID key for a field item. */
  fieldIdKey: (sectionName: string, fieldName: string) => string;
  /**
   * Extra SharedFields on the section (e.g. `__Icon`).
   * `__Sortorder` is always appended by the helper.
   */
  sectionExtraSharedFields?: (ctx: {
    section: DataSectionDef;
    sectionIndex: number;
    sectionSort: number;
  }) => ScsField[];
  /** Optional Source field for a template field. */
  resolveSource?: (field: DataFieldDef) => TemplateFieldSource | undefined;
};

export type ApplyTemplateSectionsAndFieldsResult = {
  sectionSorts: number[];
  fields: AppliedTemplateField[];
};

/**
 * Emit template section + field YAML under an existing template folder.
 * Does not write the parent template item or `__Standard Values` (callers differ).
 */
export async function applyTemplateSectionsAndFields(
  options: ApplyTemplateSectionsAndFieldsOptions,
): Promise<ApplyTemplateSectionsAndFieldsResult> {
  const {
    handle,
    sections,
    templateId,
    templateSitecorePath,
    stats,
    sectionIdKey,
    fieldIdKey,
    sectionExtraSharedFields,
    resolveSource,
  } = options;

  const sectionSorts: number[] = [];
  const emitted: AppliedTemplateField[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex]!;
    const sectionSort = resolveSortOrder(section.sortOrder, sectionIndex);
    sectionSorts.push(sectionSort);

    const sectionName = proposeValidItemName(
      String(section.name || "").trim() || "Content",
      "Content",
    );
    const sectionPath = `${templateSitecorePath}/${sectionName}`;
    // Create/update under the live template id — no client-supplied section id.
    void sectionIdKey;
    void fieldIdKey;
    void handle;
    const sectionShared: ScsField[] = [
      ...(sectionExtraSharedFields?.({
        section,
        sectionIndex,
        sectionSort,
      }) ?? []),
      {
        id: FIELD_IDS.Sortorder,
        hint: "__Sortorder",
        value: sectionSort,
      },
    ];

    const sectionApplied = await applyAuthoringItem({
      parent: templateId,
      template: DATA_SECTION,
      path: sectionPath,
      sharedFields: sectionShared,
    });
    recordWrite(stats, sectionApplied);
    const sectionId = sectionApplied.itemId;

    const sectionFields = section.fields ?? [];
    for (let fieldIndex = 0; fieldIndex < sectionFields.length; fieldIndex++) {
      const field = sectionFields[fieldIndex]!;
      const fieldSort = resolveSortOrder(field.sortOrder, fieldIndex);
      const fieldName = proposeValidItemName(
        String(field.name || "").trim() || "Field",
        "Field",
      );

      const resolvedValidators = await resolveDataFieldValidators(field, handle);
      stats.created += resolvedValidators.stats.created;
      stats.updated += resolvedValidators.stats.updated;
      stats.unchanged += resolvedValidators.stats.unchanged;

      const sharedFields = buildTemplateFieldSharedFields({
        type: field.type,
        sortOrder: fieldSort,
        shared: field.shared,
        source: resolveSource?.(field),
        validators: await collectFieldValidatorSharedFields(
          resolvedValidators.refs,
        ),
      });

      const languageFields = collectDescriptionLanguageFields(
        field.description,
        field.shortDescription,
      );

      const fieldApplied = await applyAuthoringItem({
        parent: sectionId,
        template: FIELD_DEFINITION,
        path: `${sectionPath}/${fieldName}`,
        sharedFields,
        ...(languageFields.length
          ? { languages: [{ language: "en", languageFields }] }
          : {}),
      });
      recordWrite(stats, fieldApplied);

      emitted.push({
        field: { ...field, name: fieldName },
        id: fieldApplied.itemId,
        sectionName,
        sortOrder: fieldSort,
      });
    }

    // Authoring apply does not write field YAML — skip disk hollow-section
    // asserts / prune (those were for serialization push workflows).
  }

  return { sectionSorts, fields: emitted };
}

/**
 * Std-value defaults from emitted fields via the shared rich field resolver
 * (same Link/Image/media encoding as data / site content).
 *
 * - `honorShared: true` (parameters / data): shared fields → SharedFields, else Versions
 * - `honorShared: false` (rendering datasource): all defaults → Versions
 *
 * Multiline YAML is driven by the **field type** (and value shape), not by which
 * emitter called this helper.
 */
export async function collectStandardValueFields(
  fields: AppliedTemplateField[],
  options: {
    honorShared: boolean;
    media: SiteContentMediaContext;
    itemName?: string;
  },
): Promise<{
  shared: ScsField[];
  versioned: ScsField[];
  stats: ScsWriteStats;
}> {
  const shared: ScsField[] = [];
  const versioned: ScsField[] = [];
  let stats = emptyWriteStats();
  const itemName = options.itemName ?? "__Standard Values";

  for (const { field, id, sectionName } of fields) {
    if (field.default === undefined || field.default === null) continue;
    // Match data: empty string defaults are omitted (checkbox false still emits).
    if (field.default === "") continue;

    const resolved = await resolveSiteContentFieldValue(
      { ...field, id, sectionName },
      field.default,
      options.media,
      itemName,
    );
    stats = mergeWriteStats(stats, resolved.stats);

    const entry: ScsField = {
      id,
      hint: field.name,
      value: resolved.value,
      multiline: isMultilineFieldValue(resolved.value, {
        fieldType: field.type,
        richTypeHeuristic: true,
      }),
    };
    if (options.honorShared && field.shared) shared.push(entry);
    else versioned.push(entry);
  }

  return { shared, versioned, stats };
}

/** Section icon used by rendering + parameters section items. */
export function templateSectionIconSharedFields(
  icon = "Office/32x32/window_dialog.png",
): ScsField[] {
  return [
    {
      id: FIELD_IDS.Icon,
      hint: "__Icon",
      value: icon,
    },
  ];
}
