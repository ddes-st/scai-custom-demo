/**
 * Write site-presentation *.definition.ts (Available Renderings, partials, page layouts).
 * YAML is produced only by authoring:generate emitters.
 *
 * Secondary captures (e.g. /newsroom) merge into the existing presentation:
 * they must not wipe prior availableRenderings / partials.
 * Page layouts are written under pages/*.definition.ts (not presentation.pages).
 */
import { access, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { writeFileIfChanged } from '../shared/write-file-if-changed.mjs';
import {
  hostComponentsDir,
  legacyPresentationDefinitionPath,
  presentationDefinitionPath,
  resolvePresentationDefinitionPath,
} from './definition-paths.mjs';
import { hostToHostSlugFolder, toPascalCase } from './naming.mjs';
import { inferPlanChildPlaceholderKey } from './placeholder-contract.mjs';
import {
  datasourceNamesMatchLoose,
  extractContentItemNames,
  isHashedOrphanDatasourceLabel,
  soleSeedDatasourceName,
  writePageDefinition,
} from './page-defs.mjs';
import { resolveChildContentItemNames } from './content-item-names-hydrate.mjs';

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when a presentation role marks Partial Design chrome (not page body).
 * @param {string|null|undefined} role
 */
export function isPartialChromeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  // Cookie partial retired — partial-cookie is treated as page body.
  if (r === 'partial-cookie') return false;
  return r.startsWith('partial-');
}

/**
 * Capture-page-relative path to a section's desktop PNG for Partial Design thumbnails.
 * Prefers `section-information.json` outputs.desktop.path; else
 * `sections/{folder}/{folder}-desktop.png`. Does not scan other sections.
 *
 * @param {object|null|undefined} sectionInfo
 * @param {string|null|undefined} [sectionFolder]
 * @returns {string|undefined}
 */
export function resolveSectionDesktopThumbnailRel(sectionInfo, sectionFolder) {
  const fromOutputs = String(sectionInfo?.outputs?.desktop?.path || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
  if (fromOutputs) return fromOutputs;
  const folder = String(
    sectionFolder || sectionInfo?.folderName || '',
  ).trim();
  if (!folder) return undefined;
  return `sections/${folder}/${folder}-desktop.png`;
}

/**
 * Stamp shape for Partial Design / site thumbnails (`path` | `url` | `base64`).
 * @param {string|null|undefined} captureRel
 * @returns {{ path: string }|undefined}
 */
export function thumbnailFromCaptureRel(captureRel) {
  const rel = String(captureRel || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
  return rel ? { path: rel } : undefined;
}

/**
 * Normalize a partial entry's thumbnail for disk: prefer `thumbnail`, migrate
 * deprecated `thumbnailCaptureRel` → `{ path }`, drop the deprecated key.
 * @param {object|null|undefined} partial
 * @returns {object|null|undefined}
 */
export function normalizePartialThumbnailForDisk(partial) {
  if (!partial || typeof partial !== 'object') return partial;
  const {
    thumbnailCaptureRel,
    thumbnail: rawThumb,
    ...rest
  } = partial;
  const pathFromThumb = String(rawThumb?.path || '').trim();
  const url = String(rawThumb?.url || '').trim();
  const base64 = String(rawThumb?.base64 || '').trim();
  let thumbnail;
  if (pathFromThumb || url || base64) {
    thumbnail = {
      ...(pathFromThumb ? { path: pathFromThumb } : {}),
      ...(url ? { url } : {}),
      ...(base64 ? { base64 } : {}),
      ...(rawThumb?.alt != null ? { alt: rawThumb.alt } : {}),
      ...(rawThumb?.name != null ? { name: rawThumb.name } : {}),
    };
  } else {
    thumbnail = thumbnailFromCaptureRel(thumbnailCaptureRel);
  }
  return thumbnail ? { ...rest, thumbnail } : rest;
}

/**
 * Site chrome parents belong on Partial Designs only — never headless-main.
 * Last-resort when a rendering has no `role` metadata (legacy presentation files).
 * Prefer `role` on page renderings — do not use this as the primary signal.
 * @param {string} definitionKey
 */
export function isSiteChromeDefinitionKey(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  if (!k) return false;
  // Cookie/CMP overlays are page body now (no cookie partial).
  // Announcement / notification bars (sticky site chrome)
  if (/announcement-bar|announcement-marquee|notification-bar/.test(k)) return true;
  if (/site-header/.test(k)) return true;
  // Full site navigation shells (not footer nav groups / mega column children)
  if (
    /site-navigation|main-nav|main-navigation|global-navigation|header-navigation|country-navigation/.test(
      k,
    ) &&
    !/footer-navigation|nav-mega|navigation-group|nav-link|navigation-item/.test(k)
  ) {
    return true;
  }
  if (
    /(^|-)header($|-)/.test(k) &&
    !/header-block|article-header|editorial-hero|technology-hero|centered-hero|video-hero/.test(k)
  ) {
    return true;
  }
  // Composite footer shells (chrome parents)
  if (/footer-navigation-and-signposts/.test(k)) return true;
  // Parent footers only — not footer-* children (legal, navigation-group, signpost, …)
  if (
    /footer-legal|footer-navigation|footer-signpost|footer-social|footer-branding|footer-link|global-footer-legal|global-footer-navigation|global-footer-signpost|global-footer-branding/.test(
      k,
    )
  ) {
    return false;
  }
  if (/site-footer|(^|-)global-footer($|-)/.test(k) || k.endsWith('-footer') || k === 'footer') {
    return true;
  }
  return false;
}

/**
 * True when a chrome key looks like a thin announcement / notification band.
 * Optional low chromeScore hint only — keep/drop uses document order + mergeHeaderPartialEntries.
 * @param {string} definitionKey
 */
export function isHeaderSiblingChromeKey(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  return /announcement|notification-bar/.test(k);
}

/**
 * True when a chrome key is a primary site header / main nav shell
 * (competing implementations should not both land in the header partial).
 * Brand-prefix agnostic (axa-main-nav, sitecore-site-header, …).
 * @param {string} definitionKey
 */
export function isPrimaryHeaderNavChromeKey(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  if (!k) return false;
  if (isHeaderSiblingChromeKey(k)) return false;
  // Leaf link lists are never primary header shells (e.g. context-link-list
  // matching /global-navigation/ must not be promoted into headless-header).
  if (/(^|-)link-list($|-)/.test(k) || /context-link-list/.test(k)) {
    return false;
  }
  if (
    /site-navigation|main-nav|main-navigation|global-navigation|header-navigation|country-navigation|site-header/.test(
      k,
    ) &&
    !/footer-navigation|nav-mega|navigation-group|nav-link|navigation-item/.test(k)
  ) {
    return true;
  }
  if (
    /(^|-)header($|-)/.test(k) &&
    !/header-block|article-header|editorial-hero|technology-hero|centered-hero|video-hero/.test(
      k,
    )
  ) {
    return true;
  }
  if (
    /(^|-)navigation($|-)/.test(k) &&
    !/footer-navigation|nav-mega|navigation-group|nav-link|navigation-item/.test(k)
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve the chrome partial root from layoutSketch (authority) + section packages.
 * Does not invent a winner from name heuristics — falls back to the section
 * package definitionKey when the sketch root cannot be mapped.
 *
 * @param {{
 *   layoutSketch?: object|null,
 *   componentResults?: Array<{ componentName?: string, definitionKey?: string, role?: string }>,
 *   fallbackDefinitionKey?: string,
 * }} [opts]
 * @returns {{ definitionKey: string, datasourceItem: string, fromSketch: boolean }|null}
 */
export function resolveChromePartialRootFromSketch(opts = {}) {
  const results = Array.isArray(opts.componentResults) ? opts.componentResults : [];
  const sectionKey = String(
    results.find((c) => String(c?.role || '') === 'section')?.definitionKey ||
      opts.fallbackDefinitionKey ||
      results[0]?.definitionKey ||
      '',
  ).trim();

  /** @type {Map<string, string>} */
  const nameToKey = new Map();
  for (const c of results) {
    const name = String(c?.componentName || '').trim();
    const key = String(c?.definitionKey || '').trim();
    if (name && key) nameToKey.set(name.toLowerCase(), key);
  }

  const roots = Array.isArray(opts.layoutSketch?.renderings)
    ? opts.layoutSketch.renderings
    : opts.layoutSketch?.componentName
      ? [opts.layoutSketch]
      : [];
  const root = roots[0];
  if (!root || typeof root !== 'object') {
    return sectionKey
      ? { definitionKey: sectionKey, datasourceItem: '', fromSketch: false }
      : null;
  }

  const componentName = String(root.componentName || '').trim();
  const datasourceItem = String(
    root.datasourceName || root.datasourceItem || '',
  ).trim();

  let definitionKey = componentName
    ? nameToKey.get(componentName.toLowerCase()) || ''
    : '';
  if (!definitionKey && componentName) {
    const lower = componentName.toLowerCase();
    for (const c of results) {
      const n = String(c?.componentName || '').trim();
      const key = String(c?.definitionKey || '').trim();
      if (!n || !key) continue;
      const nl = n.toLowerCase();
      // Sketch often suffixes the package name (MenzisGlobalHeaderNavigation vs MenzisGlobalHeader).
      if (lower === nl || lower.startsWith(nl) || nl.startsWith(lower)) {
        definitionKey = key;
        break;
      }
    }
  }
  if (!definitionKey) definitionKey = sectionKey;
  if (!definitionKey) return null;
  return {
    definitionKey,
    datasourceItem,
    fromSketch: Boolean(componentName),
  };
}

/**
 * @param {unknown} value
 * @returns {number|undefined}
 */
export function parseSectionIndex(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Sibling / demotion ref for a header partial entry (preserves sectionIndex + children).
 * @param {{
 *   definitionKey?: string,
 *   renderingIdentifier?: string,
 *   datasourceItem?: string,
 *   sectionIndex?: number,
 *   children?: object[],
 * }} entry
 */
export function headerSiblingRef(entry) {
  const sectionIndex = parseSectionIndex(entry?.sectionIndex);
  const children = Array.isArray(entry?.children)
    ? entry.children.filter((c) => c?.definitionKey)
    : [];
  return {
    definitionKey: entry.definitionKey,
    ...(entry.renderingIdentifier
      ? { renderingIdentifier: entry.renderingIdentifier }
      : {}),
    ...(entry.datasourceItem ? { datasourceItem: entry.datasourceItem } : {}),
    ...(sectionIndex !== undefined ? { sectionIndex } : {}),
    ...(children.length ? { children } : {}),
  };
}

/**
 * Merge siblingsBefore lists by definitionKey.
 * On duplicate keys: shallow-merge fields and union nested children via
 * {@link mergePartialChildren} (empty→full and both-nonempty).
 * Never persist empty `children: []` (omit — matches {@link headerSiblingRef}).
 * @param {object[]} [prevList]
 * @param {object[]} [nextList]
 * @returns {object[]}
 */
export function mergeSiblingsBeforeList(prevList, nextList) {
  const out = [];
  const seen = new Set();
  for (const s of [...(prevList || []), ...(nextList || [])]) {
    const key = String(s?.definitionKey || '');
    if (!key) continue;
    if (seen.has(key)) {
      const idx = out.findIndex((x) => String(x?.definitionKey || '') === key);
      if (idx < 0) continue;
      const prev = out[idx];
      const mergedKids = mergePartialChildren(prev.children, s.children);
      const merged = { ...prev, ...s };
      if (mergedKids.length) merged.children = mergedKids;
      else delete merged.children;
      out[idx] = merged;
      continue;
    }
    seen.add(key);
    const copy = { ...s };
    if (!Array.isArray(copy.children) || !copy.children.length) {
      delete copy.children;
    }
    out.push(copy);
  }
  return out;
}

/**
 * Whether the loser should become siblingsBefore (distinct sibling chrome)
 * vs drop (competing primary header/nav).
 * @param {string} winnerKey
 * @param {string} loserKey
 */
export function shouldKeepHeaderLoserAsSibling(winnerKey, loserKey) {
  if (isHeaderSiblingChromeKey(loserKey)) return true;
  // Link-list leaves are not chrome siblings — they belong nested under a shell
  // (or only as data). Never remount them on headless-header next to the sketch root.
  if (isHeaderLinkListLeafKey(loserKey)) {
    return false;
  }
  // Competing primary header/nav shells → keep one parent only
  if (
    isPrimaryHeaderNavChromeKey(winnerKey) &&
    isPrimaryHeaderNavChromeKey(loserKey)
  ) {
    return false;
  }
  // Non-sibling, non-primary challenger (e.g. promo strip) → keep as sibling
  if (!isPrimaryHeaderNavChromeKey(loserKey)) return true;
  // Primary loser vs non-primary winner — still demote to sibling only if
  // winner is not also primary (handled above); otherwise drop.
  return !isPrimaryHeaderNavChromeKey(winnerKey);
}

/**
 * Drop siblingsBefore entries that duplicate the winner or its children.
 * Also drop self-nested copies of the winner that incorrectly carry children
 * (footer merge bug: site-footer listed again under siblingsBefore with PH kids).
 * @param {object[]} siblings
 * @param {object} winner
 * @param {{ dropPreferredFooterHosts?: boolean }} [opts]
 */
function isHeaderLinkListLeafKey(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  return /(^|-)link-list($|-)/.test(k) || /context-link-list/.test(k);
}

export function pruneHeaderSiblingsBefore(siblings, winner, opts = {}) {
  const winnerKey = String(winner?.definitionKey || '');
  const childKeys = new Set(
    (winner?.children || [])
      .map((c) => String(c?.definitionKey || ''))
      .filter(Boolean),
  );
  const dropPreferredFooterHosts = opts.dropPreferredFooterHosts === true;
  return (siblings || []).filter((s) => {
    // Stale disk siblings: never keep link-list leaves on headless-header.
    if (isHeaderLinkListLeafKey(s?.definitionKey)) return false;
    const key = String(s?.definitionKey || '');
    if (!key) return false;
    if (key === winnerKey) return false;
    if (childKeys.has(key)) return false;
    // Never keep a sibling that is another copy of the partial root with children
    if (
      Array.isArray(s?.children) &&
      s.children.length > 0 &&
      key === winnerKey
    ) {
      return false;
    }
    // Multi-page footer merge: never keep a second preferred footer shell
    // (site-footer / global-footer) with nested PH children as siblingsBefore.
    if (
      dropPreferredFooterHosts &&
      isPreferredFooterParent(key) &&
      Array.isArray(s?.children) &&
      s.children.length > 0
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Whether a partial/sibling entry can nest children (has placeholder slots).
 * Disk `canHostMap` wins over stamped `canHostChildren` so renamed/deleted
 * packages cannot keep hosting after their definition disappears.
 * @param {object|null|undefined} entry
 * @param {Map<string, boolean>|Record<string, boolean>|null} [canHostMap]
 */
export function entryCanHostChildren(entry, canHostMap = null) {
  const key = String(entry?.definitionKey || '').trim();
  if (key && canHostMap instanceof Map && canHostMap.has(key)) {
    return Boolean(canHostMap.get(key));
  }
  if (key && canHostMap && typeof canHostMap === 'object' && !(canHostMap instanceof Map) && key in canHostMap) {
    return Boolean(canHostMap[key]);
  }
  if (typeof entry?.canHostChildren === 'boolean') return entry.canHostChildren;
  // Legacy read: older presentation files stamped placeholderKeys (not in SitePresentationDefinition).
  if (Array.isArray(entry?.placeholderKeys) && entry.placeholderKeys.length > 0) {
    return true;
  }
  return false;
}

/**
 * SitePresentationDefinition.partialDesigns must not carry `placeholderKeys`
 * (host slots live on the component def's `placeholders[]`). Strip before
 * merge outputs and disk write. In-memory callers may still *read* a legacy
 * stamp from older files until rewritten.
 * @param {object|null|undefined} partial
 * @returns {object|null|undefined}
 */
export function omitPartialPlaceholderKeys(partial) {
  if (!partial || typeof partial !== 'object') return partial;
  // placeholderKeys / sketchRoot are in-memory only (not SitePresentationDefinition).
  const { placeholderKeys: _omitPh, sketchRoot: _omitSketch, ...rest } = partial;
  return rest;
}

/**
 * Prefer later sectionIndex when both sides are equal hosts (or both leaf).
 * @param {object} prev
 * @param {object} next
 */
function preferLaterSectionIndex(prev, next) {
  const prevIdx = parseSectionIndex(prev?.sectionIndex);
  const nextIdx = parseSectionIndex(next?.sectionIndex);
  if (prevIdx !== undefined && nextIdx !== undefined) return nextIdx > prevIdx;
  return true;
}

/**
 * Merge two header partial entries using structural host capability (placeholders),
 * not definitionKey name scores.
 *
 * @param {object} prev
 * @param {object} next
 * @param {{ canHostMap?: Map<string, boolean>|Record<string, boolean>|null }} [opts]
 * @returns {object}
 */
export function mergeHeaderPartialEntries(prev, next, opts = {}) {
  const canHostMap = opts.canHostMap || null;
  const prevHost = entryCanHostChildren(prev, canHostMap);
  const nextHost = entryCanHostChildren(next, canHostMap);
  const prevSketch = prev?.sketchRoot === true;
  const nextSketch = next?.sketchRoot === true;

  let preferNext;
  // layoutSketch / conversion band root wins over a stuck disk leaf (no name scoring).
  if (prevSketch !== nextSketch) {
    preferNext = nextSketch;
  } else if (prevHost !== nextHost) {
    // Only one can host → that side is the nesting parent.
    preferNext = nextHost;
  } else {
    // Both host or both leaf → document order (later band is main sibling).
    preferNext = preferLaterSectionIndex(prev, next);
  }

  const winner = preferNext ? next : prev;
  const loser = preferNext ? prev : next;
  const winnerHost = entryCanHostChildren(winner, canHostMap);
  const loserHost = entryCanHostChildren(loser, canHostMap);

  let siblingsBefore = mergeSiblingsBeforeList(
    winner.siblingsBefore,
    loser.siblingsBefore,
  );
  const keepLoser = shouldKeepHeaderLoserAsSibling(
    String(winner?.definitionKey || ''),
    String(loser?.definitionKey || ''),
  );

  /** @type {object[]} */
  let children = [];

  if (winnerHost && loserHost) {
    // Two composites: sibling roots on headless-header. Keep each shell's own
    // children on the sibling; also union into winner when winner is empty so
    // AppPlaceholders are never left vacant while nestable children exist.
    const winnerKids = Array.isArray(winner.children) ? [...winner.children] : [];
    const loserKids = Array.isArray(loser.children) ? [...loser.children] : [];
    children =
      winnerKids.length > 0
        ? winnerKids
        : mergePartialChildren(loserKids, winnerKids);
    if (keepLoser) {
      siblingsBefore = mergeSiblingsBeforeList(siblingsBefore, [
        headerSiblingRef(
          winnerKids.length > 0
            ? loser
            : { ...loser, children: [] },
        ),
      ]);
    } else {
      console.warn(
        `  ⚠ Presentation: dropped competing header chrome "${loser?.definitionKey}" ` +
          `(kept parent "${winner?.definitionKey}" — one primary nav/header only)`,
      );
    }
  } else if (winnerHost) {
    children = mergePartialChildren(loser.children, winner.children);
    if (keepLoser) {
      siblingsBefore = mergeSiblingsBeforeList(siblingsBefore, [
        headerSiblingRef({ ...loser, children: [] }),
      ]);
    } else {
      console.warn(
        `  ⚠ Presentation: dropped competing header chrome "${loser?.definitionKey}" ` +
          `(kept parent "${winner?.definitionKey}" — one primary nav/header only)`,
      );
    }
  } else {
    // Neither can host — never attach nested children to the parent.
    children = [];
    if (keepLoser) {
      siblingsBefore = mergeSiblingsBeforeList(siblingsBefore, [
        headerSiblingRef({ ...loser, children: [] }),
      ]);
    } else {
      console.warn(
        `  ⚠ Presentation: dropped competing header chrome "${loser?.definitionKey}" ` +
          `(kept parent "${winner?.definitionKey}" — one primary nav/header only)`,
      );
    }
  }

  siblingsBefore = pruneHeaderSiblingsBefore(siblingsBefore, {
    ...winner,
    children,
  });

  const winnerIndex = parseSectionIndex(winner.sectionIndex);
  // Prefer winner/loser legacy stamps only as in-memory hostKeys for absorb;
  // never persist placeholderKeys on the merged partial.
  const winnerPhKeys = Array.isArray(winner.placeholderKeys)
    ? winner.placeholderKeys
    : Array.isArray(loser.placeholderKeys) && winnerHost
      ? loser.placeholderKeys
      : undefined;
  let merged = omitPartialPlaceholderKeys({
    ...winner,
    ...(winnerIndex !== undefined ? { sectionIndex: winnerIndex } : {}),
    canHostChildren: winnerHost,
    children,
    ...(siblingsBefore.length ? { siblingsBefore } : {}),
  });
  if (winnerHost) {
    merged = absorbSiblingChildrenIntoHost(
      winnerPhKeys?.length
        ? { ...merged, placeholderKeys: winnerPhKeys }
        : merged,
    );
    merged = omitPartialPlaceholderKeys(merged);
  }
  return merged;
}

/**
 * When a header host still has empty/sparse children, promote nestable children
 * from siblingsBefore that align to the host's placeholder keys.
 * @param {object} partial
 * @param {{ hostPlaceholderKeys?: string[] }} [opts]
 * @returns {object}
 */
export function absorbSiblingChildrenIntoHost(partial, opts = {}) {
  if (!partial || !entryCanHostChildren(partial)) return partial;
  const hostKeys = (
    Array.isArray(opts.hostPlaceholderKeys) && opts.hostPlaceholderKeys.length
      ? opts.hostPlaceholderKeys
      : Array.isArray(partial.placeholderKeys)
        ? partial.placeholderKeys
        : []
  )
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  let children = Array.isArray(partial.children) ? [...partial.children] : [];
  const siblings = Array.isArray(partial.siblingsBefore)
    ? partial.siblingsBefore
    : [];
  if (!siblings.length) return partial;

  /** @type {object[]} */
  const nextSiblings = [];
  for (const sib of siblings) {
    const sibKids = Array.isArray(sib?.children) ? sib.children : [];
    if (!sibKids.length) {
      nextSiblings.push(sib);
      continue;
    }
    const sibHosts = entryCanHostChildren(sib);
    /** @type {object[]} */
    const absorbed = [];
    /** @type {object[]} */
    const keptOnSibling = [];
    for (const c of sibKids) {
      if (!c?.definitionKey) continue;
      if (hostKeys.length) {
        const forced = forceChildPlaceholderAgainstHost({
          placeholder: c.placeholder,
          definitionKey: c.definitionKey,
          componentName: c.definitionKey,
          hostKeys,
        });
        if (forced) {
          absorbed.push({ ...c, placeholder: forced });
          // Keep on sibling host only when that sibling also declares the slot.
          if (sibHosts) {
            keptOnSibling.push({ ...c, placeholder: forced });
          }
          continue;
        }
      }
      // No host keys known: if winner children empty, absorb everything once.
      // When host keys are known and this child did not align, keep it on the sibling
      // (sibling-host enforce will force/drop against the sibling's own keys).
      if (!hostKeys.length && !children.length && !sibHosts) {
        absorbed.push(c);
        continue;
      }
      keptOnSibling.push(c);
    }
    if (absorbed.length) {
      children = mergePartialChildren(children, absorbed);
    }
    nextSiblings.push({
      ...sib,
      ...(keptOnSibling.length ? { children: keptOnSibling } : { children: undefined }),
    });
    if (!keptOnSibling.length) {
      const last = nextSiblings[nextSiblings.length - 1];
      delete last.children;
    }
  }

  return omitPartialPlaceholderKeys({
    ...partial,
    children,
    ...(nextSiblings.length ? { siblingsBefore: nextSiblings } : {}),
  });
}

/**
 * Prefer richer privacy consent over bare cookie-consent for the cookie partial.
 * @param {string} definitionKey
 * @returns {number}
 */
export function cookieChromeScore(definitionKey) {
  const k = String(definitionKey || '').toLowerCase();
  if (/privacy-consent/.test(k)) return 100;
  if (/consent-panel/.test(k)) return 90;
  if (/consent-banner/.test(k)) return 70;
  if (/cookie-consent|(^|-)cookie($|-)/.test(k)) return 40;
  return 10;
}

/**
 * When a composite page rendering has an AppPlaceholder but zero children, rebuild
 * children from content seed item names (never leave an empty grid/carousel silently).
 * Throws when there are no child packages to wire (empty AppPlaceholder is a hard failure).
 * @param {{ definitionKey?: string, children?: object[] }} rendering
 * @param {Array<{ definitionKey?: string, contentItemNames?: string[], sources?: { definition?: string } }>} componentResults
 * @returns {{ definitionKey?: string, children?: object[] }}
 */
export function ensureCompositePresentationChildren(rendering, componentResults = []) {
  const r = rendering && typeof rendering === 'object' ? { ...rendering } : {};
  if (!r.definitionKey) return r;
  if (Array.isArray(r.children) && r.children.length > 0) return r;

  const childComponents = (componentResults || []).filter((c) => c?.role === 'child');
  const parentKey = String(r.definitionKey || '');
  const selfNestedWithSeeds = childComponents.filter((c) => {
    const key = String(c?.definitionKey || '');
    const { names } = resolveChildContentItemNames(c);
    return key && key === parentKey && names.length > 0;
  });
  if (!childComponents.length) {
    // No child packages to wire. Infer expected children from emit (placeholders /
    // AppPlaceholder / explicit flag) — never planMode labels.
    const sectionMeta = (componentResults || []).find(
      (c) => c?.role === 'section' || String(c?.definitionKey || '') === parentKey,
    );
    const defSrc = String(sectionMeta?.sources?.definition || '');
    const hasHostPlaceholders =
      /\bplaceholders\s*:\s*\[[\s\S]*?key\s*:/.test(defSrc) &&
      !/\bplaceholders\s*:\s*\[\s*\]/.test(defSrc);
    const expectsChildren =
      hasHostPlaceholders ||
      Boolean(sectionMeta?.placeholderKey) ||
      r.expectCompositeChildren === true ||
      Array.isArray(r.children);
    if (expectsChildren) {
      console.warn(
        `  ⚠ Presentation: "${r.definitionKey}" expected children` +
          `${sectionMeta?.placeholderKey ? ` (placeholderKey=${sectionMeta.placeholderKey})` : ''}` +
          `${hasHostPlaceholders ? ' (parent definition has placeholders)' : ''}` +
          ` but no child packages in results — leaving page rendering without nested children`,
      );
    }
    return r;
  }

  /** @type {object[]} */
  const rebuilt = [];
  for (const child of childComponents) {
    let childKey = String(child.definitionKey || '');
    // Classic String(object) poison from stale section-conversion logs.
    if (
      !childKey ||
      childKey === 'object-object' ||
      /^\[object object\]$/i.test(String(child.componentName || ''))
    ) {
      continue;
    }
    if (childKey && childKey === parentKey) {
      // Self-nested keys cannot be nested under the parent rendering — skip here;
      // fail-fast below if seeds existed (distinct child package required).
      console.warn(
        `  ⚠ Presentation: skipped self-nested child key "${childKey}" under "${parentKey}"`,
      );
      continue;
    }
    const resolved = resolveChildContentItemNames(child);
    if (resolved.packageMissing) {
      console.warn(
        `  ⚠ Presentation: stale child "${child.definitionKey}" under "${r.definitionKey}" — package missing — skipped`,
      );
      continue;
    }
    if (!resolved.names.length) {
      console.warn(
        `  ⚠ Presentation: child "${child.definitionKey}" has no contentItemNames — cannot auto-wire under "${r.definitionKey}"`,
      );
      continue;
    }
    for (const name of resolved.names) {
      rebuilt.push({
        definitionKey: childKey,
        datasourceItem: name,
      });
    }
  }
  if (rebuilt.length) {
    console.warn(
      `  ⚠ Presentation: composite "${r.definitionKey}" had 0 children — wired ${rebuilt.length} from content seeds`,
    );
    r.children = rebuilt;
  } else if (selfNestedWithSeeds.length) {
    throw new Error(
      `Presentation: composite "${parentKey}" has AppPlaceholder seeds on a self-nested child ` +
        `(same definitionKey) — distinct child package required (e.g. FeatureCard under FeatureCardCarousel)`,
    );
  }
  return r;
}

/**
 * Drop nested children whose definitionKey equals the parent (self-nested composite).
 * @param {string} parentKey
 * @param {Array<{ definitionKey?: string }>} children
 */
export function filterSelfNestedChildren(parentKey, children) {
  const parent = String(parentKey || '');
  if (!parent) return children || [];
  const out = [];
  for (const c of children || []) {
    if (String(c?.definitionKey || '') === parent) {
      console.warn(
        `  ⚠ Presentation: dropped self-nested child "${parent}" (child must be a distinct definitionKey)`,
      );
      continue;
    }
    out.push(c);
  }
  return out;
}

/**
 * Prefer layoutSketch children, but drop self-nested host keys; if none remain,
 * use the package/seed fallback builder (avoids hollow canHostChildren partials).
 *
 * @param {{
 *   layoutSketch?: object|null,
 *   componentResults?: object[],
 *   parentDefinitionKey?: string|null,
 *   mapSketch?: (sketch: object|null|undefined, results: object[]) => object[],
 *   buildFallback: () => object[],
 * }} opts
 * @returns {object[]}
 */
export function resolveChildrenFromSketchOrPackages(opts = {}) {
  const parentKey = String(opts.parentDefinitionKey || '').trim();
  const results = Array.isArray(opts.componentResults) ? opts.componentResults : [];
  const mapSketch =
    typeof opts.mapSketch === 'function'
      ? opts.mapSketch
      : () => [];
  let children = mapSketch(opts.layoutSketch, results);
  if (!Array.isArray(children)) children = [];
  if (parentKey) {
    children = filterSelfNestedChildren(parentKey, children);
  }
  if (children.length) return children;
  const fallback =
    typeof opts.buildFallback === 'function' ? opts.buildFallback() : [];
  return Array.isArray(fallback) ? fallback : [];
}

/**
 * Fingerprint for deduping identical page renderings (same key + child DS list).
 * @param {{ definitionKey?: string, children?: Array<{ definitionKey?: string, datasourceItem?: string, variant?: string }> }} rendering
 */
export function pageRenderingFingerprint(rendering) {
  const kids = (rendering?.children || [])
    .map((c) =>
      [c?.definitionKey || '', c?.datasourceItem || '', c?.variant || ''].join(':'),
    )
    .join('|');
  return `${rendering?.definitionKey || ''}::${kids}`;
}

/**
 * Collect every definitionKey on header/footer partial trees (roots + nested).
 * @param {object[]|null|undefined} partials
 * @returns {Set<string>}
 */
export function collectPartialDesignDefinitionKeys(partials) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const p of partials || []) {
    const root = String(p?.definitionKey || '').trim();
    if (root) keys.add(root);
    for (const k of collectNestedDefinitionKeys(p)) keys.add(k);
  }
  return keys;
}

/**
 * Drop site chrome and identical duplicate composites from page renderings.
 * Primary signal: persisted `role` (partial-*). Definition-key regex is last
 * resort only when `role` is absent (legacy / hand-edited presentation).
 * Keys already on header/footer partial trees are always stripped (even with
 * explicit `role: "page"`) so secondary pages cannot duplicate site chrome.
 * @param {object[]} renderings
 * @param {{ partialKeys?: Set<string>|string[]|null }} [opts]
 * @returns {object[]}
 */
export function filterPageRenderings(renderings, opts = {}) {
  const partialKeysRaw = opts.partialKeys;
  /** @type {Set<string>} */
  const partialKeys =
    partialKeysRaw instanceof Set
      ? partialKeysRaw
      : new Set(
          Array.isArray(partialKeysRaw)
            ? partialKeysRaw.map((k) => String(k || '').trim()).filter(Boolean)
            : [],
        );
  const seen = new Set();
  const out = [];
  for (const r of renderings || []) {
    const key = String(r?.definitionKey || '').trim();
    const role = r?.role != null ? String(r.role).trim() : '';
    if (key && partialKeys.has(key)) {
      console.warn(
        `  ⚠ Presentation: stripped "${key}" from page renderings (already on header/footer partial)`,
      );
      continue;
    }
    if (isPartialChromeRole(role)) {
      console.warn(
        `  ⚠ Presentation: stripped site chrome "${r.definitionKey}" (role=${role}) from page renderings (belongs on partials)`,
      );
      continue;
    }
    if (!role && isSiteChromeDefinitionKey(r?.definitionKey)) {
      console.warn(
        `  ⚠ Presentation: stripped site chrome "${r.definitionKey}" from page renderings (belongs on partials; no role metadata)`,
      );
      continue;
    }
    const fp = pageRenderingFingerprint(r);
    if (seen.has(fp)) {
      console.warn(
        `  ⚠ Presentation: dropped duplicate page rendering "${r.definitionKey}"`,
      );
      continue;
    }
    seen.add(fp);
    out.push(r);
  }
  return out;
}

/**
 * Default competing child-family groups (prefer first matcher, drop rest in group).
 * Matched against definitionKey (lowercase). Applied per (placeholder, datasourceItem).
 * @type {Array<{ id: string, prefer: RegExp, drop: RegExp, requireSameDatasource?: boolean }>}
 */
export const DEFAULT_CHILD_FAMILY_CONFLICTS = [
  {
    id: 'signpost-vs-signpost-link',
    prefer: /footer-signpost(?!-link)/,
    drop: /signpost-link/,
    requireSameDatasource: false,
  },
  {
    id: 'branding-social-vs-logo-only',
    prefer: /branding-social/,
    drop: /footer-branding(?!-social)/,
    requireSameDatasource: false,
  },
  {
    id: 'link-columns-vs-link-group',
    prefer: /footer-link-column|footer-link-list|link-columns|navigation-group/,
    drop: /footer-link-group/,
    requireSameDatasource: false,
  },
  {
    id: 'link-columns-vs-navigation-group',
    prefer: /footer-link-column|footer-link-list|link-columns/,
    drop: /navigation-group/,
    requireSameDatasource: true,
  },
  {
    // Prefer leaf packages over mid-band shells when both share a PH.
    id: 'footer-leaves-vs-mid-shell',
    prefer: /footer-link-column|footer-link-list|footer-social-links|footer-legal|signpost-link|signpost-card/,
    drop: /footer-signposts$|footer-navigation$|footer-nav-shell|footer-mid/,
    requireSameDatasource: false,
  },
  {
    // Renamed leaf: footer-link-column replaces legacy footer-column (not footer-columns parent).
    id: 'link-column-vs-legacy-footer-column',
    prefer: /footer-link-column/,
    drop: /footer-column(?!s)(?!-)/,
    requireSameDatasource: false,
  },
];

/**
 * Prefer one competing child family per slot.
 * @param {object[]} children
 * @param {typeof DEFAULT_CHILD_FAMILY_CONFLICTS} [conflictGroups]
 */
export function preferSingleChildFamily(children, conflictGroups = DEFAULT_CHILD_FAMILY_CONFLICTS) {
  let out = Array.isArray(children) ? [...children] : [];
  if (!out.length) return out;

  // Drop unplaced logo-only branding when a placed branding-social exists.
  const hasPlacedSocial = out.some((c) => {
    const k = String(c?.definitionKey || '').toLowerCase();
    return /branding-social|footer-social/.test(k) && c?.placeholder;
  });
  if (hasPlacedSocial) {
    out = out.filter((c) => {
      const k = String(c?.definitionKey || '').toLowerCase();
      const isLogoOnly =
        /footer-branding(?!-social)/.test(k) ||
        (/branding/.test(k) && !/branding-social|social/.test(k));
      if (!isLogoOnly) return true;
      // Drop when no placeholder (orphaned mid-footer logo) or same social band.
      if (!c?.placeholder) return false;
      if (c.placeholder === 'footer-social') return false;
      return true;
    });
  }

  for (const group of conflictGroups || []) {
    const preferRe = group.prefer;
    const dropRe = group.drop;
    const hasPrefer = out.some((c) => preferRe.test(String(c?.definitionKey || '').toLowerCase()));
    if (!hasPrefer) continue;

    if (group.requireSameDatasource) {
      const preferDs = new Set(
        out
          .filter((c) => preferRe.test(String(c?.definitionKey || '').toLowerCase()))
          .map((c) => String(c?.datasourceItem || '').toLowerCase()),
      );
      out = out.filter((c) => {
        const k = String(c?.definitionKey || '').toLowerCase();
        if (!dropRe.test(k)) return true;
        const ds = String(c?.datasourceItem || '').toLowerCase();
        return !preferDs.has(ds);
      });
    } else {
      // Same placeholder band: drop competing family when prefer family present in that band.
      const preferPh = new Set(
        out
          .filter((c) => preferRe.test(String(c?.definitionKey || '').toLowerCase()))
          .map((c) => String(c?.placeholder || '')),
      );
      out = out.filter((c) => {
        const k = String(c?.definitionKey || '').toLowerCase();
        if (!dropRe.test(k)) return true;
        const ph = String(c?.placeholder || '');
        // If prefer family shares this placeholder (or either lacks PH), drop.
        if (!ph || preferPh.has(ph) || preferPh.has('') || preferPh.size > 0) {
          return false;
        }
        return true;
      });
    }
  }
  return out;
}

/**
 * Prefer one footer column family (compat wrapper).
 * @param {object[]} children
 */
export function preferSingleFooterColumnFamily(children) {
  return preferSingleChildFamily(children);
}

/**
 * Map footer child renderings to an explicit or generic kebab PH key.
 * Does not invent legacy four-band keys (footer-social / footer-legal / …).
 * @param {string} definitionKey
 * @param {string} datasourceItem
 * @param {string} [variant]
 * @returns {string | undefined}
 */
export function inferFooterChildPlaceholder(definitionKey, datasourceItem, variant) {
  void datasourceItem;
  void variant;
  const fromPlan = inferPlanChildPlaceholderKey({
    definitionKey,
    componentName: definitionKey,
  });
  return fromPlan || undefined;
}

/**
 * Remap legacy / wrong child placeholder keys onto the parent's declared keys.
 * Generic: exact match wins; then known aliases; then suffix/prefix fuzzy match.
 * @param {string | undefined} childPlaceholder
 * @param {string[]} parentPlaceholderKeys
 * @returns {string | undefined}
 */
export function alignChildPlaceholderToParent(childPlaceholder, parentPlaceholderKeys) {
  const child = String(childPlaceholder || '').trim();
  if (!child) return undefined;
  const keys = (parentPlaceholderKeys || []).map((k) => String(k || '').trim()).filter(Boolean);
  if (!keys.length) return child;
  if (keys.includes(child)) return child;
  // Known aliases
  if (child === 'footer-nav' && keys.includes('footer-navigation')) {
    return 'footer-navigation';
  }
  if (child === 'footer-navigation' && keys.includes('footer-nav') && !keys.includes('footer-navigation')) {
    return 'footer-nav';
  }
  if (child === 'footer-content') {
    const nav = keys.find((k) => /navigation|nav|columns|items/.test(k));
    if (nav) return nav;
  }
  // Fuzzy: child is prefix/suffix of a parent key or vice versa
  const fuzzy = keys.find(
    (k) =>
      k === child ||
      k.endsWith(`-${child}`) ||
      child.endsWith(`-${k}`) ||
      (k.includes(child) && child.length >= 4) ||
      (child.includes(k) && k.length >= 4),
  );
  return fuzzy || child;
}

/**
 * Derive a placeholder-like key from a definitionKey / component kebab
 * (`menzis-footer-account-links` → `footer-account-links`).
 * @param {string|null|undefined} definitionKey
 * @returns {string}
 */
export function inferPlaceholderFromDefinitionKey(definitionKey) {
  const key = String(definitionKey || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  if (!key) return '';
  const parts = key.split('-').filter(Boolean);
  if (parts.length >= 2) return parts.slice(1).join('-');
  return key;
}

/**
 * Force a nested child's placeholder onto the host's **current** keys.
 * Stale capture-meta PH (e.g. footer-support-links) is ignored when not on the host;
 * definitionKey inference is preferred over a foreign explicit PH.
 *
 * @param {{
 *   placeholder?: string|null,
 *   definitionKey?: string|null,
 *   componentName?: string|null,
 *   hostKeys?: string[]|null,
 * }} opts
 * @returns {string} Host-aligned key, or '' when hostKeys are set and nothing matches (drop).
 */
export function forceChildPlaceholderAgainstHost(opts = {}) {
  const hostKeys = (opts.hostKeys || [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  const definitionKey = String(opts.definitionKey || '').trim();
  const componentName = String(opts.componentName || definitionKey).trim();
  const explicit = String(opts.placeholder || '').trim();

  if (hostKeys.length && explicit && hostKeys.includes(explicit)) {
    return explicit;
  }

  if (explicit && hostKeys.length) {
    const aligned = alignChildPlaceholderToParent(explicit, hostKeys);
    if (aligned && hostKeys.includes(aligned)) return aligned;
  }

  const fromName =
    inferPlaceholderFromDefinitionKey(definitionKey) ||
    inferPlaceholderFromDefinitionKey(componentName);

  if (!hostKeys.length) {
    // No host contract: keep explicit when present, else name-derived.
    return explicit || fromName || '';
  }

  if (fromName && hostKeys.includes(fromName)) return fromName;
  if (fromName) {
    const alignedName = alignChildPlaceholderToParent(fromName, hostKeys);
    if (alignedName && hostKeys.includes(alignedName)) return alignedName;
  }

  const suffixHit = hostKeys.find(
    (k) =>
      definitionKey === k ||
      definitionKey.endsWith(`-${k}`) ||
      componentName.endsWith(k) ||
      (fromName && (fromName === k || fromName.endsWith(`-${k}`))),
  );
  if (suffixHit) return suffixHit;

  // Explicit foreign PH under a host that declares slots — do not keep.
  return '';
}

/**
 * Remap legacy / wrong footer child placeholder keys onto the parent's real keys.
 * Compat alias for {@link alignChildPlaceholderToParent}.
 * @param {string | undefined} childPlaceholder
 * @param {string[]} parentPlaceholderKeys
 * @returns {string | undefined}
 */
export function alignFooterChildPlaceholder(childPlaceholder, parentPlaceholderKeys) {
  return alignChildPlaceholderToParent(childPlaceholder, parentPlaceholderKeys);
}

/**
 * Extract placeholders[].key values from a definition.ts source string.
 * @param {string|null|undefined} definitionSource
 * @returns {string[]}
 */
export function extractPlaceholderKeysFromDefinition(definitionSource) {
  return extractPlaceholderSlotsFromDefinition(definitionSource).map((s) => s.key);
}

/**
 * Parse placeholders[] entries (key + allowedControls) from a definition.ts source.
 * @param {string} definitionSource
 * @returns {Array<{ key: string, allowedControls: string[] }>}
 */
export function extractPlaceholderSlotsFromDefinition(definitionSource) {
  const src = String(definitionSource || '');
  const start = src.search(/placeholders\s*:\s*\[/);
  if (start < 0) return [];
  const open = src.indexOf('[', start);
  if (open < 0) return [];
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return [];
  const block = src.slice(open + 1, end);
  /** @type {Array<{ key: string, allowedControls: string[] }>} */
  const slots = [];
  // Split roughly on objects: { key: '…', allowedControls: […] }
  const objRe = /\{[^{}]*\bkey\s*:\s*["']([^"']+)["'][^{}]*\}/g;
  let m;
  while ((m = objRe.exec(block))) {
    const chunk = m[0];
    const key = String(m[1] || '').trim();
    if (!key) continue;
    /** @type {string[]} */
    const allowedControls = [];
    const ac = chunk.match(/allowedControls\s*:\s*\[([\s\S]*?)\]/);
    if (ac?.[1]) {
      for (const am of ac[1].matchAll(/["']([^"']+)["']/g)) {
        allowedControls.push(am[1]);
      }
    }
    slots.push({ key, allowedControls });
  }
  return slots;
}

/**
 * Move presentation children onto the host that actually declares their placeholder
 * (e.g. context-links under site-header-top, not as a sibling under site-header).
 * Drops children whose placeholder is missing from every reachable host or whose
 * target slot has empty allowedControls (cannot mount).
 *
 * @param {object[]} partials
 * @param {string} hostSlug
 * @returns {Promise<object[]>}
 */
export async function relocatePartialChildrenToMountedHosts(partials, hostSlug) {
  /** @type {Map<string, Array<{ key: string, allowedControls: string[] }>>} */
  const slotCache = new Map();
  /** @type {Map<string, Set<string>|null>} */
  const tsxMountCache = new Map();
  const { extractPlaceholderBasesFromTsx } = await import(
    './sync-definition-from-tsx.mjs'
  );
  const { collectBareAppPlaceholderLiteralNames } = await import(
    './tsx-contract-diagnostics.mjs'
  );

  /**
   * @param {string} definitionKey
   */
  async function slotsFor(definitionKey) {
    const key = String(definitionKey || '').trim();
    if (!key) return [];
    if (slotCache.has(key)) return slotCache.get(key) || [];
    const defPath = await resolveDefinitionTsPath(key, hostSlug);
    /** @type {Array<{ key: string, allowedControls: string[] }>} */
    let slots = [];
    if (defPath) {
      try {
        slots = extractPlaceholderSlotsFromDefinition(
          await readFile(defPath, 'utf8'),
        );
      } catch {
        slots = [];
      }
    }
    slotCache.set(key, slots);
    return slots;
  }

  /**
   * AppPlaceholder bases actually mounted in package TSX (null = unknown / no tsx).
   * @param {string} definitionKey
   * @returns {Promise<Set<string>|null>}
   */
  async function tsxMountedBases(definitionKey) {
    const key = String(definitionKey || '').trim();
    if (!key) return null;
    if (tsxMountCache.has(key)) return tsxMountCache.get(key) ?? null;
    const defPath = await resolveDefinitionTsPath(key, hostSlug);
    if (!defPath) {
      tsxMountCache.set(key, null);
      return null;
    }
    const tsxPath = defPath.replace(/\.definition\.ts$/, '.tsx');
    try {
      const tsx = await readFile(tsxPath, 'utf8');
      const bases = new Set(
        [
          ...(extractPlaceholderBasesFromTsx(tsx) || []),
          ...(collectBareAppPlaceholderLiteralNames(tsx) || []),
        ]
          .map((b) => String(b || '').trim())
          .filter(Boolean),
      );
      tsxMountCache.set(key, bases);
      return bases;
    } catch {
      tsxMountCache.set(key, null);
      return null;
    }
  }

  /**
   * True when parent may keep a direct child on placeholder `ph`.
   * Prefer sibling hosts when the root declares `ph` in definition but does not mount it in TSX.
   * @param {string} parentKey
   * @param {string} ph
   * @param {Array<{ key: string, allowedControls: string[] }>} rootSlots
   */
  async function rootCanKeepChild(parentKey, ph, rootSlots) {
    const slot = rootSlots.find((s) => s.key === ph);
    if (!slot) return false;
    const mounted = await tsxMountedBases(parentKey);
    // When TSX mounts are known and non-empty, only keep children for mounted bases
    // (definition may still list stale keys the FE never paints).
    if (mounted && mounted.size > 0 && !mounted.has(ph)) return false;
    return true;
  }

/**
   * @param {object} partial
   */
  async function relocateOne(partial) {
    if (!partial?.definitionKey) return partial;
    const incoming = Array.isArray(partial.children) ? partial.children : [];
    if (!incoming.length) return partial;

    const rootSlots = await slotsFor(partial.definitionKey);
    const rootKeys = new Set(rootSlots.map((s) => s.key));

    /** Mutable copies of direct children (may gain nested children). */
    /** @type {object[]} */
    const hosts = incoming.map((c) => ({
      ...c,
      children: Array.isArray(c.children) ? [...c.children] : [],
    }));

    /** @type {object[]} */
    const keptOnRoot = [];
    /** @type {Set<object>} */
    const nestedAway = new Set();

    for (const child of hosts) {
      const ph = String(child.placeholder || '').trim();
      const childKey = String(child.definitionKey || '').trim();
      if (!childKey) continue;

      const slotOk = (slot) => {
        if (!slot) return false;
        if (slot.allowedControls.length === 0) return false;
        return slot.allowedControls.includes(childKey);
      };

      const canKeepOnRoot =
        ph &&
        (await rootCanKeepChild(partial.definitionKey, ph, rootSlots)) &&
        slotOk(rootSlots.find((s) => s.key === ph));

      // Prefer nesting under a sibling host that mounts `ph` when root does not.
      let nested = false;
      if (ph && !canKeepOnRoot) {
        for (const host of hosts) {
          if (host === child) continue;
          const hostKey = String(host.definitionKey || '');
          const hostSlots = await slotsFor(hostKey);
          const hostSlot = hostSlots.find((s) => s.key === ph);
          if (!slotOk(hostSlot)) continue;
          const hostMounted = await tsxMountedBases(hostKey);
          if (hostMounted && hostMounted.size > 0 && !hostMounted.has(ph)) continue;
          host.children.push({
            ...child,
            placeholder: ph,
            children: child.children,
          });
          console.warn(
            `  ⚠ Presentation: nested "${childKey}" under "${hostKey}" (placeholder "${ph}")`,
          );
          nestedAway.add(child);
          nested = true;
          break;
        }
      }

      if (canKeepOnRoot && !nested) {
        keptOnRoot.push(child);
        continue;
      }

      if (!nested) {
        if (ph && !rootKeys.has(ph)) {
          console.warn(
            `  ⚠ Presentation: dropped "${childKey}" — placeholder "${ph}" not on "${partial.definitionKey}" or sibling hosts`,
          );
          nestedAway.add(child);
        } else if (ph && !canKeepOnRoot) {
          console.warn(
            `  ⚠ Presentation: dropped "${childKey}" — "${partial.definitionKey}" does not mount "${ph}" in TSX and no sibling host accepted it`,
          );
          nestedAway.add(child);
        } else {
          keptOnRoot.push(child);
        }
      }
    }

    return {
      ...partial,
      children: keptOnRoot.filter((c) => !nestedAway.has(c)),
      canHostChildren: true,
    };
  }

  /** @type {object[]} */
  const out = [];
  for (const p of partials || []) {
    out.push(await relocateOne(p));
  }
  return out;
}

/**
 * Resolve package definition.ts path for a definitionKey under a host.
 * @param {string} definitionKey
 * @param {string} hostSlug
 * @returns {Promise<string|null>}
 */
export async function resolveDefinitionTsPath(definitionKey, hostSlug) {
  const key = String(definitionKey || '').trim();
  const host = String(hostSlug || '').trim();
  if (!key || !host) return null;
  const pascal = toPascalCase(key);
  const candidates = [
    path.join(bqRoot, 'src', 'components', host, pascal, `${key}.definition.ts`),
  ];
  for (const c of candidates) {
    if (await pathExists(c)) return c;
  }
  // Slow fallback: scan host packages for matching definitionKey export file name.
  const hostRoot = path.join(bqRoot, 'src', 'components', host);
  if (!(await pathExists(hostRoot))) return null;
  try {
    const dirs = await readdir(hostRoot, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory() || d.name.startsWith('_') || d.name === 'sites') continue;
      const defPath = path.join(hostRoot, d.name, `${key}.definition.ts`);
      if (await pathExists(defPath)) return defPath;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * True when the package definition declares at least one placeholder slot.
 * @param {string} definitionKey
 * @param {string} hostSlug
 * @param {Map<string, boolean>} [cache]
 */
export async function definitionCanHostChildren(
  definitionKey,
  hostSlug,
  cache = null,
) {
  const key = String(definitionKey || '').trim();
  if (!key) return false;
  if (cache instanceof Map && cache.has(key)) return Boolean(cache.get(key));
  const defPath = await resolveDefinitionTsPath(key, hostSlug);
  let canHost = false;
  if (defPath) {
    try {
      const src = await readFile(defPath, 'utf8');
      canHost = extractPlaceholderKeysFromDefinition(src).length > 0;
    } catch {
      canHost = false;
    }
  }
  if (cache instanceof Map) cache.set(key, canHost);
  return canHost;
}

/**
 * Build a canHost map for all definition keys referenced by partials.
 * @param {string} hostSlug
 * @param {object[]} partials
 * @returns {Promise<Map<string, boolean>>}
 */
export async function buildHostCapabilityMap(hostSlug, partials) {
  /** @type {Map<string, boolean>} */
  const cache = new Map();
  const keys = new Set();
  for (const p of partials || []) {
    if (p?.definitionKey) keys.add(String(p.definitionKey));
    for (const s of p?.siblingsBefore || []) {
      if (s?.definitionKey) keys.add(String(s.definitionKey));
    }
  }
  for (const key of keys) {
    await definitionCanHostChildren(key, hostSlug, cache);
  }
  return cache;
}

/**
 * When a primary header/nav **host** (has placeholders) nests another primary
 * chrome as a child, promote the nested primary to the partial root and drop
 * the wrapper shell (avoids Global Header hosting Header Navigation).
 * Skips leaf parents — those are handled by sibling host promotion below.
 * @param {object} partial
 * @param {Map<string, boolean>|Record<string, boolean>|null} [canHostMap]
 * @returns {object}
 */
export function sanitizeNestedPrimaryHeaderChrome(partial, canHostMap = null) {
  if (!partial || String(partial.signature || '').toLowerCase() !== 'header') {
    return partial;
  }
  const hostKey = String(partial.definitionKey || '').trim();
  if (!hostKey || !isPrimaryHeaderNavChromeKey(hostKey)) return partial;
  // Leaf chrome with nested kids is fixed by promoting a host-capable sibling.
  if (!entryCanHostChildren(partial, canHostMap)) return partial;
  const kids = Array.isArray(partial.children) ? [...partial.children] : [];
  // Only promote a nested primary that can actually host — never elevate a leaf
  // (e.g. context-link-list) into the partial root via name match alone.
  const primaryIdx = kids.findIndex((c) => {
    const key = String(c?.definitionKey || '').trim();
    if (!key || !isPrimaryHeaderNavChromeKey(key)) return false;
    return entryCanHostChildren(
      {
        definitionKey: key,
        canHostChildren: c?.canHostChildren,
        placeholderKeys: c?.placeholderKeys,
      },
      canHostMap,
    );
  });
  if (primaryIdx < 0) return partial;
  const promoted = kids[primaryIdx];
  const promotedKey = String(promoted.definitionKey || '').trim();
  const nonPrimaryKids = kids.filter(
    (_, i) => i !== primaryIdx && !isPrimaryHeaderNavChromeKey(String(kids[i]?.definitionKey || '')),
  );
  const promotedKids = Array.isArray(promoted.children) ? promoted.children : [];
  console.warn(
    `  ⚠ Presentation: promoted nested primary "${promotedKey}" over host "${hostKey}" ` +
      `(refusing primary header chrome nested under primary header chrome)`,
  );
  return omitPartialPlaceholderKeys({
    ...partial,
    definitionKey: promotedKey,
    ...(promoted.datasourceItem
      ? { datasourceItem: promoted.datasourceItem }
      : {}),
    ...(promoted.renderingIdentifier
      ? { renderingIdentifier: promoted.renderingIdentifier }
      : {}),
    children: mergePartialChildren(promotedKids, nonPrimaryKids),
  });
}

/**
 * Fail closed / promote when a partial still nests children under a leaf parent.
 * @param {object[]} partials
 * @param {Map<string, boolean>|Record<string, boolean>|null} canHostMap
 * @returns {object[]}
 */
export function sanitizePartialNesting(partials, canHostMap = null) {
  return (partials || []).map((partial) => {
    if (!partial?.signature) return partial;
    partial = sanitizeNestedPrimaryHeaderChrome(partial, canHostMap);
    let siblingsBefore = Array.isArray(partial.siblingsBefore)
      ? partial.siblingsBefore.map((s) => {
          if (
            Array.isArray(s?.children) &&
            s.children.length &&
            !entryCanHostChildren(s, canHostMap)
          ) {
            throw new Error(
              `[bq:apply:site-presentation] partial "${partial.signature}" sibling "${s.definitionKey}" has ` +
                `${s.children.length} nested child(ren) but placeholders are empty — ` +
                `refusing to skip. Declare placeholders on the definition ` +
                `(matching AppPlaceholder bases in TSX).`,
            );
          }
          return s;
        })
      : [];

    const childCount = Array.isArray(partial.children) ? partial.children.length : 0;
    if (!childCount) {
      return siblingsBefore.length
        ? { ...partial, siblingsBefore }
        : { ...partial, siblingsBefore: undefined };
    }

    if (entryCanHostChildren(partial, canHostMap)) {
      return siblingsBefore.length
        ? { ...partial, siblingsBefore }
        : { ...partial };
    }

    // Promote first host-capable sibling as parent when present.
    const promoteIdx = siblingsBefore.findIndex((s) =>
      entryCanHostChildren(s, canHostMap),
    );
    if (promoteIdx >= 0) {
      const host = siblingsBefore[promoteIdx];
      const rest = siblingsBefore.filter((_, i) => i !== promoteIdx);
      const leafRef = headerSiblingRef({ ...partial, children: [] });
      console.warn(
        `  ⚠ Presentation: promoted "${host.definitionKey}" over leaf "${partial.definitionKey}" ` +
          `for partial "${partial.signature}" (leaf had nested children but no placeholders)`,
      );
      return {
        ...partial,
        definitionKey: host.definitionKey,
        datasourceItem: host.datasourceItem,
        renderingIdentifier: host.renderingIdentifier,
        sectionIndex: host.sectionIndex ?? partial.sectionIndex,
        canHostChildren: true,
        children: mergePartialChildren(host.children, partial.children),
        siblingsBefore: mergeSiblingsBeforeList(rest, [leafRef]),
      };
    }

    throw new Error(
      `[bq:apply:site-presentation] partial "${partial.signature}" rendering "${partial.definitionKey}" has ` +
        `${childCount} nested child(ren) but parent placeholders are empty — ` +
        `refusing to skip. Declare placeholders on the parent definition ` +
        `(matching AppPlaceholder bases in TSX).`,
    );
  });
}

const NEWS_TEASER_DEF =
  'src/components/dom-security-com/DomSecurityNewsTeaser/dom-security-news-teaser.definition.ts';
const NEWS_TEASER_KEY = 'dom-security-news-teaser';
const NEWS_GRID_KEY = 'dom-security-news-grid';
const NEWS_TEASERS_SECTION_KEY = 'dom-security-news-teasers';

/** Parse Date like "24 May 2024" → epoch ms (0 if unknown). */
function parseNewsDate(value) {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : 0;
}

/**
 * Load shared news item names newest-first from DomSecurityNewsTeaser seeds.
 * @returns {Promise<string[]>}
 */
async function loadSharedNewsItemNamesNewestFirst() {
  try {
    const src = await readFile(path.join(bqRoot, NEWS_TEASER_DEF), 'utf8');
    const items = [];
    const re =
      /\{\s*name:\s*"([^"]+)"[\s\S]*?Date:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src))) {
      items.push({ name: m[1], date: m[2], t: parseNewsDate(m[2]) });
    }
    items.sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
    return items.map((i) => i.name);
  } catch {
    return [];
  }
}

function newsChild(datasourceItem) {
  return { definitionKey: NEWS_TEASER_KEY, datasourceItem };
}

/**
 * Keep homepage Latest news = 2 newest shared items; newsroom grid = all.
 * Mutates `pages` in place.
 */
async function applySharedNewsWiring(pages) {
  if (!pages || typeof pages !== 'object') return;
  const names = await loadSharedNewsItemNamesNewestFirst();
  if (!names.length) return;

  const homeLatest = names.slice(0, 2);
  const home = pages.home;
  if (home?.renderings) {
    for (const r of home.renderings) {
      if (r.definitionKey === NEWS_TEASERS_SECTION_KEY) {
        r.children = homeLatest.map(newsChild);
      }
    }
  }

  const newsroom = pages.newsroom;
  if (newsroom?.renderings) {
    for (const r of newsroom.renderings) {
      if (r.definitionKey === NEWS_GRID_KEY) {
        r.children = names.map(newsChild);
      }
    }
  }
}

/**
 * Derive Sitecore Home-relative route from a captured page URL.
 * Strips host + market/locale prefixes (e.g. /be/en/newsroom → /newsroom).
 * @param {string} url
 * @returns {{ pageKey: string, routePath: string, isHome: boolean, navigationTitle?: string }}
 */
export function pageRouteFromCaptureUrl(url) {
  let pathname = '/';
  try {
    pathname = new URL(String(url || '')).pathname || '/';
  } catch {
    pathname = String(url || '/');
  }
  const segments = pathname.split('/').filter(Boolean);
  // Drop leading market (be, nl, fr, …) and locale (en, en-BE, nl-BE, …)
  while (segments.length) {
    const s = segments[0];
    if (/^[a-z]{2}$/i.test(s) || /^[a-z]{2}-[a-z]{2}$/i.test(s)) {
      segments.shift();
      continue;
    }
    break;
  }
  if (!segments.length) {
    return { pageKey: 'home', routePath: '/', isHome: true };
  }
  const routePath = `/${segments.join('/')}`;
  const pageKey = segments
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
  const navigationTitle = segments[segments.length - 1]
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { pageKey, routePath, isHome: false, navigationTitle };
}

/** Soft key for partial children so social/legal rows are not lost on regen ties. */
function partialChildKey(child) {
  return [
    String(child?.definitionKey || ''),
    String(child?.datasourceItem || ''),
    String(child?.variant || ''),
  ].join('::');
}

/**
 * Union partial Design children by definitionKey+datasourceItem+variant.
 * Incoming wins field-level conflicts; keep prior `placeholder` when incoming omits it.
 */
function mergePartialChildren(prevChildren, nextChildren) {
  const byKey = new Map();
  for (const child of prevChildren || []) {
    if (!child?.definitionKey) continue;
    byKey.set(partialChildKey(child), { ...child });
  }
  for (const child of nextChildren || []) {
    if (!child?.definitionKey) continue;
    const key = partialChildKey(child);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...child });
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...child,
      placeholder: child.placeholder || prev.placeholder,
    });
  }
  return [...byKey.values()];
}

function isPreferredFooterParent(definitionKey) {
  return /site-footer|global-footer/.test(String(definitionKey || '').toLowerCase());
}

function mergeAvailableRenderings(existing, incoming) {
  const groups = ['Page Content', 'Navigation', 'Page Structure'];
  const out = {};
  for (const g of groups) {
    const prev = Array.isArray(existing?.[g]) ? existing[g] : [];
    const next = Array.isArray(incoming?.[g]) ? incoming[g] : [];
    const merged = [];
    for (const key of [...prev, ...next]) {
      if (key && !merged.includes(key)) merged.push(key);
    }
    out[g] = merged;
  }
  // Preserve any extra groups from existing
  if (existing && typeof existing === 'object') {
    for (const [g, keys] of Object.entries(existing)) {
      if (out[g] || !Array.isArray(keys)) continue;
      out[g] = [...keys];
    }
  }
  return out;
}

/**
 * Re-stamp partial roots' canHostChildren from the disk capability map.
 * @param {object[]} partials
 * @param {Map<string, boolean>|Record<string, boolean>|null} canHostMap
 * @returns {object[]}
 */
export function restampPartialHostFlags(partials, canHostMap = null) {
  return (partials || []).map((partial) => {
    if (!partial || typeof partial !== 'object') return partial;
    return omitPartialPlaceholderKeys({
      ...partial,
      canHostChildren: entryCanHostChildren(partial, canHostMap),
    });
  });
}

/**
 * Dedupe partial children that share definitionKey + placeholder + datasourceItem.
 * @param {object[]} children
 * @returns {object[]}
 */
export function dedupePartialChildrenBySeed(children) {
  const seen = new Set();
  /** @type {object[]} */
  const out = [];
  for (const c of children || []) {
    if (!c?.definitionKey) continue;
    // Match mergePartialChildren / partialChildKey: ignore placeholder so
    // empty vs explicit "footer-columns" cannot double the same seed.
    const key = partialChildKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Collect definitionKeys nested under a partial (children + siblingsBefore trees).
 * @param {object|null|undefined} partial
 * @returns {Set<string>}
 */
export function collectNestedDefinitionKeys(partial) {
  /** @type {Set<string>} */
  const keys = new Set();
  /** @param {object[]|undefined|null} nodes */
  const walk = (nodes) => {
    for (const n of nodes || []) {
      const key = String(n?.definitionKey || '').trim();
      if (key) keys.add(key);
      if (Array.isArray(n?.children) && n.children.length) walk(n.children);
      if (Array.isArray(n?.siblingsBefore) && n.siblingsBefore.length) {
        walk(n.siblingsBefore);
      }
    }
  };
  if (!partial || typeof partial !== 'object') return keys;
  walk(partial.children);
  walk(partial.siblingsBefore);
  return keys;
}

/**
 * Recursively require non-empty `placeholder` on every nested child.
 * When parentPlaceholderKeys are known (chrome host slots), align/infer into
 * those keys; otherwise keep or infer a PH. Nodes that still lack a PH are dropped.
 *
 * @param {object[]|undefined|null} nodes
 * @param {{
 *   parentPlaceholderKeys?: string[],
 *   logPrefix?: string,
 * }} [opts]
 * @returns {{ nodes: object[], dropped: string[] }}
 */
export function enforceNestedPlaceholders(nodes, opts = {}) {
  const parentKeys = (opts.parentPlaceholderKeys || [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  /** @type {string[]} */
  const dropped = [];
  const logPrefix = String(opts.logPrefix || '').trim();

  /**
   * @param {object[]|undefined|null} list
   * @param {string[]} hostKeys
   * @returns {object[]}
   */
  const walk = (list, hostKeys) => {
    /** @type {object[]} */
    const out = [];
    for (const node of list || []) {
      const definitionKey = String(node?.definitionKey || '').trim();
      if (!definitionKey) continue;

      const ph = forceChildPlaceholderAgainstHost({
        placeholder: node.placeholder,
        definitionKey,
        componentName: definitionKey,
        hostKeys,
      });

      if (!ph) {
        dropped.push(definitionKey);
        continue;
      }

      /** @type {object} */
      const next = { ...node, placeholder: ph };
      if (Array.isArray(node.children) && node.children.length) {
        // Deeper levels: require PH presence; do not force parent host keys.
        next.children = walk(node.children, []);
      }
      out.push(next);
    }
    return out;
  };

  const result = walk(nodes, parentKeys);
  if (dropped.length && logPrefix) {
    console.warn(
      `  ⚠ ${logPrefix}: dropped nested rendering(s) missing placeholder: ${dropped.join(', ')}`,
    );
  }
  return { nodes: result, dropped };
}

/**
 * Apply {@link enforceNestedPlaceholders} to page renderings and partial designs
 * (including siblingsBefore nested trees).
 *
 * Sibling hosts use **their** current definition placeholders[] as source of truth
 * (never leave stale child capture-meta PH like footer-support-links).
 *
 * @param {{
 *   renderings?: object[],
 *   partials?: object[],
 *   hostSlug?: string,
 *   hostKeysByDefinitionKey?: Map<string, string[]>|Record<string, string[]>,
 * }} opts
 * @returns {Promise<{ renderings: object[], partials: object[] }>}
 */
export async function enforcePresentationNestedPlaceholders(opts = {}) {
  const hostSlug = String(opts.hostSlug || '').trim();
  /** @type {Map<string, string[]>} */
  const keysCache = new Map();
  if (opts.hostKeysByDefinitionKey instanceof Map) {
    for (const [k, v] of opts.hostKeysByDefinitionKey) {
      keysCache.set(String(k || ''), [...(v || [])]);
    }
  } else if (
    opts.hostKeysByDefinitionKey &&
    typeof opts.hostKeysByDefinitionKey === 'object'
  ) {
    for (const [k, v] of Object.entries(opts.hostKeysByDefinitionKey)) {
      keysCache.set(k, Array.isArray(v) ? [...v] : []);
    }
  }

  /**
   * @param {string} definitionKey
   * @param {string[]|undefined|null} stamped
   * @returns {Promise<string[]>}
   */
  const resolveHostKeys = async (definitionKey, stamped) => {
    if (Array.isArray(stamped) && stamped.length) {
      return stamped.map((k) => String(k || '').trim()).filter(Boolean);
    }
    const key = String(definitionKey || '').trim();
    if (!key) return [];
    if (keysCache.has(key)) return keysCache.get(key) || [];
    /** @type {string[]} */
    let keys = [];
    if (hostSlug) {
      try {
        const defPath = await resolveDefinitionTsPath(key, hostSlug);
        if (defPath) {
          keys = extractPlaceholderKeysFromDefinition(
            await readFile(defPath, 'utf8'),
          );
        }
      } catch {
        keys = [];
      }
    }
    keysCache.set(key, keys);
    return keys;
  };

  const renderings = [];
  for (const r of opts.renderings || []) {
    if (!Array.isArray(r?.children) || !r.children.length) {
      renderings.push(r);
      continue;
    }
    const hostKeys = await resolveHostKeys(
      r.definitionKey,
      r.placeholderKeys,
    );
    const { nodes } = enforceNestedPlaceholders(r.children, {
      parentPlaceholderKeys: hostKeys,
      logPrefix: `page rendering "${r.definitionKey || '?'}"`,
    });
    renderings.push({ ...r, children: nodes });
  }

  const partials = [];
  for (const partial of opts.partials || []) {
    if (!partial || typeof partial !== 'object') {
      partials.push(partial);
      continue;
    }
    let next = { ...partial };
    if (Array.isArray(partial.children) && partial.children.length) {
      const hostKeys = await resolveHostKeys(
        partial.definitionKey,
        partial.placeholderKeys,
      );
      const { nodes } = enforceNestedPlaceholders(partial.children, {
        parentPlaceholderKeys: hostKeys,
        logPrefix: `partial "${partial.signature || partial.definitionKey || '?'}"`,
      });
      next.children = nodes;
    }
    if (Array.isArray(partial.siblingsBefore) && partial.siblingsBefore.length) {
      const nextSiblings = [];
      for (const sib of partial.siblingsBefore) {
        if (!Array.isArray(sib?.children) || !sib.children.length) {
          nextSiblings.push(headerSiblingRef(sib));
          continue;
        }
        const sibKeys = await resolveHostKeys(
          sib.definitionKey,
          sib.placeholderKeys,
        );
        const { nodes } = enforceNestedPlaceholders(sib.children, {
          parentPlaceholderKeys: sibKeys,
          logPrefix: `partial "${partial.signature || '?'}" sibling "${sib.definitionKey || '?'}"`,
        });
        nextSiblings.push(headerSiblingRef({ ...sib, children: nodes }));
      }
      next.siblingsBefore = nextSiblings;
    }
    partials.push(next);
  }

  return { renderings, partials };
}

/**
 * Fill empty host partial slots from candidate packages (Navigation children).
 * Only adds real definitionKeys — never invents ghosts.
 * @param {object} partial
 * @param {{
 *   candidates?: Array<{ definitionKey?: string, componentName?: string, placeholder?: string, role?: string, datasourceItem?: string, contentItemNames?: string[] }>,
 *   hostPlaceholderKeys?: string[],
 * }} [opts]
 * @returns {object}
 */
export function ensureHostPartialChildrenFromCandidates(partial, opts = {}) {
  if (!partial?.definitionKey || !entryCanHostChildren(partial)) return partial;
  const hostKeys = (
    Array.isArray(opts.hostPlaceholderKeys) && opts.hostPlaceholderKeys.length
      ? opts.hostPlaceholderKeys
      : Array.isArray(partial.placeholderKeys)
        ? partial.placeholderKeys
        : []
  )
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  let children = dedupePartialChildrenBySeed(
    Array.isArray(partial.children) ? partial.children : [],
  );
  const parentKey = String(partial.definitionKey || '');
  const parentIsPrimary = isPrimaryHeaderNavChromeKey(parentKey);
  const candidates = (opts.candidates || []).filter((c) => {
    const key = String(c?.definitionKey || '').trim();
    if (!key || key === parentKey) return false;
    const role = String(c?.role || '').toLowerCase();
    if (role === 'section' || role.startsWith('partial-')) return false;
    // Never nest a primary header/nav shell under another primary host
    // (Global Header ← Header Navigation). Non-primary hosts may still fill
    // a primary nav child (e.g. main-menu ← header-navigation).
    if (parentIsPrimary && isPrimaryHeaderNavChromeKey(key)) return false;
    return true;
  });

  const covered = new Set(
    children
      .map((c) => String(c.placeholder || '').trim())
      .filter(Boolean),
  );

  for (const ph of hostKeys) {
    if (covered.has(ph)) continue;
    /** @type {object|undefined} */
    let match = candidates.find((c) => {
      const inferred =
        inferPlanChildPlaceholderKey({
          definitionKey: c.definitionKey,
          componentName: c.componentName || c.definitionKey,
          placeholder: c.placeholder,
        }) || undefined;
      const aligned = alignChildPlaceholderToParent(inferred, hostKeys);
      return aligned === ph;
    });
    if (!match) {
      match = candidates.find((c) => {
        const key = String(c.definitionKey || '');
        const short = key.includes('-') ? key.split('-').slice(1).join('-') : key;
        return (
          key === ph ||
          short === ph ||
          key.endsWith(`-${ph}`) ||
          ph.endsWith(short)
        );
      });
    }
    if (!match?.definitionKey) continue;
    const seedNames = Array.isArray(match.contentItemNames)
      ? match.contentItemNames.map((n) => String(n || '').trim()).filter(Boolean)
      : [];
    const explicitDs = String(match.datasourceItem || '').trim();
    if (seedNames.length > 1) {
      // Multi-seed package: one child per seed (never stamp only seeds[0]).
      for (const seed of seedNames) {
        children.push({
          definitionKey: match.definitionKey,
          placeholder: ph,
          datasourceItem: seed,
        });
      }
    } else {
      const ds =
        explicitDs ||
        (seedNames.length === 1 ? seedNames[0] : '') ||
        '';
      children.push({
        definitionKey: match.definitionKey,
        placeholder: ph,
        ...(ds ? { datasourceItem: ds } : {}),
      });
    }
    covered.add(ph);
  }

  // Only when host keys are unknown and children empty — place candidates under
  // inferred PH. If the host already declares slots and nothing matched, leave
  // children empty (do NOT dump the whole Navigation candidate pool).
  if (!hostKeys.length && !children.length && candidates.length) {
    for (const c of candidates) {
      const ph =
        inferPlanChildPlaceholderKey({
          definitionKey: c.definitionKey,
          componentName: c.componentName || c.definitionKey,
          placeholder: c.placeholder,
        }) || undefined;
      const seedNames = Array.isArray(c.contentItemNames)
        ? c.contentItemNames.map((n) => String(n || '').trim()).filter(Boolean)
        : [];
      const explicitDs = String(c.datasourceItem || '').trim();
      if (seedNames.length > 1) {
        for (const seed of seedNames) {
          children.push({
            definitionKey: c.definitionKey,
            ...(ph ? { placeholder: ph } : {}),
            datasourceItem: seed,
          });
        }
      } else {
        const ds =
          explicitDs ||
          (seedNames.length === 1 ? seedNames[0] : '') ||
          '';
        children.push({
          definitionKey: c.definitionKey,
          ...(ph ? { placeholder: ph } : {}),
          ...(ds ? { datasourceItem: ds } : {}),
        });
      }
    }
  }

  return omitPartialPlaceholderKeys({
    ...partial,
    children: dedupePartialChildrenBySeed(children),
  });
}

/**
 * Once-per-run invariant for chrome partial hosts.
 * Empty children are allowed (leaf chrome band / no nestable packages for slots).
 * Any nested child must have a placeholder (and match host keys when stamped).
 * @param {object[]} partials
 * @param {{
 *   canHostMap?: Map<string, boolean>|Record<string, boolean>|null,
 *   requireChildrenWhenHost?: boolean,
 *   candidateKeys?: string[],
 * }} [opts]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function assertPartialDesignsCorrect(partials, opts = {}) {
  const canHostMap = opts.canHostMap || null;
  // Kept for API compat — empty host children are valid (no Navigation dump-all).
  void opts.requireChildrenWhenHost;
  void opts.candidateKeys;
  /** @type {string[]} */
  const errors = [];

  for (const partial of partials || []) {
    const sig = String(partial?.signature || '').toLowerCase();
    if (!sig || sig === 'cookie') continue;
    const host = entryCanHostChildren(partial, canHostMap);
    if (!host) continue;
    const kids = Array.isArray(partial.children) ? partial.children : [];
    const hostKeys = Array.isArray(partial.placeholderKeys)
      ? partial.placeholderKeys
      : [];

    const dsSeen = new Map();
    for (const c of kids) {
      if (!c?.definitionKey) {
        errors.push(`partial "${sig}": child missing definitionKey`);
        continue;
      }
      const ph = String(c.placeholder || '').trim();
      if (!ph) {
        errors.push(
          `partial "${sig}": child "${c.definitionKey}" missing placeholder`,
        );
        continue;
      }
      if (hostKeys.length && !hostKeys.includes(ph)) {
        errors.push(
          `partial "${sig}": child "${c.definitionKey}" placeholder "${ph}" ` +
            `not in host keys [${hostKeys.join(', ')}]`,
        );
      }
      const ds = String(c.datasourceItem || '').trim();
      if (ds) {
        const soft = `${c.definitionKey}::${c.placeholder || ''}::${ds}`;
        dsSeen.set(soft, (dsSeen.get(soft) || 0) + 1);
      }
      // Missing datasourceItem is aligned later / warned by coverage helpers —
      // empty children is the hard failure for host partials.
    }
    for (const [soft, n] of dsSeen) {
      if (n > 1) {
        errors.push(
          `partial "${sig}": duplicate child seed ${soft} ×${n}`,
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Drop availableRenderings keys whose component definition is not on disk.
 * @param {Record<string, string[]>} availableRenderings
 * @param {string} hostSlug
 * @returns {Promise<Record<string, string[]>>}
 */
export async function pruneAvailableRenderingsMissingDefinitions(
  availableRenderings,
  hostSlug,
) {
  const host = String(hostSlug || '').trim();
  if (!availableRenderings || typeof availableRenderings !== 'object' || !host) {
    return availableRenderings || {};
  }
  /** @type {Map<string, boolean>} */
  const existsCache = new Map();
  async function keyExists(definitionKey) {
    const key = String(definitionKey || '').trim();
    if (!key) return false;
    if (existsCache.has(key)) return Boolean(existsCache.get(key));
    const defPath = await resolveDefinitionTsPath(key, host);
    const ok = Boolean(defPath);
    existsCache.set(key, ok);
    return ok;
  }
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [group, keys] of Object.entries(availableRenderings)) {
    if (!Array.isArray(keys)) continue;
    const kept = [];
    for (const key of keys) {
      if (await keyExists(key)) kept.push(key);
    }
    out[group] = kept;
  }
  return out;
}

/**
 * @param {object[]} existing
 * @param {object[]} incoming
 * @param {{ replaceChrome?: boolean, canHostMap?: Map<string, boolean>|Record<string, boolean>|null }} [opts]
 *   replaceChrome=false (secondary pages): only fill missing signatures.
 *   replaceChrome=true (home): allow structural chrome merge.
 */
function mergeSiblingsBefore(prevList, nextList) {
  return mergeSiblingsBeforeList(prevList, nextList);
}

/**
 * Footer chrome merge — same host-capability rules as header (no name chromeScore).
 * @param {object} prev
 * @param {object} next
 * @param {{ canHostMap?: Map<string, boolean>|Record<string, boolean>|null }} [opts]
 */
export function mergeFooterPartialEntries(prev, next, opts = {}) {
  const canHostMap = opts.canHostMap || null;
  const prevHost = entryCanHostChildren(prev, canHostMap);
  const nextHost = entryCanHostChildren(next, canHostMap);

  let preferNext;
  if (prevHost !== nextHost) {
    preferNext = nextHost;
  } else if (
    prevHost &&
    nextHost &&
    isPreferredFooterParent(next.definitionKey) &&
    !isPreferredFooterParent(prev.definitionKey)
  ) {
    // Soft tie-break among equal hosts only (site/global footer naming).
    preferNext = true;
  } else if (
    prevHost &&
    nextHost &&
    isPreferredFooterParent(prev.definitionKey) &&
    !isPreferredFooterParent(next.definitionKey)
  ) {
    preferNext = false;
  } else {
    preferNext = preferLaterSectionIndex(prev, next);
  }

  const winner = preferNext ? next : prev;
  const loser = preferNext ? prev : next;
  const winnerHost = entryCanHostChildren(winner, canHostMap);
  const loserHost = entryCanHostChildren(loser, canHostMap);

  let siblingsBefore = mergeSiblingsBeforeList(
    winner.siblingsBefore,
    loser.siblingsBefore,
  );
  /** @type {object[]} */
  let children = [];

  const winnerKey = String(winner?.definitionKey || '');
  const loserKey = String(loser?.definitionKey || '');
  const sameShell = Boolean(winnerKey) && winnerKey === loserKey;
  const preferredShellMerge =
    isPreferredFooterParent(winnerKey) || isPreferredFooterParent(loserKey);

  if (winnerHost && loserHost) {
    if (sameShell || preferredShellMerge) {
      // Multi-page --all / preferred site|global footer shell: union children;
      // never demote a preferred shell into siblingsBefore.
      children = mergePartialChildren(loser.children, winner.children);
    } else {
      // Distinct peer footer bands (e.g. support-nav then info-links): keep each
      // shell's own children; earlier host → siblingsBefore (document order).
      children = Array.isArray(winner.children) ? [...winner.children] : [];
      siblingsBefore = mergeSiblingsBeforeList(siblingsBefore, [
        headerSiblingRef(loser),
      ]);
    }
  } else if (winnerHost) {
    children = mergePartialChildren(loser.children, winner.children);
  } else {
    children = [];
    if (loserHost) {
      siblingsBefore = mergeSiblingsBeforeList(siblingsBefore, [
        headerSiblingRef(loser),
      ]);
    }
  }

  siblingsBefore = pruneHeaderSiblingsBefore(
    siblingsBefore,
    { definitionKey: winner.definitionKey, children },
    { dropPreferredFooterHosts: true },
  );

  const winnerIndex = parseSectionIndex(winner.sectionIndex);
  return omitPartialPlaceholderKeys({
    ...winner,
    ...(winnerIndex !== undefined ? { sectionIndex: winnerIndex } : {}),
    canHostChildren: winnerHost,
    children,
    ...(siblingsBefore.length ? { siblingsBefore } : {}),
  });
}

/**
 * Merge existing + incoming partial designs (chrome once on home; union on secondary).
 * @param {object[]} existing
 * @param {object[]} incoming
 * @param {{ replaceChrome?: boolean, canHostMap?: Map<string, boolean>|Record<string, boolean>|null }} [opts]
 * @returns {object[]}
 */
export function mergePartials(existing, incoming, opts = {}) {
  const replaceChrome = opts.replaceChrome !== false;
  const canHostMap = opts.canHostMap || null;
  const bySig = new Map();
  for (const p of existing || []) {
    if (p?.signature) bySig.set(p.signature, p);
  }
  for (const p of incoming || []) {
    if (!p?.signature) continue;
    const prev = bySig.get(p.signature);
    if (!prev) {
      bySig.set(p.signature, p);
      continue;
    }
    if (!replaceChrome) {
      // Secondary pages: never replace chrome parent. Union children only onto a host.
      if (p.signature === 'footer' || p.signature === 'header') {
        const host = entryCanHostChildren(prev, canHostMap)
          ? prev
          : entryCanHostChildren(p, canHostMap)
            ? p
            : null;
        if (!host) {
          bySig.set(p.signature, {
            ...prev,
            children: [],
            siblingsBefore: mergeSiblingsBefore(
              prev.siblingsBefore,
              p.siblingsBefore,
            ),
          });
        } else {
          bySig.set(p.signature, {
            ...host,
            canHostChildren: true,
            children: mergePartialChildren(prev.children, p.children),
            siblingsBefore: mergeSiblingsBefore(
              prev.siblingsBefore,
              p.siblingsBefore,
            ),
          });
        }
      }
      continue;
    }
    // Cookie partial retired — drop legacy cookie signatures.
    if (p.signature === 'cookie') {
      continue;
    }
    if (p.signature === 'header') {
      bySig.set(
        p.signature,
        mergeHeaderPartialEntries(prev, p, { canHostMap }),
      );
      continue;
    }
    if (p.signature === 'footer') {
      bySig.set(
        p.signature,
        mergeFooterPartialEntries(prev, p, { canHostMap }),
      );
      continue;
    }
    bySig.set(p.signature, p);
  }
  // Stable order: header, footer, then others (cookie partial removed)
  const order = ['header', 'footer'];
  const rest = [...bySig.keys()].filter((k) => !order.includes(k) && k !== 'cookie');
  return [...order, ...rest].map((k) => bySig.get(k)).filter(Boolean);
}

async function loadExistingPresentation(file) {
  try {
    const src = await readFile(file, 'utf8');
    const exportIdx = src.search(/export const \w+\s*=/);
    if (exportIdx < 0) return null;
    const eq = src.indexOf('=', exportIdx);
    const open = src.indexOf('{', eq);
    if (open < 0) return null;
    let depth = 0;
    let end = -1;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) return null;
    const literal = src.slice(open, end + 1).replace(/\s+as const\b/g, '');
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${literal});`)();
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   siteSystem: string,
 *   collectionSystem: string,
 *   components: Array<{ definitionKey: string, role: string, availableGroup?: string }>,
 *   homeRenderings: Array<{
 *     definitionKey: string,
 *     placeholder: string,
 *     renderingIdentifier?: string,
 *     children?: Array<{ definitionKey: string, datasourceItem?: string, variant?: string, renderingIdentifier?: string }>,
 *   }>,
 *   partials: Array<{
 *     signature: string,
 *     placeholder: string,
 *     definitionKey: string,
 *     renderingIdentifier?: string,
 *     children?: Array<{ definitionKey: string, datasourceItem?: string, variant?: string, renderingIdentifier?: string }>,
 *   }>,
 *   cultures?: string[],
 *   pageKey?: string,
 *   routePath?: string,
 *   navigationTitle?: string,
 *   isHome?: boolean,
 *   hostSlug?: string,
 *   dryRun?: boolean,
 * }} opts
 */
export async function writeSitePresentationDefinition(opts) {
  const {
    siteSystem,
    collectionSystem,
    components,
    homeRenderings,
    partials,
    cultures = [],
    pageKey: pageKeyOpt,
    routePath: routePathOpt,
    navigationTitle,
    isHome: isHomeOpt,
    dryRun = false,
  } = opts;

  const definitionKey = `${siteSystem}-presentation`;
  const exportName = `${siteSystem.replace(/[^a-zA-Z0-9]/g, '')}Presentation`;
  const hostFolder = hostToHostSlugFolder(
    opts.hostSlug || siteSystem,
  );
  const { path: resolvedExisting, legacy: presentationIsLegacy } =
    await resolvePresentationDefinitionPath(hostFolder, siteSystem);
  const file = presentationDefinitionPath(hostFolder, siteSystem);

  const byGroup = {
    'Page Content': [],
    Navigation: [],
    'Page Structure': [],
  };
  for (const c of components) {
    const g = c.availableGroup || (c.role?.startsWith('partial') ? 'Navigation' : 'Page Content');
    if (!byGroup[g]) byGroup[g] = [];
    if (!byGroup[g].includes(c.definitionKey)) byGroup[g].push(c.definitionKey);
  }

  // Nested footer/header children must be available as renderings too.
  for (const partial of partials || []) {
    for (const child of partial.children || []) {
      const key = child.definitionKey;
      if (!key) continue;
      if (!byGroup.Navigation.includes(key)) byGroup.Navigation.push(key);
    }
  }

  const isHome = isHomeOpt !== undefined ? Boolean(isHomeOpt) : !pageKeyOpt || pageKeyOpt === 'home';
  const pageKey = isHome ? 'home' : String(pageKeyOpt || 'page');
  const routePath = isHome
    ? '/'
    : String(routePathOpt || `/${pageKey}`).replace(/\/+$/, '') || `/${pageKey}`;

  const existing = await loadExistingPresentation(resolvedExisting);
  let availableRenderings = mergeAvailableRenderings(
    existing?.availableRenderings,
    byGroup,
  );
  const canHostMap = await buildHostCapabilityMap(hostFolder, [
    ...(existing?.partialDesigns || []),
    ...(partials || []),
  ]);
  let mergedPartials = mergePartials(existing?.partialDesigns, partials, {
    // Secondary pages must not steal site chrome from the homepage capture.
    replaceChrome: isHome,
    canHostMap,
  });
  mergedPartials = await relocatePartialChildrenToMountedHosts(
    mergedPartials,
    hostFolder,
  );
  mergedPartials = sanitizePartialNesting(mergedPartials, canHostMap);
  mergedPartials = restampPartialHostFlags(mergedPartials, canHostMap);

  // Chrome-owner only: nest/fill host partial children once (not per body page).
  if (isHome) {
    const navCandidates = await Promise.all(
      (byGroup.Navigation || []).map(async (definitionKey) => {
        const defPath = await resolveDefinitionTsPath(definitionKey, hostFolder);
        /** @type {string[]} */
        let contentItemNames = [];
        if (defPath) {
          try {
            contentItemNames = extractContentItemNames(
              await readFile(defPath, 'utf8'),
            );
          } catch {
            contentItemNames = [];
          }
        }
        return {
          definitionKey,
          role: 'child',
          contentItemNames,
          // Sole seed only — multi-seed packages expand in
          // ensureHostPartialChildrenFromCandidates (one child per name).
          ...(contentItemNames.length === 1
            ? { datasourceItem: contentItemNames[0] }
            : {}),
        };
      }),
    );
    // Keys already nested under the opposite chrome partial must not refill this one.
    /** @type {Map<string, Set<string>>} */
    const nestedBySig = new Map();
    for (const p of mergedPartials) {
      const s = String(p?.signature || '').toLowerCase();
      if (s !== 'header' && s !== 'footer') continue;
      nestedBySig.set(s, collectNestedDefinitionKeys(p));
    }

    mergedPartials = await Promise.all(
      mergedPartials.map(async (partial) => {
        const sig = String(partial?.signature || '').toLowerCase();
        if (sig !== 'header' && sig !== 'footer') return partial;
        if (!entryCanHostChildren(partial, canHostMap)) return partial;

        let hostKeys = Array.isArray(partial.placeholderKeys)
          ? [...partial.placeholderKeys]
          : [];
        if (!hostKeys.length) {
          const defPath = await resolveDefinitionTsPath(
            partial.definitionKey,
            hostFolder,
          );
          if (defPath) {
            try {
              hostKeys = extractPlaceholderKeysFromDefinition(
                await readFile(defPath, 'utf8'),
              );
            } catch {
              hostKeys = [];
            }
          }
        }

        let next = absorbSiblingChildrenIntoHost(
          {
            ...partial,
            canHostChildren: true,
            ...(hostKeys.length ? { placeholderKeys: hostKeys } : {}),
          },
          { hostPlaceholderKeys: hostKeys },
        );

        // Exclude other chrome hosts + packages already nested on the other partial.
        const hostRoots = new Set(
          mergedPartials
            .filter((p) => entryCanHostChildren(p, canHostMap))
            .map((p) => String(p.definitionKey || '')),
        );
        const otherSig = sig === 'header' ? 'footer' : 'header';
        const claimedElsewhere = nestedBySig.get(otherSig) || new Set();
        const candidates = navCandidates.filter((c) => {
          const key = String(c.definitionKey || '').trim();
          if (!key || hostRoots.has(key) || claimedElsewhere.has(key)) {
            return false;
          }
          if (!hostKeys.length) return true;
          const inferred =
            inferPlanChildPlaceholderKey({
              definitionKey: key,
              componentName: c.componentName || key,
              placeholder: c.placeholder,
            }) || undefined;
          const aligned = alignChildPlaceholderToParent(inferred, hostKeys);
          if (aligned && hostKeys.includes(aligned)) return true;
          const short = key.includes('-') ? key.split('-').slice(1).join('-') : key;
          return hostKeys.some(
            (ph) =>
              key === ph ||
              short === ph ||
              key.endsWith(`-${ph}`) ||
              ph.endsWith(short),
          );
        });
        next = ensureHostPartialChildrenFromCandidates(next, {
          candidates,
          hostPlaceholderKeys: hostKeys,
        });
        let kids = (next.children || []).map((c) => {
          if (!hostKeys.length) return c;
          const forced = forceChildPlaceholderAgainstHost({
            placeholder: c.placeholder,
            definitionKey: c.definitionKey,
            componentName: c.definitionKey,
            hostKeys,
          });
          return forced ? { ...c, placeholder: forced } : { ...c, placeholder: '' };
        });
        // Never persist placeholder-less / foreign-PH kids under a host that declares slots.
        if (hostKeys.length) {
          const before = kids.length;
          kids = kids.filter((c) => String(c.placeholder || '').trim());
          if (kids.length < before) {
            console.warn(
              `  ⚠ Presentation: dropped ${before - kids.length} nested rendering(s) under "${partial.definitionKey}" missing host placeholder`,
            );
          }
        }
        kids = dedupePartialChildrenBySeed(kids);
        if (sig === 'footer') {
          kids = preferSingleChildFamily(kids);
        }
        const { nodes: enforcedKids } = enforceNestedPlaceholders(kids, {
          parentPlaceholderKeys: hostKeys,
          logPrefix: `partial "${sig}"`,
        });

        // Nestable siblingsBefore hosts: same candidate fill (exclude root-claimed
        // children) so demoted peer chrome shells are not left empty.
        const rootClaimed = new Set(
          enforcedKids
            .map((c) => String(c?.definitionKey || '').trim())
            .filter(Boolean),
        );
        const rawSiblings = Array.isArray(next.siblingsBefore)
          ? next.siblingsBefore
          : [];
        const nextSiblings = [];
        for (const sib of rawSiblings) {
          if (!sib?.definitionKey) continue;
          if (!entryCanHostChildren(sib, canHostMap)) {
            nextSiblings.push(headerSiblingRef(sib));
            continue;
          }
          let sibKeys = Array.isArray(sib.placeholderKeys)
            ? [...sib.placeholderKeys]
            : [];
          if (!sibKeys.length) {
            const sibDefPath = await resolveDefinitionTsPath(
              sib.definitionKey,
              hostFolder,
            );
            if (sibDefPath) {
              try {
                sibKeys = extractPlaceholderKeysFromDefinition(
                  await readFile(sibDefPath, 'utf8'),
                );
              } catch {
                sibKeys = [];
              }
            }
          }
          const sibCandidates = candidates.filter((c) => {
            const key = String(c?.definitionKey || '').trim();
            if (!key || rootClaimed.has(key) || hostRoots.has(key)) return false;
            if (key === String(sib.definitionKey || '')) return false;
            return true;
          });
          let filledSib = ensureHostPartialChildrenFromCandidates(
            {
              ...sib,
              canHostChildren: true,
              ...(sibKeys.length ? { placeholderKeys: sibKeys } : {}),
            },
            {
              candidates: sibCandidates,
              hostPlaceholderKeys: sibKeys,
            },
          );
          let sibKids = (filledSib.children || []).map((c) => {
            if (!sibKeys.length) return c;
            const forced = forceChildPlaceholderAgainstHost({
              placeholder: c.placeholder,
              definitionKey: c.definitionKey,
              componentName: c.definitionKey,
              hostKeys: sibKeys,
            });
            return forced
              ? { ...c, placeholder: forced }
              : { ...c, placeholder: '' };
          });
          if (sibKeys.length) {
            sibKids = sibKids.filter((c) => String(c.placeholder || '').trim());
          }
          sibKids = dedupePartialChildrenBySeed(sibKids);
          if (sig === 'footer') {
            sibKids = preferSingleChildFamily(sibKids);
          }
          const { nodes: enforcedSibKids } = enforceNestedPlaceholders(sibKids, {
            parentPlaceholderKeys: sibKeys,
            logPrefix: `partial "${sig}" sibling "${sib.definitionKey}"`,
          });
          nextSiblings.push(
            headerSiblingRef({
              ...filledSib,
              children: enforcedSibKids,
            }),
          );
        }

        return omitPartialPlaceholderKeys({
          ...next,
          children: enforcedKids,
          ...(nextSiblings.length ? { siblingsBefore: nextSiblings } : {}),
        });
      }),
    );
    mergedPartials = restampPartialHostFlags(mergedPartials, canHostMap);
  }

  availableRenderings = await pruneAvailableRenderingsMissingDefinitions(
    availableRenderings,
    hostFolder,
  );

  const partialDesignKeys = collectPartialDesignDefinitionKeys(mergedPartials);
  let pageRenderings = filterPageRenderings(homeRenderings, {
    partialKeys: partialDesignKeys,
  }).map((r) => ({
    ...r,
    ...(r.children
      ? { children: filterSelfNestedChildren(r.definitionKey, r.children) }
      : {}),
  }));

  // Align datasourceItem to component content seed names (page + nested children).
  pageRenderings = await alignRenderingsDatasourceItems(
    pageRenderings,
    hostFolder,
  );

  // Prefer one competing child family per slot on all merged partials/composites.
  for (const partial of mergedPartials || []) {
    if (partial?.children?.length) {
      partial.children = filterSelfNestedChildren(
        partial.definitionKey,
        partial.children,
      );
      partial.children = preferSingleChildFamily(partial.children);
    }
  }
  mergedPartials = await alignPartialsDatasourceItems(mergedPartials, hostFolder);

  // Every nested child at any depth (pages + partials + siblingsBefore) needs placeholder.
  // Sibling hosts use current definition placeholders[] (force stale capture-meta PH off).
  {
    const enforced = await enforcePresentationNestedPlaceholders({
      renderings: pageRenderings,
      partials: mergedPartials,
      hostSlug: hostFolder,
    });
    pageRenderings = enforced.renderings;
    mergedPartials = enforced.partials;
  }

  if (isHome) {
    const hostKeys = new Set(
      mergedPartials
        .filter((p) => entryCanHostChildren(p, canHostMap))
        .map((p) => String(p.definitionKey || '')),
    );
    const gate = assertPartialDesignsCorrect(mergedPartials, {
      canHostMap,
      candidateKeys: (byGroup.Navigation || []).filter((k) => !hostKeys.has(k)),
    });
    if (!gate.ok) {
      for (const err of gate.errors) {
        console.error(`  ✗ partial invariant: ${err}`);
      }
      throw new Error(
        `[bq:create:sectioncomponents] partial designs incorrect (${gate.errors.length} error(s)) — ` +
          `header/footer nested children must carry host-aligned placeholders (empty host children are allowed)`,
      );
    }
  }

  // Shared Dom Security news wiring targets page defs now (no-op on empty map).
  const pagesForNews = {
    [isHome ? 'home' : pageKey]: {
      routePath,
      ...(navigationTitle ? { navigationTitle } : {}),
      renderings: pageRenderings,
    },
  };
  await applySharedNewsWiring(pagesForNews);
  const wiredRenderings =
    pagesForNews[isHome ? 'home' : pageKey]?.renderings || pageRenderings;

  const culturesLiteral =
    Array.isArray(cultures) && cultures.length
      ? `\n  cultures: ${JSON.stringify(cultures)},`
      : existing?.cultures?.length
        ? `\n  cultures: ${JSON.stringify(existing.cultures)},`
        : '';

  // Never persist placeholderKeys on partialDesigns (not in SitePresentationDefinition;
  // host slots live on the component def's placeholders[]). Migrate thumbnailCaptureRel → thumbnail.
  const partialsForDisk = (mergedPartials || []).map((p) =>
    normalizePartialThumbnailForDisk(omitPartialPlaceholderKeys(p)),
  );

  // Page bodies live under pages/*.definition.ts — clear stale presentation.pages.
  const body = `import type { SitePresentationDefinition } from "../../../tools/definitions/types";

/**
 * Presentation wiring for site "${siteSystem}" (create:sectioncomponents).
 * Available renderings + partial designs only — page layouts are kind: "page" under pages/.
 * Emitted by definitions:generate — do not hand-edit YAML.
 */
export const ${exportName} = {
  kind: "site-presentation",
  definitionKey: "${definitionKey}",
  siteSystem: "${siteSystem}",
  collectionSystem: "${collectionSystem}",${culturesLiteral}
  availableRenderings: ${JSON.stringify(availableRenderings, null, 2)},
  partialDesigns: ${JSON.stringify(partialsForDisk, null, 2)},
} satisfies SitePresentationDefinition;
`;

  let pageFile = null;
  if (!dryRun) {
    await mkdir(hostComponentsDir(hostFolder), { recursive: true });
    await writeFileIfChanged(file, body);
    if (presentationIsLegacy) {
      const legacy = legacyPresentationDefinitionPath(siteSystem);
      if (
        path.resolve(legacy) !== path.resolve(file) &&
        (await pathExists(legacy))
      ) {
        await unlink(legacy).catch(() => {});
        console.log(
          `  - removed legacy presentation definition: ${path.relative(bqRoot, legacy)}`,
        );
      }
    }
    const pageOut = await writePageDefinition({
      siteSystem,
      collectionSystem,
      hostSlug: hostFolder,
      routePath,
      name: navigationTitle || pageKey,
      navigationTitle: navigationTitle || pageKey,
      culture: cultures?.[0] || undefined,
      cultures,
      renderings: wiredRenderings,
      dryRun: false,
    });
    pageFile = pageOut.file;
    console.log(
      `  + page ${path.relative(bqRoot, pageOut.file)} (${wiredRenderings.length} rendering(s))`,
    );
  }

  return {
    file,
    definitionKey,
    pageKey,
    routePath,
    isHome,
    pageFile,
    partials: partialsForDisk,
    renderings: wiredRenderings,
  };
}

/**
 * @param {string} hostFolder
 * @param {string} definitionKey
 * @returns {Promise<string[]>}
 */
async function loadSeedNamesForDefinitionKey(hostFolder, definitionKey) {
  const key = String(definitionKey || '').trim();
  if (!key) return [];
  const hostRoot = hostComponentsDir(hostFolder);
  const pascal = toPascalCase(key.replace(/^[^a-z]+/i, '') || key);
  const candidates = [
    path.join(hostRoot, pascal, `${key}.definition.ts`),
    path.join(hostRoot, toPascalCase(key), `${key}.definition.ts`),
  ];
  try {
    const entries = await readdir(hostRoot, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      candidates.push(path.join(hostRoot, e.name, `${key}.definition.ts`));
    }
  } catch {
    /* ignore */
  }
  for (const p of candidates) {
    try {
      const src = await readFile(p, 'utf8');
      return extractContentItemNames(src);
    } catch {
      /* try next */
    }
  }
  return [];
}

/**
 * Rebuild nested children from current definition content.items (first-run
 * bind semantics). One child per seed in definition order; preserves
 * placeholder / variant / renderingIdentifier when a prior child matched.
 * @param {object[]} children
 * @param {string} hostFolder
 * @returns {Promise<object[]>}
 */
export async function rebindChildrenFromContentSeeds(children, hostFolder) {
  const list = Array.isArray(children) ? children : [];
  if (!list.length) return [];

  /** @type {Map<string, string[]>} */
  const seedsByKey = new Map();
  /** @type {Map<string, Set<string>>} */
  const usedByKey = new Map();
  /** @type {Map<string, object>} */
  const templateByKey = new Map();

  const seedsFor = async (defKey) => {
    const k = String(defKey || '');
    if (!seedsByKey.has(k)) {
      seedsByKey.set(k, await loadSeedNamesForDefinitionKey(hostFolder, defKey));
    }
    return seedsByKey.get(k) || [];
  };

  /** @type {object[]} */
  const out = [];
  // Walk sketch/presentation order so interleaved peers (Split / Health / Split)
  // stay interleaved — do not clump all same-key seeds at first occurrence.
  for (const c of list) {
    const defKey = c?.definitionKey;
    const key = String(defKey || '');
    if (!templateByKey.has(key)) templateByKey.set(key, { ...c });
    const seeds = await seedsFor(defKey);
    if (!seeds.length) {
      const next = { ...c };
      delete next.datasourceItem;
      if (next.children?.length) {
        next.children = await rebindChildrenFromContentSeeds(
          next.children,
          hostFolder,
        );
      }
      out.push(next);
      continue;
    }
    if (!usedByKey.has(key)) usedByKey.set(key, new Set());
    const used = usedByKey.get(key);
    const want = String(c?.datasourceItem || '').trim();
    let seed =
      (want &&
        seeds.find(
          (s) =>
            !used.has(s) &&
            (s === want || datasourceNamesMatchLoose(want, s)),
        )) ||
      null;
    if (!seed) {
      seed = seeds.find((s) => !used.has(s)) || null;
    }
    if (!seed) {
      // No matching/unused seed for this sketch peer — drop
      continue;
    }
    used.add(seed);
    const next = { ...c, definitionKey: defKey, datasourceItem: seed };
    if (next.children?.length) {
      next.children = await rebindChildrenFromContentSeeds(
        next.children,
        hostFolder,
      );
    }
    out.push(next);
  }

  // Append unused seeds not listed in the sketch (after ordered peers).
  for (const [key, seeds] of seedsByKey) {
    const used = usedByKey.get(key) || new Set();
    const template = templateByKey.get(key);
    if (!template) continue;
    for (const seed of seeds) {
      if (used.has(seed)) continue;
      used.add(seed);
      const next = {
        ...template,
        definitionKey: template.definitionKey,
        datasourceItem: seed,
      };
      if (next.children?.length) {
        next.children = await rebindChildrenFromContentSeeds(
          next.children,
          hostFolder,
        );
      }
      out.push(next);
    }
  }
  return out;
}

/**
 * @param {object[]} renderings
 * @param {string} hostFolder
 */
export async function alignRenderingsDatasourceItems(renderings, hostFolder) {
  const out = [];
  for (const r of renderings || []) {
    const seeds = await loadSeedNamesForDefinitionKey(hostFolder, r.definitionKey);
    const ds = soleSeedDatasourceName(seeds);
    const next = { ...r };
    if (ds) next.datasourceItem = ds;
    else delete next.datasourceItem;
    if (next.children?.length) {
      next.children = await alignChildDatasourceItems(next.children, hostFolder);
    }
    out.push(next);
  }
  return out;
}

/**
 * @param {object[]} children
 * @param {string} hostFolder
 */
export async function alignChildDatasourceItems(children, hostFolder) {
  return rebindChildrenFromContentSeeds(children, hostFolder);
}

/**
 * Ensure partial hosts + children have datasourceItem from content seeds.
 * @param {object[]} partials
 * @param {string} hostFolder
 */
export async function alignPartialsDatasourceItems(partials, hostFolder) {
  const out = [];
  for (const p of partials || []) {
    const next = { ...p };
    const hostSeeds = await loadSeedNamesForDefinitionKey(
      hostFolder,
      next.definitionKey,
    );
    const hostDs = soleSeedDatasourceName(hostSeeds);
    if (hostDs) next.datasourceItem = hostDs;
    else delete next.datasourceItem;

    if (next.siblingsBefore?.length) {
      next.siblingsBefore = await alignChildDatasourceItems(
        next.siblingsBefore,
        hostFolder,
      );
    }
    if (next.children?.length) {
      next.children = preferSingleChildFamily(
        await alignChildDatasourceItems(next.children, hostFolder),
      );
      next.children = dedupePartialChildrenBySeed(
        (next.children || []).filter(
          (c) =>
            Boolean(String(c?.datasourceItem || '').trim()) &&
            !isHashedOrphanDatasourceLabel(c?.datasourceItem),
        ),
      );
    }
    out.push(next);
  }
  return out;
}
