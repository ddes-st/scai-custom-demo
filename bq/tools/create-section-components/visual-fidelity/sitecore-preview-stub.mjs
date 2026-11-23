/**
 * Runtime stubs for @sitecore-content-sdk/nextjs used by visual-fidelity preview bundles.
 * Loaded via esbuild alias — keep CommonJS-friendly ESM.
 */
import React from 'react';

function fieldValue(field) {
  if (field == null) return '';
  if (typeof field === 'string' || typeof field === 'number') return field;
  if (typeof field === 'object' && 'value' in field) return field.value;
  return '';
}

export function Text({ field, tag = 'span', className, ...rest }) {
  const Tag = tag || 'span';
  const v = fieldValue(field);
  const text = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  return React.createElement(Tag, { className, ...rest }, text);
}

export function RichText({ field, className, ...rest }) {
  const v = fieldValue(field);
  const html = typeof v === 'string' ? v : String(v ?? '');
  return React.createElement('div', {
    className,
    dangerouslySetInnerHTML: { __html: html },
    ...rest,
  });
}

export function Image({ field, className, alt, ...rest }) {
  const v = fieldValue(field);
  const src = (v && typeof v === 'object' && v.src) || '';
  const a = alt || (v && typeof v === 'object' && v.alt) || '';
  if (!src) return null;
  return React.createElement('img', { src, alt: a, className, ...rest });
}

export function Link({ field, className, children, showLinkTextWithChildrenPresent, ...rest }) {
  const v = fieldValue(field);
  const href = (v && typeof v === 'object' && (v.href || v.url)) || '#';
  const text = (v && typeof v === 'object' && v.text) || '';
  const content =
    children != null
      ? showLinkTextWithChildrenPresent
        ? [children, ' ', text]
        : children
      : text;
  return React.createElement('a', { href, className, ...rest }, content);
}

export function useSitecore() {
  return {
    page: {
      mode: { isEditing: false, name: 'normal' },
      layout: { sitecore: { context: {}, route: { placeholders: {} } } },
    },
  };
}

/** Children registry filled by preview entry before render. */
export const __bqPlaceholderChildren = {
  /** @type {Record<string, React.ReactNode[]>} */
  byBase: {},
};

/**
 * Active placeholder bases for the current React render subtree.
 * Must be Context (not a module stack): createElement returns before children render,
 * so a push/pop around createElement never sees nested AppPlaceholder calls.
 */
const PlaceholderActiveContext = React.createContext(/** @type {ReadonlySet<string>} */ (new Set()));

/**
 * Wrapper class for mock AppPlaceholder when an explicit layout className is set.
 * Empty className → '' (no DOM wrapper — peers join parent flex/grid like real SDK).
 * Do not rely on Tailwind `contents`: preview CSS often never emits that utility.
 *
 * @param {string|undefined|null} className
 * @returns {string}
 */
export function resolvePlaceholderWrapperClassName(className) {
  return String(className || '').trim();
}

/**
 * Mock AppPlaceholder — renders registered children for the placeholder base key.
 * Nested expansion of the same base is skipped (e.g. CrelanProductNavigation inside
 * CrelanHeader both using `navigation-menu-items` would otherwise recurse forever).
 */
/**
 * Normalize AppPlaceholder name to base key.
 * Handles `foo-1`, `foo-{1}`, and bare `foo`.
 * @param {string} name
 */
export function placeholderBaseFromName(name) {
  const raw = String(name || '');
  return (
    raw.replace(/-\{\d+\}$/, '').replace(/-\d+$/, '') || raw
  );
}

function AppPlaceholderInner({ name, className, ...rest }) {
  const active = React.useContext(PlaceholderActiveContext);
  const raw = String(name || '');
  const base = placeholderBaseFromName(raw);
  const dashDyn = base && raw !== base ? `${base}-1` : null;
  const braceDyn = base && raw !== base ? `${base}-{1}` : null;
  const wrapClass = resolvePlaceholderWrapperClassName(className);
  const next = new Set(active);
  next.add(base);
  if (raw !== base) next.add(raw);

  if (active.has(base) || active.has(raw)) {
    if (!wrapClass) {
      return React.createElement(
        PlaceholderActiveContext.Provider,
        { value: next },
        null,
      );
    }
    return React.createElement('div', {
      className: wrapClass,
      'data-bq-placeholder': raw,
      'data-bq-placeholder-nested': '1',
      ...rest,
    });
  }
  const nodes =
    __bqPlaceholderChildren.byBase[raw] ||
    __bqPlaceholderChildren.byBase[base] ||
    (dashDyn ? __bqPlaceholderChildren.byBase[dashDyn] : null) ||
    (braceDyn ? __bqPlaceholderChildren.byBase[braceDyn] : null) ||
    [];

  // Real Content SDK AppPlaceholder returns the component array (no layout wrapper).
  // Empty className → Fragment so parent grid/flex sees peer roots (not one opaque cell).
  if (!wrapClass) {
    return React.createElement(
      PlaceholderActiveContext.Provider,
      { value: next },
      React.createElement(React.Fragment, null, ...nodes),
    );
  }

  return React.createElement(
    PlaceholderActiveContext.Provider,
    { value: next },
    React.createElement(
      'div',
      { className: wrapClass, 'data-bq-placeholder': raw, ...rest },
      ...nodes,
    ),
  );
}

export function AppPlaceholder(props) {
  return React.createElement(AppPlaceholderInner, props);
}

export function Placeholder(props) {
  return AppPlaceholder(props);
}

export const NextImage = Image;

export default {
  Text,
  RichText,
  Image,
  Link,
  useSitecore,
  AppPlaceholder,
  Placeholder,
  NextImage,
};
