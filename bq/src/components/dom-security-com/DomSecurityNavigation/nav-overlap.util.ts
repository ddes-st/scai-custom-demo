import type { ComponentRendering, Page } from "@sitecore-content-sdk/nextjs";

/** First main-band components that expect transparent overlapping chrome. */
const OVERLAP_FIRST_COMPONENTS = new Set([
  "dom-security-technology-hero",
  "DomSecurityTechnologyHero",
]);

function asRendering(value: unknown): ComponentRendering | null {
  if (!value || typeof value !== "object") return null;
  const rendering = value as ComponentRendering;
  return typeof rendering.componentName === "string" ? rendering : null;
}

/** Direct children of `headless-main` (and common aliases), in layout order. */
function mainPlaceholderRenderings(page: Page | undefined): ComponentRendering[] {
  const placeholders =
    page?.layout?.sitecore?.route?.placeholders ??
    (page as { sitecore?: { route?: { placeholders?: Record<string, unknown> } } })
      ?.sitecore?.route?.placeholders;
  if (!placeholders || typeof placeholders !== "object") return [];

  const keys = Object.keys(placeholders);
  const mainKey =
    keys.find((key) => key === "headless-main") ||
    keys.find((key) => /^headless-main/i.test(key)) ||
    keys.find((key) => key === "jss-main" || key === "main");
  if (!mainKey) return [];

  const raw = (placeholders as Record<string, unknown>)[mainKey];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(asRendering).filter((item): item is ComponentRendering => Boolean(item));
}

/**
 * Overlap chrome only when the first in-flow main rendering is a Technology Hero.
 * Dealer locator / other pages keep a solid in-document bar.
 */
export function shouldOverlapMainHero(page: Page | undefined): boolean {
  const first = mainPlaceholderRenderings(page)[0];
  if (!first?.componentName) return false;
  return OVERLAP_FIRST_COMPONENTS.has(first.componentName);
}
