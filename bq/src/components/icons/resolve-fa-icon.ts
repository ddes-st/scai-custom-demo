import {
  findIconDefinition,
  type IconDefinition,
  type IconName,
  type IconPrefix,
} from "@fortawesome/fontawesome-svg-core";
import { ensureFontAwesomeFree } from "./ensure-fontawesome";

export type FaIconStyle = "solid" | "regular" | "brands";

const STYLE_TO_PREFIX: Record<FaIconStyle, IconPrefix> = {
  solid: "fas",
  regular: "far",
  brands: "fab",
};

/**
 * Resolve a Font Awesome Free icon by kebab-case name (e.g. `arrow-right`).
 * `none` / empty / unknown → undefined (safe for Sitecore + Storybook).
 */
export function resolveFaIcon(
  iconName: string | undefined,
  style: FaIconStyle = "solid",
): IconDefinition | undefined {
  const name = iconName?.trim().toLowerCase();
  if (!name || name === "none") return undefined;

  ensureFontAwesomeFree();

  const prefix = STYLE_TO_PREFIX[style];
  const def = findIconDefinition({
    prefix,
    iconName: name as IconName,
  });

  return def ?? undefined;
}
