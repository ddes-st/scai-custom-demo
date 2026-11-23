"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ComponentProps } from "react";
import {
  resolveFaIcon,
  type FaIconStyle,
} from "./resolve-fa-icon";

export type FaIconProps = {
  /** Font Awesome Free icon id, e.g. `arrow-right`. `none` renders nothing. */
  name?: string;
  /** Font Awesome Free style pack. */
  faStyle?: FaIconStyle;
  className?: string;
} & Omit<ComponentProps<typeof FontAwesomeIcon>, "icon">;

/**
 * Authorable Font Awesome Free icon for atoms/molecules.
 * Primitives keep Lucide for their own chrome.
 */
export function FaIcon({
  name,
  faStyle = "solid",
  className,
  ...props
}: FaIconProps) {
  const icon = resolveFaIcon(name, faStyle);
  if (!icon) return null;
  return (
    <FontAwesomeIcon
      icon={icon}
      className={className}
      aria-hidden
      {...props}
    />
  );
}
