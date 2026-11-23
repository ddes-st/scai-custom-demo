/**
 * Standalone content seed contracts (`*.content.ts`).
 * Colocated seed content may instead live on `ComponentTemplateDefinition.content`.
 */

import type {
  ComponentContentItemDef,
  ComponentContentSeed,
  ComponentContentVersionDef,
} from "../definitions/types";

export type {
  ComponentContentItemDef,
  ComponentContentSeed,
  ComponentContentVersionDef,
} from "../definitions/types";

/** @deprecated Alias — prefer `ComponentContentItemDef`. */
export type ContentItemDef = ComponentContentItemDef;

export type ComponentContentDefinition = ComponentContentSeed & {
  kind: "component-content";
  /** Matches the component definition key (e.g. `cta-button`). */
  definitionKey: string;
};
