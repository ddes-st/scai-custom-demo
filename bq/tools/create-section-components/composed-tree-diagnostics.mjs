/**
 * Composed parent+children structural contracts (footer multi-slot, media-tabs, carousel).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../capture/paths.mjs';
import { inferPlaceholderLayoutMode } from './layout-hints.mjs';
import {
  inferPlanChildPlaceholderKey,
  resolvePlanPlaceholderContract,
} from './placeholder-contract.mjs';
import { extractPlaceholderBasesFromTsx } from './sync-definition-from-tsx.mjs';
import { toDefinitionKey } from './naming.mjs';
import { stripMediaTabsBuriedChildTabChrome } from './ai-source-fixup.mjs';
import {
  hasDuplicateChildrenMount,
  mediaTabsAttrRe,
} from './media-tabs-attrs.mjs';
import { layoutWantsEqualHeightChildren } from './motion-hints.mjs';

/**
 * @param {object|null|undefined} child
 * @param {{ layoutMode?: string|null, writeBack?: boolean }} [opts]
 * @returns {string}
 */
function loadChildTsx(child, opts = {}) {
  const layoutMode = String(opts.layoutMode || '').toLowerCase();
  const writeBack = opts.writeBack !== false;
  const inline = String(child?.tsx || child?.sources?.tsxContent || '').trim();
  let raw = '';
  let abs = '';
  if (inline && (inline.includes('export') || inline.includes('<'))) {
    raw = inline;
  } else {
    const rel = String(child?.sources?.tsx || '').trim();
    if (!rel || !/\.tsx?$/i.test(rel)) return inline;
    try {
      abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
      raw = readFileSync(abs, 'utf8');
    } catch {
      return '';
    }
  }
  if (layoutMode !== 'media-tabs') return raw;
  const fixed = stripMediaTabsBuriedChildTabChrome(raw);
  if (fixed === raw) return raw;
  if (writeBack && abs) {
    try {
      writeFileSync(abs, fixed, 'utf8');
    } catch {
      /* diagnostics still use fixed in-memory */
    }
  }
  if (child && typeof child === 'object') {
    child.tsx = fixed;
  }
  return fixed;
}

/**
 * Outermost JSX element className after the Default export's return (ignore nested nodes).
 * @param {string} tsx
 * @returns {string}
 */
export function extractDefaultExportRootClassName(tsx) {
  const src = String(tsx || '');
  if (!src.trim()) return '';

  // Prefer the Default export body; fall back to whole file.
  let scope = src;
  const defaultMatch = src.match(
    /export\s+const\s+Default\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?\s*=>/,
  );
  if (defaultMatch && defaultMatch.index != null) {
    scope = src.slice(defaultMatch.index);
  }

  const returnIdx = scope.search(/\breturn\s*\(/);
  const searchFrom = returnIdx >= 0 ? scope.slice(returnIdx) : scope;

  const tagRe =
    /<(article|section|div|aside|li|ul|ol|nav|header|footer|main|figure|a)\b([^>]*)>/i;
  const tagMatch = searchFrom.match(tagRe);
  if (!tagMatch) return '';

  const attrs = tagMatch[2] || '';
  const classMatch =
    attrs.match(/\bclassName\s*=\s*"([^"]*)"/) ||
    attrs.match(/\bclassName\s*=\s*'([^']*)'/) ||
    attrs.match(/\bclassName\s*=\s*\{`([^`]*)`\}/);
  return classMatch ? String(classMatch[1] || '') : '';
}

/**
 * Parent (or chrome client) owns horizontal slide sizing for AppPlaceholder children.
 * @param {string} parentTsx
 * @param {string} [parentClientTsx]
 * @returns {boolean}
 */
export function parentOwnsCarouselSlideSizing(parentTsx, parentClientTsx = '') {
  const blob = `${String(parentTsx || '')}\n${String(parentClientTsx || '')}`;
  if (!blob.trim()) return false;
  if (/\[&>\*\]:shrink-0/.test(blob)) return true;
  if (/\[&>\*\]:w-\[/.test(blob)) return true;
  if (/\[&>\*\]:basis-(?!full\b)/.test(blob)) return true;
  if (/\bauto-cols-/.test(blob)) return true;
  return false;
}

/**
 * Root looks like a full-bleed stacker rather than a sized slide.
 * @param {string} rootClass
 * @returns {boolean}
 */
export function rootIsFullBleedSlideWithoutSizing(rootClass) {
  const cls = String(rootClass || '');
  if (!cls.trim()) return false;

  const hasFullBleed = /\bw-full\b/.test(cls) || /\bbasis-full\b/.test(cls);
  if (!hasFullBleed) return false;

  const hasSlideSizing =
    /\bshrink-0\b/.test(cls) ||
    /\bw-\[min\(/.test(cls) ||
    /\bw-\[\d/.test(cls) ||
    /\bbasis-(?!full\b)/.test(cls);
  return !hasSlideSizing;
}

/**
 * @param {{
 *   plan?: object|null,
 *   parentTsx?: string|null,
 *   parentClientTsx?: string|null,
 *   parentDefinitionKey?: string|null,
 *   parentDefinitionTs?: string|null,
 *   childPackages?: { componentName?: string, definitionKey?: string, sources?: { tsx?: string }, role?: string }[],
 *   sectionInfo?: object|null,
 *   sectionHtml?: string|null,
 * }} opts
 * @returns {string[]}
 */
export function collectComposedTreeDiagnostics(opts = {}) {
  const parentTsx = String(opts.parentTsx || '');
  const parentClientTsx = String(opts.parentClientTsx || '');
  const children = Array.isArray(opts.childPackages)
    ? opts.childPackages.filter((c) => c && c.role !== 'section')
    : [];
  const hasAppPh =
    /<AppPlaceholder\b/.test(parentTsx) || /<AppPlaceholder\b/.test(parentClientTsx);
  // Derive composite from emit (child packages / AppPlaceholder) — never plan.
  if (!children.length && !hasAppPh) return [];

  /** @type {string[]} */
  const out = [];
  const parentKey = String(opts.parentDefinitionKey || '').trim();
  // Build slot contract from child packages only (packages are the structure source).
  const contract = resolvePlanPlaceholderContract(
    { children: children.map((c) => ({ ...c })) },
    parentKey,
  );
  const extracted = extractPlaceholderBasesFromTsx(
    [parentTsx, parentClientTsx].filter(Boolean).join('\n'),
  );
  const layoutMode = inferPlaceholderLayoutMode(opts.sectionInfo, opts.sectionHtml);

  if (contract.multiSlot && contract.placeholderKeys.length) {
    const missing = contract.placeholderKeys.filter((k) => !extracted.includes(k));
    if (missing.length) {
      out.push(
        `CONTRACT: composed multi-slot parent must mount AppPlaceholder bases [${contract.placeholderKeys.join(', ')}] — missing [${missing.join(', ')}]`,
      );
    }
  }

  // Each child package should map to a parent slot when multi-slot
  if (contract.multiSlot) {
    for (const c of children) {
      const ph = inferPlanChildPlaceholderKey(c);
      const defKey =
        String(c?.definitionKey || '').trim() ||
        toDefinitionKey(c?.componentName || '');
      if (ph && !contract.placeholderKeys.includes(ph)) {
        out.push(
          `CONTRACT: child package "${defKey || c?.componentName}" maps to "${ph}" which is not in parent slots [${contract.placeholderKeys.join(', ')}]`,
        );
      }
    }
  }

  if (layoutMode === 'media-tabs') {
    if (parentClientTsx && hasDuplicateChildrenMount(parentClientTsx)) {
      out.push(
        'CONTRACT: media-tabs parent client chrome must mount {children} exactly once — duplicate mounts empty the rail',
      );
    }
    for (const child of children) {
      // Fix buried tab chrome on disk / in-memory before diagnosing (parent retries cannot rewrite children).
      const tsx = loadChildTsx(child, { layoutMode: 'media-tabs', writeBack: true });
      if (!tsx.trim()) continue;
      // Full self-contained item with hidden desktop tab chrome inside the child
      const hasHiddenDesktopTab =
        /hidden\s+(?:lg:|md:)?(?:flex|block)/.test(tsx) &&
        mediaTabsAttrRe('tab').test(tsx);
      const hasFullArticleChrome =
        /<article\b/.test(tsx) &&
        mediaTabsAttrRe('panel').test(tsx) &&
        /(logo|Image)/.test(tsx);
      if (hasHiddenDesktopTab && hasFullArticleChrome) {
        out.push(
          `CONTRACT: media-tabs child "${child.componentName || child.definitionKey}" must not bury desktop tab chrome inside each article (hidden lg:flex tabs) — parent owns tab chrome; child exposes panel parts only`,
        );
      }
    }
    if (
      parentTsx &&
      !/MediaTabs|data-media-tab-tab|data-story-tab|tablist/i.test(parentTsx) &&
      children.length > 1
    ) {
      // Soft: parent should own tab chrome when multiple media-tab children
      if (!/AppPlaceholder/.test(parentTsx)) {
        out.push(
          'CONTRACT: media-tabs parent must wrap children via AppPlaceholder with tab chrome on the parent',
        );
      }
    }
  }

  // Peer cards / card-carousel only — not every layoutMode=carousel (logo marquee rails
  // use ContinuousMarquee + items-center, not stretch fill). Use layoutWants… so
  // header/nav false-positive equalHeightChildren flags are ignored.
  if (layoutWantsEqualHeightChildren(opts.sectionInfo)) {
    const parentBlob = `${parentTsx || ''}\n${parentClientTsx || ''}`;
    if (/\bAppPlaceholder\b/.test(parentBlob)) {
      const hasStretch = /\bitems-stretch\b/.test(parentBlob);
      const hasFill =
        /\[&>\*\]:h-full|\bself-stretch\b|grid[\s\S]{0,120}items-stretch/.test(
          parentBlob,
        );
      if (!hasStretch || !hasFill) {
        out.push(
          'CONTRACT: equal-height / carousel peer cards need parent items-stretch AND [&>*]:h-full (or stretch grid) around the placeholder track — both required',
        );
      }
    }
  }

  if (layoutMode === 'carousel') {
    const parentOwnsTrack = parentOwnsCarouselSlideSizing(parentTsx, parentClientTsx);
    if (!parentOwnsTrack) {
      for (const child of children) {
        const tsx = loadChildTsx(child, { layoutMode });
        if (!tsx.trim()) continue;
        const rootClass = extractDefaultExportRootClassName(tsx);
        if (rootIsFullBleedSlideWithoutSizing(rootClass)) {
          out.push(
            `CONTRACT: carousel child "${child.componentName || child.definitionKey}" root should be a slide (shrink-0 / fixed card width), not w-full stacking`,
          );
        }
      }
    }
  }

  return out.map((m) => (m.startsWith('CONTRACT:') ? m : `CONTRACT: ${m}`));
}
