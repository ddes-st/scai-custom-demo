import { getCookie, setCookie } from "components/lib/registry/cookies";

export type Direction = "ltr" | "rtl";

export const DIRECTION_STORAGE_KEY = "preferred-direction";
export const DIRECTION_COOKIE_KEY = "direction";

// List of RTL language codes
const RTL_LANGUAGES = [
  "ar", // Arabic
  "he", // Hebrew
  "fa", // Persian/Farsi
  "ur", // Urdu
  "yi", // Yiddish
  "ji", // Yiddish (alternative)
  "ku", // Kurdish
  "ps", // Pashto
  "sd", // Sindhi
] as const;

// Determines if a language code is RTL
export function isRTL(language: string): boolean {
  // Normalize language code ("en-US" -> "en")
  const langCode = language.toLowerCase().split("-")[0];
  return RTL_LANGUAGES.includes(langCode as (typeof RTL_LANGUAGES)[number]);
}

// Gets the direction based on language code
export function getDirectionFromLanguage(language: string): Direction {
  return isRTL(language) ? "rtl" : "ltr";
}

// Gets the browser's preferred language
export function getBrowserLanguage(): string {
  if (typeof window === "undefined") return "en";

  // Try to get from navigator.languages
  const languages = navigator.languages || [navigator.language];
  return languages[0] || "en";
}

// Gets the document language (if set), otherwise empty string
export function getDocumentLanguage(): string {
  if (typeof document === "undefined") return "";
  return document.documentElement.getAttribute("lang") || "";
}

// Reads the stored direction override from localStorage or cookie
export function getStoredDirection(): Direction | null {
  if (typeof document === "undefined") return null;

  try {
    const stored = localStorage.getItem(DIRECTION_STORAGE_KEY);
    if (stored === "ltr" || stored === "rtl") return stored;
  } catch (error) {
    console.warn("direction: localStorage read failed", error);
  }

  const cookieValue = getCookie(DIRECTION_COOKIE_KEY);
  if (cookieValue === "ltr" || cookieValue === "rtl") return cookieValue;

  return null;
}

// Persists a direction override for user toggles
export function setStoredDirection(direction: Direction) {
  if (typeof document === "undefined") return;

  try {
    localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
  } catch (error) {
    console.warn("direction: localStorage write failed", error);
  }

  setCookie(DIRECTION_COOKIE_KEY, direction, {
    path: "/",
    maxAge: 31536000,
    sameSite: "Lax",
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("direction-change", { detail: direction }),
    );
  }
}

/** Resolves the initial direction (stored override > document dir > language). Used for SSR (layout) and useDirectionState initial state. In components, prefer useDirection(). */
export function getInitialDirection(): Direction {
  if (typeof document === "undefined") return "ltr";
  const stored = getStoredDirection();
  if (stored) return stored;
  const documentDir = document.documentElement.getAttribute("dir");
  if (documentDir === "ltr" || documentDir === "rtl") return documentDir;
  const documentLang = getDocumentLanguage();
  const browserLang = getBrowserLanguage();
  return getDirectionFromLanguage(documentLang || browserLang || "en");
}
