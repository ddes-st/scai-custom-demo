/**
 * Shared rules for element CSS paths used in interactive capture.
 * Bare #id is unsafe when the same id appears more than once (e.g. MediaSlider
 * duplicates tab ids across mobile/desktop tablists).
 */

/**
 * @param {string|null|undefined} id
 * @param {number} duplicateCount — document.querySelectorAll(`#${id}`).length
 * @returns {boolean}
 */
export function canUseBareId(id, duplicateCount = 1) {
  if (!id || typeof id !== 'string') return false;
  if (/\d{4,}/.test(id)) return false;
  return Number(duplicateCount) <= 1;
}

/**
 * In-browser unique CSS path (pass to page.evaluate or embed in discover fns).
 * @param {Element} el
 * @returns {string}
 */
export function uniqueElementCssPath(el) {
  if (!(el instanceof Element)) return '';
  const idCount = (id) => {
    try {
      return document.querySelectorAll(`#${CSS.escape(id)}`).length;
    } catch {
      return 99;
    }
  };
  if (el.id && canUseBareId(el.id, idCount(el.id))) {
    return `#${CSS.escape(el.id)}`;
  }
  const parts = [];
  let cur = el;
  for (let i = 0; i < 8 && cur && cur.nodeType === 1 && cur !== document.body; i++) {
    let part = cur.tagName.toLowerCase();
    if (cur.id && canUseBareId(cur.id, idCount(cur.id))) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const cls = [...cur.classList]
      .filter((c) => c && !/^(is-|has-|js-|active|open|selected|current|hover)/i.test(c))
      .slice(0, 2);
    if (cls.length) part += cls.map((c) => `.${CSS.escape(c)}`).join('');
    const parent = cur.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((c) => {
        if (c.tagName !== cur.tagName) return false;
        if (!cls.length) return true;
        return cls.every((cl) => c.classList.contains(cl));
      });
      if (siblings.length > 1) {
        const sameTag = [...parent.children].filter((c) => c.tagName === cur.tagName);
        part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(' > ');
}
