import type { ComponentProps } from "react";
import { LibraryIcon } from "components/registry/primitives/core/library-icon";

type LibraryIconProps = ComponentProps<typeof LibraryIcon>;

const iconAliases: Record<string, LibraryIconProps["name"]> = {
  "open-in-new": "link",
  "external-link": "link",
  github: "github",
  "code-braces": "file",
  code: "file",
  cube: "package",
  "cube-outline": "package",
  "dots-horizontal": "ellipsis",
  "drag-vertical": "chevrons-up-down",
  mobile: "smartphone",
  tablet: "tablet",
  laptop: "laptop",
  desktop: "monitor",
  "circle-half": "sun",
};

type ThemeIconProps = Omit<LibraryIconProps, "name"> & {
  name: string;
};

export function ThemeIcon({ name, ...props }: ThemeIconProps) {
  const resolvedName = iconAliases[name] ?? name;
  return <LibraryIcon name={resolvedName} {...props} />;
}
