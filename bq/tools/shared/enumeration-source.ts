import {
  definitionKeyFromRef,
  isDefinitionKeyRef,
  isSitecoreGuidRef,
  isSitecorePathRef,
  sitecoreGuidFromRef,
  sitecorePathFromRef,
  type SitecoreItemRef,
} from "./definition-ref";
import { braceGuid } from "./ids";
import { toSaiHandle } from "./sai-handle";

/**
 * Template field Source value for an enumeration ref.
 * - definitionKey → `enum:{key}@1` (Sitecore enum source convention)
 * - path → Sitecore tree path string (as Source)
 * - guid → braced GUID (as Source)
 */
export function enumerationSourceValue(
  enumeration: SitecoreItemRef,
  version = 1,
): string {
  if (isDefinitionKeyRef(enumeration)) {
    return `enum:${toSaiHandle(definitionKeyFromRef(enumeration), version)}`;
  }
  if (isSitecorePathRef(enumeration)) {
    return sitecorePathFromRef(enumeration);
  }
  if (isSitecoreGuidRef(enumeration)) {
    return braceGuid(sitecoreGuidFromRef(enumeration));
  }
  throw new Error(
    "enumeration must be { definitionKey } | { path } | { guid }",
  );
}
