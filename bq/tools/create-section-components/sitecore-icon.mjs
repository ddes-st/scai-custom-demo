/**
 * Resolve and persist Sitecore __Icon paths for section components.
 * Uses the sitecore-icons selectBestIcon catalog ranker.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectBestIcon } from "../../.cursor/skills/sitecore-icons/scripts/select-icon.mjs";
import { repoRoot } from "../capture/paths.mjs";
import { ensureNewline } from "./source-text.mjs";

const DEFAULT_ICON = "Office/32x32/window_dialog.png";
const GENERIC_ICONS = new Set([
  DEFAULT_ICON,
  "Office/32x32/window_star.png",
  "Office/32x32/document.png",
]);

/**
 * Build a ranking query from section-information (and optional plan/component).
 * @param {object} info
 * @param {{ componentName?: string, role?: string }} [opts]
 */
export function buildIconQuery(info, opts = {}) {
  // Prefer name + short purpose only. Full description often has layout words
  // (left/right/column) that poison catalog ranking.
  const parts = [opts.componentName, info?.cmsName, info?.purpose]
    .map((p) => String(p || "").trim())
    .filter(Boolean);

  // CamelCase → spaced tokens for better catalog matching
  const expanded = parts.flatMap((p) => [
    p,
    p.replace(/([a-z])([A-Z])/g, "$1 $2"),
  ]);

  return [...new Set(expanded)].join(" ").trim();
}

/**
 * Resolve best Sitecore icon path for a section.
 * Prefers an existing non-generic sitecoreIcon on section-information.
 *
 * @param {object} info
 * @param {{ componentName?: string, preferredSet?: string, force?: boolean }} [opts]
 * @returns {{ path: string, source: 'section-information'|'select-icon'|'default', detail?: object }}
 */
export function resolveSitecoreIcon(info, opts = {}) {
  const existing = String(info?.sitecoreIcon || "").trim();
  if (existing && !opts.force && !GENERIC_ICONS.has(existing)) {
    return { path: existing, source: "section-information" };
  }

  const query = buildIconQuery(info, opts);
  if (!query) {
    return { path: existing || DEFAULT_ICON, source: "default" };
  }

  // Prefer Office set for renderings/templates; fall back to full catalog.
  const preferredSet = opts.preferredSet || "Office";
  let result = selectBestIcon(query, { preferredSet, setOnly: true });
  if (result?.fallback || !result?.path) {
    result = selectBestIcon(query, { preferredSet });
  }
  const chosen = String(result?.path || "").trim() || DEFAULT_ICON;
  return {
    path: chosen,
    source: result?.fallback ? "default" : "select-icon",
    detail: result,
  };
}

/**
 * Ensure info.sitecoreIcon is set; optionally write back to section-information.json.
 *
 * @param {object} info
 * @param {{ sectionAbs?: string, componentName?: string, persist?: boolean, force?: boolean }} [opts]
 */
export async function ensureSectionSitecoreIcon(info, opts = {}) {
  const resolved = resolveSitecoreIcon(info, opts);
  const changed = info.sitecoreIcon !== resolved.path;
  info.sitecoreIcon = resolved.path;

  if (opts.persist !== false && opts.sectionAbs && changed) {
    const infoPath = path.join(opts.sectionAbs, "section-information.json");
    await writeFile(infoPath, `${JSON.stringify(info, null, 2)}\n`, "utf8");
  }

  return resolved;
}

/**
 * Replace or insert `icon: "..."` on a definition.ts source string.
 * @param {string} source
 * @param {string} iconPath
 */
export function applyDefinitionIcon(source, iconPath) {
  const icon = String(iconPath || "").trim() || DEFAULT_ICON;
  const text = String(source || "");
  if (/^\s*icon\s*:/m.test(text)) {
    return text.replace(
      /^(\s*icon\s*:\s*)(["'`])[^"'`]*\2/m,
      `$1"${icon}"`,
    );
  }
  // Insert after componentName or displayName
  const insertAfter =
    /(^\s*(?:componentName|displayName)\s*:\s*["'`][^"'`]*["'`]\s*,?\s*\n)/m;
  if (insertAfter.test(text)) {
    return text.replace(insertAfter, `$1  icon: "${icon}",\n`);
  }
  return text;
}

/**
 * Patch icon on existing definition.ts files (e.g. conversion skip path).
 * @param {{ sources?: { definition?: string }, definitionKey?: string }[]} components
 * @param {string} iconPath
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function syncDefinitionIcons(components, iconPath, opts = {}) {
  const icon = String(iconPath || "").trim();
  if (!icon || !Array.isArray(components)) return { patched: 0 };

  let patched = 0;
  for (const c of components) {
    const rel = c?.sources?.definition;
    if (!rel) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
    try {
      const before = await readFile(abs, "utf8");
      const after = applyDefinitionIcon(before, icon);
      if (after !== before) {
        if (!opts.dryRun) {
          const { writeFileIfChanged } = await import(
            "../shared/write-file-if-changed.mjs"
          );
          const result = await writeFileIfChanged(abs, ensureNewline(after));
          if (result.wrote) patched += 1;
        } else {
          patched += 1;
        }
      }
    } catch {
      // definition may not exist yet
    }
  }
  return { patched };
}

export { DEFAULT_ICON };
