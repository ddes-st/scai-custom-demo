import { proposeValidItemName } from "../../shared/naming";

export function toItemSystemName(name: string): string {
  const cleaned = proposeValidItemName(name, "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!cleaned) {
    throw new Error(`Cannot derive system name from "${name}"`);
  }
  return cleaned;
}
