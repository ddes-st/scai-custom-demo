import { PROVENANCE_CREATED_BY } from "./paths";
import { FIELD_IDS } from "./system-ids";

/** Fixed timestamp so regenerations stay byte-stable. */
export const CREATED_TIMESTAMP = "20260101T120000Z";

/**
 * @deprecated Headers are no longer emitted (SCS pull format has none).
 * Kept for callers that still import the symbol.
 */
export function yamlFileHeader(): string {
  return "";
}

export type ExistingCreateProvenance = {
  created?: string;
  createdBy?: string;
  owner?: string;
  updated?: string;
  updatedBy?: string;
  revision?: string;
};

/** True when `__Created by` (or `__Updated by` fallback) is the BQ actor. */
export function isBqProvenanceActor(
  provenance?: ExistingCreateProvenance,
): boolean {
  const actor =
    provenance?.createdBy?.trim() || provenance?.updatedBy?.trim();
  return actor === PROVENANCE_CREATED_BY;
}

function needsMultilineYaml(value: string): boolean {
  // SCS pull uses `Value: |` for domain\user account strings (Owner, Created by, …).
  return value.includes("\n") || value.includes("\\");
}

/**
 * Version provenance fields for SCS Languages.Versions.
 *
 * - **create**: sets `__Created` / `__Created by` and `__Updated` / `__Updated by` to BQ
 * - **update**: preserves existing create/update/revision fields from disk when present
 * Field order matches SCS pull on update:
 * Created, Owner, Created by, Revision, Updated by, Updated.
 * Create mode: Created, Created by, Updated by, Updated.
 */
export function provenanceVersionFields(
  mode: "create" | "update" = "create",
  existing?: ExistingCreateProvenance,
): ScsField[] {
  const fields: ScsField[] = [];

  if (mode === "create") {
    fields.push(
      {
        id: FIELD_IDS.Created,
        hint: "__Created",
        value: CREATED_TIMESTAMP,
      },
      {
        id: FIELD_IDS.CreatedBy,
        hint: "__Created by",
        value: PROVENANCE_CREATED_BY,
      },
    );
  } else {
    if (existing?.created) {
      fields.push({
        id: FIELD_IDS.Created,
        hint: "__Created",
        value: existing.created,
      });
    }
    if (existing?.owner) {
      fields.push({
        id: FIELD_IDS.Owner,
        hint: "__Owner",
        value: existing.owner,
        multiline: needsMultilineYaml(existing.owner),
      });
    }
    if (existing?.createdBy) {
      fields.push({
        id: FIELD_IDS.CreatedBy,
        hint: "__Created by",
        value: existing.createdBy,
        multiline: needsMultilineYaml(existing.createdBy),
      });
    }
    if (existing?.revision) {
      fields.push({
        id: FIELD_IDS.Revision,
        hint: "__Revision",
        value: existing.revision,
      });
    }
  }

  // SCS pull order: __Updated by before __Updated; BQ stays single-line on create.
  fields.push({
    id: FIELD_IDS.UpdatedBy,
    hint: "__Updated by",
    value:
      mode === "update" && existing?.updatedBy
        ? existing.updatedBy
        : PROVENANCE_CREATED_BY,
    multiline:
      mode === "update" && existing?.updatedBy
        ? needsMultilineYaml(existing.updatedBy)
        : false,
  });
  fields.push({
    id: FIELD_IDS.Updated,
    hint: "__Updated",
    value:
      mode === "update" && existing?.updated
        ? existing.updated
        : CREATED_TIMESTAMP,
  });

  return fields;
}

export type ScsField = {
  id: string;
  hint: string;
  value: string | number;
  multiline?: boolean;
  /** Sitecore media Blob field companion GUID */
  blobId?: string;
};
