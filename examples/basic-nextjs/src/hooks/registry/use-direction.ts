"use client";

import { useDirection as useRadixDirection } from "@radix-ui/react-direction";
import { useCallback, useEffect, useState } from "react";
import {
  DIRECTION_STORAGE_KEY,
  type Direction,
  getBrowserLanguage,
  getDirectionFromLanguage,
  getDocumentLanguage,
  getInitialDirection,
  getStoredDirection,
} from "components/lib/registry/direction";

/**
 * Hook that resolves and syncs direction with the document and listens for
 * direction-change, storage, and visibility changes.
 */
export function useDirectionState(serverDirection?: Direction): Direction {
  const [dir, setDir] = useState<Direction>(
    () => serverDirection ?? getInitialDirection(),
  );

  const resolveDirection = useCallback(() => {
    const stored = getStoredDirection();
    const documentLang = getDocumentLanguage();
    const browserLang = getBrowserLanguage();
    const language = documentLang || browserLang;
    const direction = stored ?? getDirectionFromLanguage(language || "en");

    setDir(direction);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", direction);
      if (language) {
        document.documentElement.setAttribute("lang", language);
      }
    }
  }, []);

  useEffect(() => {
    resolveDirection();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resolveDirection();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DIRECTION_STORAGE_KEY) {
        resolveDirection();
      }
    };

    const handleDirectionChange = (event: Event) => {
      const customEvent = event as CustomEvent<Direction | null>;
      if (customEvent.detail === "ltr" || customEvent.detail === "rtl") {
        setDir(customEvent.detail);
        document.documentElement.setAttribute("dir", customEvent.detail);
      } else {
        resolveDirection();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("direction-change", handleDirectionChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("direction-change", handleDirectionChange);
    };
  }, [resolveDirection]);

  return dir;
}

/**
 * Returns the current text direction from Radix Direction context.
 */
export const useDirection = useRadixDirection;
