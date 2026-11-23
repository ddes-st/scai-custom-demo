import { stableGuid } from "../../shared/ids";
import {
  isDefinitionKeyRef,
  isParametersModelDef,
  isSitecoreGuidRef,
  isSitecorePathRef,
} from "../../shared/definition-ref";
import { PLACEHOLDER_KEYS } from "../../shared/system-ids";
import type { ScsWriteStats } from "../../shared/authoring-item-model";
import type { ComponentTemplateDefinition, Definition } from "../types";
import { applyRenderingDefinition } from "./rendering";
import { mapComponentToRenderingDefinition } from "./component-to-rendering";

/**
 * Component façade — orchestrates the same emit path as `kind: "rendering"`.
 *
 * Hybrid reuse: keep inline `parameters` / `model` here, or extract a standalone
 * `kind: "parameters"` / `kind: "data"` definition and set
 * `parameters: { definitionKey: "…" }` (and share model via separate data defs when needed).
 */
export async function applyComponentDefinition(
  definition: ComponentTemplateDefinition,
  registry: Map<string, Definition>,
): Promise<ScsWriteStats> {
  if (!definition.model?.folderTemplate || !definition.model?.itemTemplate) {
    throw new Error(
      `component "${definition.definitionKey}" must declare model: { folderTemplate, itemTemplate }`,
    );
  }

  const sources = [
    isParametersModelDef(definition.parameters) ? "inline" : null,
    isDefinitionKeyRef(definition.parameters) ? "definitionKey" : null,
    isSitecorePathRef(definition.parameters) ? "path" : null,
    isSitecoreGuidRef(definition.parameters) ? "guid" : null,
    definition.parametersTemplateId ? "parametersTemplateId" : null,
  ].filter(Boolean);
  if (sources.length > 1) {
    throw new Error(
      `component "${definition.definitionKey}": use only one parameters source ` +
        `({ sections } | { definitionKey } | { path } | { guid } | parametersTemplateId) ` +
        `(found: ${sources.join(", ")})`,
    );
  }

  const renderingDef = mapComponentToRenderingDefinition(definition);
  return applyRenderingDefinition(renderingDef, registry);
}

/** Exported for content emitter — same field ID algorithm as rendering. */
export function definitionFieldId(
  definitionHandle: string,
  section: string,
  fieldName: string,
): string {
  return stableGuid(definitionHandle, `field:${section}:${fieldName}`);
}

export function definitionDatasourceTemplateId(definitionHandle: string): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.datasource);
}

export function definitionChildDatasourceTemplateId(
  definitionHandle: string,
): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.childDatasource);
}

export function definitionFolderTemplateId(definitionHandle: string): string {
  return stableGuid(definitionHandle, PLACEHOLDER_KEYS.folder);
}
