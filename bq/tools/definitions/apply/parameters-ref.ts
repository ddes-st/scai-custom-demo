import {
  definitionKeyFromRef,
  isDefinitionKeyRef,
  isParametersModelDef,
  isSitecoreGuidRef,
  isSitecorePathRef,
  sitecoreGuidFromRef,
  sitecorePathFromRef,
} from "../../shared/definition-ref";
import { braceGuid } from "../../shared/ids";
import { getProjectTemplatesSitecorePath } from "../../shared/data-placement";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import type { Definition, RenderingDefinition } from "../types";

export function validateRenderingParametersSources(
  definition: RenderingDefinition,
): void {
  const inline = isParametersModelDef(definition.parameters);
  const keyRef = isDefinitionKeyRef(definition.parameters);
  const pathRef = isSitecorePathRef(definition.parameters);
  const guidRef = isSitecoreGuidRef(definition.parameters);
  const sources = [
    inline ? "inline" : null,
    keyRef ? "definitionKey" : null,
    pathRef ? "path" : null,
    guidRef ? "guid" : null,
    definition.parametersTemplateId ? "parametersTemplateId" : null,
  ].filter(Boolean);

  if (sources.length > 1) {
    throw new Error(
      `rendering "${definition.definitionKey}": use only one parameters source ` +
        `({ sections } | { definitionKey } | { path } | { guid } | parametersTemplateId) ` +
        `(found: ${sources.join(", ")})`,
    );
  }

  if (
    definition.parameters != null &&
    !inline &&
    !keyRef &&
    !pathRef &&
    !guidRef
  ) {
    throw new Error(
      `rendering "${definition.definitionKey}": parameters must be { sections: […] } | { definitionKey } | { path } | { guid }`,
    );
  }
}

function branchNameForDefinition(definition: Definition): string | undefined {
  if (definition.kind === "parameters" || definition.kind === "rendering") {
    return definition.name.trim();
  }
  return undefined;
}

/**
 * Resolve the parameters template item ID for a rendering YAML field.
 * Returns undefined when no parameters source is configured / inline emit owns it.
 */
export async function resolveParametersTemplateReference(options: {
  definition: RenderingDefinition;
  registry: Map<string, Definition>;
  collectionSystem: string;
  endpointName?: string;
  lookupPath?: (sitecorePath: string) => Promise<string | undefined>;
  skipCm?: boolean;
}): Promise<string | undefined> {
  const { definition, registry, collectionSystem } = options;

  if (isParametersModelDef(definition.parameters)) {
    return undefined;
  }

  if (definition.parametersTemplateId) {
    const raw = definition.parametersTemplateId.trim();
    return raw.startsWith("{") ? raw : braceGuid(raw.replace(/[{}]/g, ""));
  }

  if (isSitecoreGuidRef(definition.parameters)) {
    return braceGuid(sitecoreGuidFromRef(definition.parameters));
  }

  if (isSitecorePathRef(definition.parameters)) {
    const sitecorePath = sitecorePathFromRef(definition.parameters);
    const resolved = await resolveItemIdByPath({
      sitecorePath,
      endpointName: options.endpointName,
      lookupPath: options.lookupPath,
      skipCm: options.skipCm,
      logPrefix: "[bq:apply:parameters-ref]",
    });
    if (!resolved.found) {
      throw new Error(
        `rendering "${definition.definitionKey}" parameters path not found on CM: ${sitecorePath}`,
      );
    }
    return braceGuid(resolved.id);
  }

  if (isDefinitionKeyRef(definition.parameters)) {
    const key = definitionKeyFromRef(definition.parameters);
    const ref = registry.get(key);

    if (!ref) {
      throw new Error(
        `rendering "${definition.definitionKey}": parameters { definitionKey: "${key}" } not found in registry — cannot resolve its template path on CM`,
      );
    }

    {
      const branchName = branchNameForDefinition(ref);
      if (!branchName) {
        throw new Error(
          `rendering "${definition.definitionKey}": parameters { definitionKey: "${key}" } must reference a parameters or rendering definition`,
        );
      }
      if (
        ref.kind === "rendering" &&
        !isParametersModelDef(ref.parameters)
      ) {
        throw new Error(
          `rendering "${definition.definitionKey}": referenced rendering "${key}" has no inline parameters`,
        );
      }
      const sitecorePath =
        `${getProjectTemplatesSitecorePath(collectionSystem)}/` +
        `${branchName}/${branchName} Parameters`;
      // Authoring cache → CM path lookup; never mint a GUID for the reference.
      const resolved = await resolveItemIdByPath({
        sitecorePath,
        endpointName: options.endpointName,
        lookupPath: options.lookupPath,
        skipCm: options.skipCm,
        logPrefix: "[bq:apply:parameters-ref]",
      });
      if (!resolved.found) {
        throw new Error(
          `rendering "${definition.definitionKey}": parameters template for "${key}" ` +
            `not found on CM at ${sitecorePath} — apply that parameters definition first`,
        );
      }
      return braceGuid(resolved.id);
    }
  }

  return undefined;
}
