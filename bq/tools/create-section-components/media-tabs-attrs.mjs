/**
 * Media-tabs part-bag attribute vocabularies.
 * Preferred (new emit): data-media-tab-*
 * Accepted (legacy): data-story-*
 * Tooling and parent chrome must dual-read forever.
 */

/** @typedef {'item'|'title'|'panel'|'logo'|'tab'|'desktopNav'|'logoNav'} MediaTabsPart */

/** Preferred attribute names for new codegen. */
export const MEDIA_TABS_PREFERRED = Object.freeze({
  item: 'data-media-tab-item',
  title: 'data-media-tab-title',
  panel: 'data-media-tab-panel',
  logo: 'data-media-tab-logo',
  tab: 'data-media-tab-tab',
  desktopNav: 'data-media-tab-desktop-nav',
  logoNav: 'data-media-tab-logo-nav',
});

/** Legacy attribute names still accepted on disk. */
export const MEDIA_TABS_LEGACY = Object.freeze({
  item: 'data-story-item',
  title: 'data-story-title',
  panel: 'data-story-panel',
  logo: 'data-story-logo',
  tab: 'data-story-tab',
  desktopNav: 'data-story-desktop-navigation',
  logoNav: 'data-story-logo-navigation',
});

/**
 * CSS selector matching preferred OR legacy for a part.
 * @param {MediaTabsPart} part
 * @returns {string}
 */
export function mediaTabsSelector(part) {
  const pref = MEDIA_TABS_PREFERRED[part];
  const leg = MEDIA_TABS_LEGACY[part];
  if (!pref || !leg) return '';
  return `[${pref}],[${leg}]`;
}

/**
 * Regex matching either attr name as a word boundary token (JSX attrs).
 * @param {MediaTabsPart} part
 * @returns {RegExp}
 */
export function mediaTabsAttrRe(part) {
  const pref = MEDIA_TABS_PREFERRED[part];
  const leg = MEDIA_TABS_LEGACY[part];
  return new RegExp(`\\b(?:${escapeRe(pref)}|${escapeRe(leg)})\\b`, 'i');
}

/**
 * Regex matching either title attr assignment (`data-…-title=`).
 * @returns {RegExp}
 */
export function mediaTabsTitleAssignRe() {
  return new RegExp(
    `\\b(?:${escapeRe(MEDIA_TABS_PREFERRED.title)}|${escapeRe(MEDIA_TABS_LEGACY.title)})\\s*=`,
    'i',
  );
}

/**
 * Regex matching either item attr on an open tag mid-attrs.
 * @returns {RegExp}
 */
export function mediaTabsItemInAttrsRe() {
  return new RegExp(
    `\\b(?:${escapeRe(MEDIA_TABS_PREFERRED.item)}|${escapeRe(MEDIA_TABS_LEGACY.item)})\\b`,
    'i',
  );
}

/**
 * Choose title attr name to write when promoting from buried tab chrome.
 * Preserve legacy family when the item root already uses data-story-item.
 * @param {string} source
 * @returns {string}
 */
export function preferredTitleAttrForSource(source) {
  const src = String(source || '');
  if (new RegExp(`\\b${escapeRe(MEDIA_TABS_LEGACY.item)}\\b`, 'i').test(src)) {
    return MEDIA_TABS_LEGACY.title;
  }
  return MEDIA_TABS_PREFERRED.title;
}

/**
 * Regex matching either item open-tag for title injection.
 * Captures: tag, mid (attrs including item), rest.
 * @returns {RegExp}
 */
export function mediaTabsItemOpenTagRe() {
  const itemAlt = `(?:${escapeRe(MEDIA_TABS_PREFERRED.item)}|${escapeRe(MEDIA_TABS_LEGACY.item)})`;
  return new RegExp(
    `<(article|[A-Za-z][\\w.]*)(\\s[^>]*\\b${itemAlt}\\b)([^>]*)>`,
    'i',
  );
}

/**
 * True when source has buried desktop tab chrome (tab attr + hidden lg/md flex/block).
 * @param {string} source
 * @returns {boolean}
 */
export function hasBuriedMediaTabsTabChrome(source) {
  const src = String(source || '');
  return (
    mediaTabsAttrRe('tab').test(src) &&
    /hidden\s+(?:lg:|md:)?(?:flex|block)/.test(src)
  );
}

/**
 * Prompt / contract one-liner for preferred attrs (+ legacy note).
 * @returns {string}
 */
export function mediaTabsPartBagPromptLine() {
  return (
    `CHILD is a part bag only — prefer ${MEDIA_TABS_PREFERRED.item} + ${MEDIA_TABS_PREFERRED.title} + ` +
    `${MEDIA_TABS_PREFERRED.panel} + ${MEDIA_TABS_PREFERRED.logo} (legacy data-story-* equivalents accepted). ` +
    `Title MUST be a string attr on the item root (${MEDIA_TABS_PREFERRED.title}={string}); logo via img under [${MEDIA_TABS_PREFERRED.logo}] or ${MEDIA_TABS_PREFERRED.logo}-src. ` +
    `Parent chrome mounts {children} exactly once (responsive CSS only — never mobile+desktop duplicate mounts).`
  );
}

/**
 * Count JSX `{children}` expression mounts (not prop types).
 * @param {string} source
 * @returns {number}
 */
export function countJsxChildrenMounts(source) {
  const src = String(source || '');
  const matches = src.match(/\{children\}/g);
  return matches ? matches.length : 0;
}

/**
 * True when client chrome mounts `{children}` more than once (React last-wins → empty rail).
 * @param {string} source
 * @returns {boolean}
 */
export function hasDuplicateChildrenMount(source) {
  return countJsxChildrenMounts(source) > 1;
}

/**
 * True when media-tab item root has a resolvable title attribute assignment.
 * @param {string} source
 * @returns {boolean}
 */
export function hasMediaTabTitleOnItemRoot(source) {
  const src = String(source || '');
  if (!mediaTabsItemInAttrsRe().test(src)) return false;
  return mediaTabsTitleAssignRe().test(src);
}

/**
 * True when logo is an img under logo marker or logo-src attr (not a bare div chrome treats as HTMLImageElement).
 * @param {string} source
 * @returns {boolean}
 */
export function hasResolvableMediaTabLogo(source) {
  const src = String(source || '');
  if (
    new RegExp(
      `\\b(?:${escapeRe(MEDIA_TABS_PREFERRED.logo)}|${escapeRe(MEDIA_TABS_LEGACY.logo)})-src\\s*=`,
      'i',
    ).test(src)
  ) {
    return true;
  }
  // img … data-media-tab-logo OR data-media-tab-logo wrapping <img / NextImage
  if (
    /<img\b[^>]*(?:data-media-tab-logo|data-story-logo)/i.test(src) ||
    /(?:data-media-tab-logo|data-story-logo)[^>]*>[\s\S]{0,200}<(?:img|Image|NextImage)\b/i.test(
      src,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
