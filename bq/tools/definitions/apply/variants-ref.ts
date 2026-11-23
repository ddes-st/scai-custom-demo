import type { Definition, VariantsDefinition } from "../types";
import {
  definitionKeyFromRef,
  isDefinitionKeyRef,
  isInlineVariantsList,
  isSitecoreGuidRef,
  isSitecorePathRef,
  sitecoreGuidFromRef,
  sitecorePathFromRef,
} from "../../shared/definition-ref";
import { requireVariantsDefinition } from "../../shared/variants-registry";
import { resolveItemIdByPath } from "../../shared/resolve-item-id-by-path";
import {
  emptyWriteStats,
  type ScsWriteStats,
} from "../../shared/authoring-item-model";
import {
  applyVariantsDefinition,
  shouldApplyHeadlessVariants,
  variantsDefinitionFromInline,
} from "./variants";

/**
 * Resolve inline `variants` list or `{ definitionKey | path | guid }` and emit
 * Headless Variants when BQ-owned / inline. Path/guid = existing items (no emit).
 * Default-only lists skip YAML (single export is always Default).
 */
export async function applyRenderingVariants(options: {
  definition: {
    definitionKey: string;
    componentName?: string;
    name: string;
    icon?: string;
    collectionSystem?: string;
    siteSystem?: string;
    variants?:
      | Array<{ name: string }>
      | { definitionKey: string }
      | { path: string }
      | { guid: string };
  };
  componentName: string;
  handle: string;
  registry?: Map<string, Definition>;
}): Promise<ScsWriteStats> {
  const { definition, componentName, handle } = options;
  const variants = definition.variants;
  const siteOpts = {
    collectionSystem: definition.collectionSystem,
    siteSystem: definition.siteSystem,
  };

  if (variants == null) {
    return emptyWriteStats();
  }

  // Existing Sitecore variants folder — verify, do not re-emit.
  if (isSitecorePathRef(variants)) {
    const sitecorePath = sitecorePathFromRef(variants);
    const resolved = await resolveItemIdByPath({
      sitecorePath,
      logPrefix: "[bq:apply:variants-ref]",
    });
    if (!resolved.found) {
      throw new Error(
        `rendering/component "${definition.definitionKey}" variants path not found on CM: ${sitecorePath}`,
      );
    }
    return emptyWriteStats();
  }
  if (isSitecoreGuidRef(variants)) {
    sitecoreGuidFromRef(variants); // validate format
    return emptyWriteStats();
  }

  if (isDefinitionKeyRef(variants)) {
    const key = definitionKeyFromRef(variants);
    const fromRegistry = options.registry?.get(key);
    const variantsDef =
      fromRegistry?.kind === "variants"
        ? (fromRegistry as VariantsDefinition)
        : requireVariantsDefinition(
            key,
            `rendering/component "${definition.definitionKey}"`,
          );
    return await applyVariantsDefinition(variantsDef, {
      handle,
      icon: definition.icon,
      ...siteOpts,
    });
  }

  if (isInlineVariantsList(variants)) {
    if (!shouldApplyHeadlessVariants(variants)) {
      return emptyWriteStats();
    }
    return await applyVariantsDefinition(
      variantsDefinitionFromInline({
        definitionKey: `${definition.definitionKey}__variants`,
        componentName,
        variants,
        icon: definition.icon,
      }),
      { handle, ...siteOpts },
    );
  }

  throw new Error(
    `rendering/component "${definition.definitionKey}": variants must be [{ name }] | { definitionKey } | { path } | { guid }`,
  );
}
