import type { ScsField } from "./provenance";
import { FIELD_IDS } from "./system-ids";

export type TemplateFieldSourceField = {
  id: string;
  value: string;
};

export type TemplateFieldSharedOptions = {
  type: string;
  sortOrder: number;
  shared?: boolean;
  source?: TemplateFieldSourceField;
  validators?: ScsField[];
};

/**
 * SharedFields order aligned with SCS pull:
 * Source (when set) → validator multilists → Type → __Sortorder → Shared.
 */
export function buildTemplateFieldSharedFields(
  options: TemplateFieldSharedOptions,
): ScsField[] {
  const fields: ScsField[] = [];

  if (options.source) {
    fields.push({
      id: options.source.id,
      hint: "Source",
      value: options.source.value,
    });
  }

  if (options.validators?.length) {
    fields.push(...options.validators);
  }

  fields.push({
    id: FIELD_IDS.Type,
    hint: "Type",
    value: options.type,
  });

  fields.push({
    id: FIELD_IDS.Sortorder,
    hint: "__Sortorder",
    value: options.sortOrder,
  });

  if (options.shared) {
    fields.push({
      id: FIELD_IDS.TemplateFieldShared,
      hint: "Shared",
      value: "1",
    });
  }

  return fields;
}
