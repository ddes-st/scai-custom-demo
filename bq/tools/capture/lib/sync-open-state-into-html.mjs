/**
 * Sync live interaction open-state (tabs / accordion / details) into a static
 * section HTML clone so narrow breakpoints show the same open panel as desktop
 * when the component keeps dual chrome (e.g. lg:flex tabs + lg:hidden accordion).
 */
import { VIEWPORTS, ensureOverlayScrollbars } from './viewports.mjs';

const INTERACTION_CLASS_RE =
  /(?:^|[\s_-])((?:is-)?(?:active|inactive|selected|open|closed|expanded|collapsed)|max-h-(?:0|\[[^\]]+\])|SlideActive|SlideHidden|AccordionItemActive|AccordionItemInactive|NavButtonActive)(?:$|[\s_-])/i;

/**
 * @param {string} s
 */
export function normalizeLabel(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * In-browser: collect open-state fingerprints under a section root.
 * @param {string} sectionSelector
 * @returns {object}
 */
export function collectOpenStateFingerprintsInBrowser(sectionSelector) {
  // Must be self-contained — Playwright serializes this into the page.
  const INTERACTION_CLASS_RE =
    /(?:^|[\s_-])((?:is-)?(?:active|inactive|selected|open|closed|expanded|collapsed)|max-h-(?:0|\[[^\]]+\])|SlideActive|SlideHidden|AccordionItemActive|AccordionItemInactive|NavButtonActive)(?:$|[\s_-])/i;
  const normalize = (s) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const root = (() => {
    try {
      return document.querySelector(sectionSelector);
    } catch {
      return null;
    }
  })();
  if (!(root instanceof Element)) {
    return { controls: [], panels: [], openLabels: [], closedLabels: [] };
  }

  const idCount = (id) => {
    try {
      return document.querySelectorAll(`#${CSS.escape(id)}`).length;
    } catch {
      return 99;
    }
  };

  const labelOf = (el) =>
    normalize(
      el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el.querySelector('h2,h3,h4,span')?.textContent || '') ||
        el.textContent ||
        '',
    ).slice(0, 120);

  const interactionClasses = (el) =>
    [...el.classList].filter((c) => INTERACTION_CLASS_RE.test(c));

  const isShown = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  };

  const isOpenControl = (el) => {
    if (el.getAttribute('aria-selected') === 'true') return true;
    if (el.getAttribute('aria-expanded') === 'true') return true;
    if (el.tagName === 'DETAILS' && el.open) return true;
    const cls = el.className?.toString?.() || '';
    if (/(?:^|\s)(?:is-)?(?:active|selected|open|expanded)(?:\s|$)/i.test(cls)) return true;
    if (/AccordionItemActive|NavButtonActive|SlideActive/i.test(cls)) return true;
    return false;
  };

  /** @type {object[]} */
  const controls = [];
  /** @type {object[]} */
  const panels = [];
  /** @type {Set<string>} */
  const openLabels = new Set();
  /** @type {Set<string>} */
  const closedLabels = new Set();

  const pushControl = (el) => {
    if (!(el instanceof HTMLElement)) return;
    const label = labelOf(el);
    const open = isOpenControl(el);
    const visible = isShown(el);
    // Only visible chrome contributes to openLabels (hidden dual-UI defaults are ignored)
    if (label && visible) {
      if (open) openLabels.add(label);
      else closedLabels.add(label);
    }
    const id = el.id || null;
    controls.push({
      id: id && idCount(id) === 1 ? id : null,
      rawId: id,
      idUnique: Boolean(id && idCount(id) === 1),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      label,
      open,
      ariaSelected: el.getAttribute('aria-selected'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaHidden: el.getAttribute('aria-hidden'),
      hidden: el.hasAttribute('hidden'),
      detailsOpen: el.tagName === 'DETAILS' ? Boolean(el.open) : null,
      ariaControls: el.getAttribute('aria-controls'),
      interactionClasses: interactionClasses(el),
      className: el.getAttribute('class') || '',
    });
  };

  for (const el of root.querySelectorAll(
    '[role="tab"], [aria-expanded], details, summary, [class*="AccordionItem" i], [class*="NavButton" i]',
  )) {
    pushControl(el);
  }

  for (const el of root.querySelectorAll(
    '[role="tabpanel"], [id^="accordion-content"], [class*="Slide" i][role="tabpanel"], [class*="AccordionItem" i]',
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const id = el.id || null;
    const label = labelOf(el);
    const open =
      el.getAttribute('aria-hidden') === 'false' ||
      /SlideActive|AccordionItemActive/i.test(el.className || '') ||
      (el.getAttribute('aria-expanded') === 'true');
    panels.push({
      id: id && idCount(id) === 1 ? id : null,
      rawId: id,
      idUnique: Boolean(id && idCount(id) === 1),
      label,
      open,
      ariaHidden: el.getAttribute('aria-hidden'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      interactionClasses: interactionClasses(el),
      className: el.getAttribute('class') || '',
      // Child content region often carries max-h-*
      childContent: (() => {
        const child = el.querySelector('[id^="accordion-content"], [class*="content" i], [role="region"]');
        if (!(child instanceof HTMLElement) || child === el) return null;
        return {
          id: child.id && idCount(child.id) === 1 ? child.id : null,
          rawId: child.id || null,
          ariaHidden: child.getAttribute('aria-hidden'),
          interactionClasses: interactionClasses(child),
          className: child.getAttribute('class') || '',
        };
      })(),
    });
  }

  return {
    controls,
    panels,
    openLabels: [...openLabels],
    closedLabels: [...closedLabels].filter((l) => !openLabels.has(l)),
  };
}

/**
 * Merge fingerprints from multiple viewports.
 * @param {object[]} deviceSnaps
 * @param {string} [preferredOpenLabel] — when set, only this label stays open (state capture)
 */
export function mergeOpenStateFingerprints(deviceSnaps, preferredOpenLabel = '') {
  /** @type {Set<string>} */
  const openLabels = new Set();
  /** @type {Map<string, object>} */
  const openControlByLabel = new Map();
  /** @type {Map<string, object>} */
  const closedControlByLabel = new Map();
  /** @type {Map<string, object>} */
  const openPanelByLabel = new Map();
  /** @type {Map<string, object>} */
  const closedPanelByLabel = new Map();
  /** @type {Map<string, object>} */
  const byUniqueId = new Map();

  for (const snap of deviceSnaps || []) {
    for (const lab of snap.openLabels || []) openLabels.add(lab);
    for (const c of snap.controls || []) {
      if (c.idUnique && c.id) byUniqueId.set(c.id, c);
      if (!c.label) continue;
      if (c.open) openControlByLabel.set(c.label, c);
      else closedControlByLabel.set(c.label, c);
    }
    for (const p of snap.panels || []) {
      if (p.idUnique && p.id) byUniqueId.set(`panel:${p.id}`, p);
      if (!p.label) continue;
      if (p.open) openPanelByLabel.set(p.label, p);
      else closedPanelByLabel.set(p.label, p);
    }
  }

  const preferred = normalizeLabel(preferredOpenLabel);
  /** @type {string[]} */
  let finalOpen;
  if (preferred) {
    // Match preferred against collected labels (prefix / equality)
    let matched = [...openLabels].find(
      (l) => l === preferred || l.startsWith(preferred) || preferred.startsWith(l.slice(0, 24)),
    );
    if (!matched) {
      matched = [...openControlByLabel.keys()].find(
        (l) => l === preferred || l.startsWith(preferred) || preferred.startsWith(l.slice(0, 24)),
      );
    }
    if (!matched) matched = preferred;
    finalOpen = [matched];
    // Everything else is closed — steal open templates into closed where needed
    for (const [lab, fp] of openControlByLabel) {
      if (lab !== matched && !closedControlByLabel.has(lab)) {
        closedControlByLabel.set(lab, { ...fp, open: false });
      }
    }
  } else {
    finalOpen = [...openLabels];
  }

  for (const lab of finalOpen) {
    closedControlByLabel.delete(lab);
  }

  return {
    openLabels: finalOpen,
    openControlByLabel: Object.fromEntries(openControlByLabel),
    closedControlByLabel: Object.fromEntries(closedControlByLabel),
    openPanelByLabel: Object.fromEntries(openPanelByLabel),
    closedPanelByLabel: Object.fromEntries(closedPanelByLabel),
    byUniqueId: Object.fromEntries(byUniqueId),
  };
}

/**
 * Swap interaction class tokens on a class string.
 * @param {string} className
 * @param {string[]} fromLiveOpenOrClosed
 * @param {boolean} wantOpen
 * @param {object} merged
 * @param {string} label
 */
export function rewriteInteractionClasses(className, wantOpen, merged, label) {
  let classes = String(className || '')
    .split(/\s+/)
    .filter(Boolean);

  const openEx = (label && merged.openControlByLabel?.[label]) ||
    (label && merged.openPanelByLabel?.[label]) ||
    null;
  const closedEx = (label && merged.closedControlByLabel?.[label]) ||
    (label && merged.closedPanelByLabel?.[label]) ||
    null;
  const template = wantOpen ? openEx : closedEx;
  if (!template?.interactionClasses?.length && !openEx && !closedEx) {
    return className;
  }

  const stripInteraction = (list) =>
    list.filter((c) => !INTERACTION_CLASS_RE.test(c) && !/max-h-/i.test(c));

  classes = stripInteraction(classes);

  const addFrom = template?.interactionClasses || [];
  for (const c of addFrom) {
    if (!classes.includes(c)) classes.push(c);
  }

  // Heuristic Active/Inactive pair swap when templates only give one side
  if (wantOpen) {
    classes = classes.map((c) => c.replace(/Inactive\b/g, 'Active'));
    classes = classes.filter((c) => c !== 'max-h-0');
    if (!classes.some((c) => /max-h-/i.test(c)) && openEx?.interactionClasses) {
      for (const c of openEx.interactionClasses) {
        if (/max-h-/i.test(c) && !classes.includes(c)) classes.push(c);
      }
    }
    // Common Tailwind open panel
    if (
      !classes.some((c) => /max-h-/i.test(c)) &&
      /AccordionItem/i.test(className) &&
      wantOpen
    ) {
      classes.push('max-h-[500px]');
    }
  } else {
    classes = classes.map((c) => c.replace(/AccordionItemActive\b/g, 'AccordionItemInactive'));
    classes = classes.map((c) => c.replace(/NavButtonActive\b/g, 'NavButton'));
    classes = classes.map((c) => c.replace(/SlideActive\b/g, 'SlideHidden'));
    if (!classes.includes('max-h-0') && /Accordion|content|region/i.test(className)) {
      // only add max-h-0 to content regions, not headers
      if (/max-h-|opacity|overflow|AccordionItem/i.test(className) || /accordion-content/i.test(className)) {
        classes = classes.filter((c) => !/max-h-\[/i.test(c));
        if (/accordion-content|max-h-|opacity-0|opacity-100/i.test(className)) {
          if (!classes.includes('max-h-0')) classes.push('max-h-0');
        }
      }
    }
  }

  return classes.join(' ');
}

/**
 * Apply merged fingerprints onto an HTML string (browser DOMParser via evaluate, or
 * exported pure apply for tests using a provided document factory).
 *
 * Pure apply that mutates an Element root (for tests with linked document).
 * @param {Element} root
 * @param {ReturnType<typeof mergeOpenStateFingerprints>} merged
 */
export function applyOpenStateFingerprintsToRoot(root, merged) {
  if (!(root instanceof Element) || !merged) return 0;
  let patched = 0;

  const labelOf = (el) =>
    normalizeLabel(
      el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el.querySelector?.('h2,h3,h4,span')?.textContent || '') ||
        el.textContent ||
        '',
    ).slice(0, 120);

  const openSet = new Set(merged.openLabels || []);

  const applyControl = (el) => {
    const label = labelOf(el);
    const id = el.id || '';
    const byId = id && merged.byUniqueId?.[id];
    const wantOpen = byId ? Boolean(byId.open) : label ? openSet.has(label) : false;
    const template =
      (byId && (byId.open === wantOpen ? byId : null)) ||
      (wantOpen
        ? merged.openControlByLabel?.[label]
        : merged.closedControlByLabel?.[label]) ||
      byId;

    if (!template && !label) return;

    if (el.hasAttribute('aria-selected') || el.getAttribute('role') === 'tab') {
      el.setAttribute('aria-selected', wantOpen ? 'true' : 'false');
      el.setAttribute('tabindex', wantOpen ? '0' : '-1');
      patched += 1;
    }
    if (el.hasAttribute('aria-expanded') || el.tagName === 'BUTTON') {
      if (el.hasAttribute('aria-expanded') || /accordion-header/i.test(el.id || '')) {
        el.setAttribute('aria-expanded', wantOpen ? 'true' : 'false');
        patched += 1;
      }
    }
    if (el.tagName === 'DETAILS') {
      el.open = wantOpen;
      patched += 1;
    }

    const nextClass = rewriteInteractionClasses(el.getAttribute('class') || '', wantOpen, merged, label);
    if (nextClass !== (el.getAttribute('class') || '')) {
      el.setAttribute('class', nextClass);
      patched += 1;
    }

    // Chevron rotate often on child svg
    if (wantOpen) {
      for (const svg of el.querySelectorAll('svg')) {
        const cls = svg.getAttribute('class') || '';
        if (!/rotate-180/.test(cls) && /transition|h-5|flex-shrink/.test(cls)) {
          svg.setAttribute('class', `${cls} rotate-180`.trim());
        }
      }
    } else {
      for (const svg of el.querySelectorAll('svg')) {
        const cls = (svg.getAttribute('class') || '').replace(/\s*rotate-180\b/g, '');
        svg.setAttribute('class', cls.trim());
      }
    }
  };

  const applyPanel = (el) => {
    const label = labelOf(el);
    const id = el.id || '';
    const byId = id && (merged.byUniqueId?.[id] || merged.byUniqueId?.[`panel:${id}`]);
    let wantOpen = byId ? Boolean(byId.open) : label ? openSet.has(label) : null;

    // Accordion item containers: infer from header button
    const header = el.querySelector(':scope > button[aria-expanded], :scope > [aria-expanded]');
    if (header && wantOpen == null) {
      wantOpen = header.getAttribute('aria-expanded') === 'true';
    }
    if (wantOpen == null && /accordion/i.test(el.id || '')) {
      const hdr = el.querySelector('[aria-expanded]');
      wantOpen = hdr?.getAttribute('aria-expanded') === 'true';
    }
    if (wantOpen == null) return;

    if (el.hasAttribute('aria-hidden') || el.getAttribute('role') === 'tabpanel') {
      el.setAttribute('aria-hidden', wantOpen ? 'false' : 'true');
      patched += 1;
    }
    const nextClass = rewriteInteractionClasses(el.getAttribute('class') || '', wantOpen, merged, label);
    if (nextClass !== (el.getAttribute('class') || '')) {
      el.setAttribute('class', nextClass);
      patched += 1;
    }

    // Nested accordion content
    const content =
      el.querySelector(`:scope > [id^="accordion-content"]`) ||
      (id && root.querySelector(`#${CSS.escape(id.replace(/accordion-(\d+)/, 'accordion-content-$1'))}`));
    // Prefer direct child region
    const regions = el.querySelectorAll(':scope > [id^="accordion-content"], :scope > [role="region"]');
    for (const region of regions) {
      if (!(region instanceof HTMLElement)) continue;
      region.setAttribute('aria-hidden', wantOpen ? 'false' : 'true');
      let rClass = region.getAttribute('class') || '';
      if (wantOpen) {
        region.removeAttribute('hidden');
        region.removeAttribute('data-bq-state-closed');
        rClass = rClass
          .replace(/\bmax-h-0\b/g, 'max-h-[500px]')
          .replace(/\bopacity-0\b/g, 'opacity-100')
          .replace(/\boverflow-hidden\b/g, '');
        if (!/max-h-\[/.test(rClass) && !/max-h-\[500px\]/.test(rClass)) {
          rClass = `${rClass} max-h-[500px] opacity-100`.trim();
        }
        if (!/px-4|pb-4/.test(rClass)) {
          /* keep existing padding classes */
        }
      } else {
        // Hard-hide closed panels so absolute media cannot paint empty boxes
        region.setAttribute('hidden', '');
        region.setAttribute('data-bq-state-closed', '1');
        rClass = rClass
          .replace(/\bmax-h-\[[^\]]+\]/g, 'max-h-0')
          .replace(/\bopacity-100\b/g, 'opacity-0');
        if (!/\bmax-h-0\b/.test(rClass)) rClass = `${rClass} max-h-0 overflow-hidden opacity-0`.trim();
      }
      region.setAttribute('class', rClass.replace(/\s+/g, ' ').trim());
      patched += 1;
    }
  };

  for (const el of root.querySelectorAll(
    '[role="tab"], [aria-expanded], details, summary, button[id^="accordion-header"]',
  )) {
    applyControl(el);
  }

  // Accordion items + slides — apply after headers so aria-expanded is set
  for (const el of root.querySelectorAll(
    '[id^="media-slider-accordion"], [class*="AccordionItem" i], [role="tabpanel"], [class*="Slide" i]',
  )) {
    applyPanel(el);
  }

  // Second pass: sync accordion item Active class from nested header
  for (const el of root.querySelectorAll('[id^="media-slider-accordion"], [class*="AccordionItem" i]')) {
    const hdr = el.querySelector('[aria-expanded]');
    if (!hdr) continue;
    const wantOpen = hdr.getAttribute('aria-expanded') === 'true';
    let cls = el.getAttribute('class') || '';
    if (wantOpen) {
      cls = cls
        .replace(/AccordionItemInactive/g, 'AccordionItemActive')
        .replace(/\bborder-sc-neutral-200\b/g, 'border-sc-neutral-300')
        .replace(/\bbg-sc-neutral-100\b/g, 'bg-white');
      if (!/AccordionItemActive/.test(cls) && /AccordionItem/.test(cls)) {
        cls = cls.replace(/AccordionItem\b/, 'AccordionItem AccordionItemActive');
      }
    } else {
      cls = cls
        .replace(/AccordionItemActive/g, 'AccordionItemInactive')
        .replace(/\bborder-sc-neutral-300\b/g, 'border-sc-neutral-200')
        .replace(/\bbg-white\b/g, 'bg-sc-neutral-100');
    }
    el.setAttribute('class', cls);
    patched += 1;
  }

  return patched;
}

/**
 * Apply fingerprints to an HTML fragment string using the page's DOMParser.
 * @param {import('playwright').Page} page
 * @param {string} structureHtml
 * @param {ReturnType<typeof mergeOpenStateFingerprints>} merged
 */
export async function applyOpenStateFingerprintsWithPage(page, structureHtml, merged) {
  return page.evaluate(
    ({ html, merged: m }) => {
      const doc = new DOMParser().parseFromString(
        `<div id="bq-sync-root">${html}</div>`,
        'text/html',
      );
      const root = doc.getElementById('bq-sync-root');
      if (!root?.firstElementChild) return html;

      // Inline apply (same logic as applyOpenStateFingerprintsToRoot — kept in evaluate
      // because Node has no DOMParser without extra deps).
      const INTERACTION_CLASS_RE =
        /(?:^|[\s_-])((?:is-)?(?:active|inactive|selected|open|closed|expanded|collapsed)|max-h-(?:0|\[[^\]]+\])|SlideActive|SlideHidden|AccordionItemActive|AccordionItemInactive|NavButtonActive)(?:$|[\s_-])/i;
      const normalizeLabel = (s) =>
        String(s || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      const labelOf = (el) =>
        normalizeLabel(
          el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            (el.querySelector('h2,h3,h4,span')?.textContent || '') ||
            el.textContent ||
            '',
        ).slice(0, 120);
      const openSet = new Set(m.openLabels || []);

      const rewriteClasses = (className, wantOpen, label, kind) => {
        let classes = String(className || '')
          .split(/\s+/)
          .filter(Boolean)
          .filter((c) => !INTERACTION_CLASS_RE.test(c) && !/max-h-/i.test(c));
        const template = wantOpen
          ? m.openControlByLabel?.[label] || m.openPanelByLabel?.[label]
          : m.closedControlByLabel?.[label] || m.closedPanelByLabel?.[label];
        for (const c of template?.interactionClasses || []) {
          // Do not mix NavButton* onto accordion headers (or Accordion* onto tabs)
          if (kind === 'accordion' && /NavButton/i.test(c)) continue;
          if (kind === 'tab' && /AccordionItem/i.test(c)) continue;
          if (!classes.includes(c)) classes.push(c);
        }
        if (wantOpen) {
          classes = classes.map((c) => c.replace(/Inactive\b/g, 'Active'));
          if (!classes.some((c) => /max-h-/i.test(c)) && /AccordionItem/i.test(className)) {
            classes.push('max-h-[500px]');
          }
        } else {
          classes = classes.map((c) =>
            c
              .replace(/AccordionItemActive\b/g, 'AccordionItemInactive')
              .replace(/SlideActive\b/g, 'SlideHidden'),
          );
        }
        return classes.join(' ');
      };

      const section = root.firstElementChild;

      for (const el of section.querySelectorAll(
        '[role="tab"], [aria-expanded], details, summary, button[id^="accordion-header"]',
      )) {
        const label = labelOf(el);
        const id = el.id || '';
        const byId = id && m.byUniqueId?.[id];
        const wantOpen = byId ? Boolean(byId.open) : label ? openSet.has(label) : false;

        if (el.hasAttribute('aria-selected') || el.getAttribute('role') === 'tab') {
          el.setAttribute('aria-selected', wantOpen ? 'true' : 'false');
          el.setAttribute('tabindex', wantOpen ? '0' : '-1');
        }
        if (el.hasAttribute('aria-expanded') || /accordion-header/i.test(el.id || '')) {
          if (el.hasAttribute('aria-expanded') || /accordion-header/i.test(el.id || '')) {
            el.setAttribute('aria-expanded', wantOpen ? 'true' : 'false');
          }
        }
        if (el.tagName === 'DETAILS') el.open = wantOpen;

        const kind =
          /accordion-header/i.test(el.id || '') || el.hasAttribute('aria-expanded')
            ? 'accordion'
            : el.getAttribute('role') === 'tab'
              ? 'tab'
              : 'other';
        let next = rewriteClasses(el.getAttribute('class') || '', wantOpen, label, kind);
        // Strip NavButton* that may already be on accordion headers
        if (kind === 'accordion') {
          next = next
            .split(/\s+/)
            .filter((c) => !/NavButton/i.test(c))
            .join(' ');
        }
        if (next) el.setAttribute('class', next);

        if (wantOpen) {
          for (const svg of el.querySelectorAll(':scope > svg, :scope svg')) {
            const cls = svg.getAttribute('class') || '';
            if (!/rotate-180/.test(cls) && /transition|h-5|flex-shrink/.test(cls)) {
              svg.setAttribute('class', `${cls} rotate-180`.trim());
            }
          }
        } else {
          for (const svg of el.querySelectorAll('svg')) {
            svg.setAttribute(
              'class',
              (svg.getAttribute('class') || '').replace(/\s*rotate-180\b/g, '').trim(),
            );
          }
        }

        // Header text color
        if (/accordion-header/i.test(el.id || '')) {
          let cls = el.getAttribute('class') || '';
          cls = wantOpen
            ? cls.replace(/text-gray-600/g, 'text-gray-900')
            : cls.replace(/text-gray-900/g, 'text-gray-600');
          el.setAttribute('class', cls);
          for (const span of el.querySelectorAll(':scope > span')) {
            let sc = span.getAttribute('class') || '';
            sc = wantOpen
              ? sc.replace(/text-gray-600/g, 'text-gray-900')
              : sc.replace(/text-gray-900/g, 'text-gray-600');
            span.setAttribute('class', sc);
          }
        }
      }

      for (const el of section.querySelectorAll(
        '[id^="media-slider-accordion"], [class*="AccordionItem"], [role="tabpanel"], [class*="Slide"]',
      )) {
        const label = labelOf(el);
        const id = el.id || '';
        const byId = id && (m.byUniqueId?.[id] || m.byUniqueId?.[`panel:${id}`]);
        let wantOpen = byId ? Boolean(byId.open) : label ? openSet.has(label) : null;
        const hdr = el.querySelector(':scope > button[aria-expanded], :scope > [aria-expanded], [aria-expanded]');
        if (wantOpen == null && hdr) {
          wantOpen = hdr.getAttribute('aria-expanded') === 'true';
        }
        if (wantOpen == null) continue;

        if (el.hasAttribute('aria-hidden') || el.getAttribute('role') === 'tabpanel') {
          el.setAttribute('aria-hidden', wantOpen ? 'false' : 'true');
        }
        let cls = el.getAttribute('class') || '';
        if (wantOpen) {
          cls = cls
            .replace(/AccordionItemInactive/g, 'AccordionItemActive')
            .replace(/SlideHidden/g, 'SlideActive')
            .replace(/\bborder-sc-neutral-200\b/g, 'border-sc-neutral-300')
            .replace(/\bbg-sc-neutral-100\b/g, 'bg-white');
          if (/AccordionItem/.test(cls) && !/AccordionItemActive/.test(cls)) {
            cls += ' AccordionItemActive';
          }
        } else {
          cls = cls
            .replace(/AccordionItemActive/g, 'AccordionItemInactive')
            .replace(/SlideActive/g, 'SlideHidden')
            .replace(/\bborder-sc-neutral-300\b/g, 'border-sc-neutral-200');
        }
        el.setAttribute('class', cls.trim());

        for (const region of el.querySelectorAll(
          ':scope > [id^="accordion-content"], :scope > [role="region"]',
        )) {
          region.setAttribute('aria-hidden', wantOpen ? 'false' : 'true');
          let rClass = region.getAttribute('class') || '';
          if (wantOpen) {
            region.removeAttribute('hidden');
            region.removeAttribute('data-bq-state-closed');
            rClass = rClass
              .replace(/\bmax-h-0\b/g, 'max-h-[500px]')
              .replace(/\bopacity-0\b/g, 'opacity-100');
            if (!/max-h-\[/.test(rClass)) rClass += ' max-h-[500px] opacity-100 px-4 pb-4';
            rClass = rClass.replace(/\boverflow-hidden\b/g, '');
          } else {
            region.setAttribute('hidden', '');
            region.setAttribute('data-bq-state-closed', '1');
            rClass = rClass
              .replace(/\bmax-h-\[[^\]]+\]/g, 'max-h-0')
              .replace(/\bopacity-100\b/g, 'opacity-0');
            if (!/\bmax-h-0\b/.test(rClass)) rClass += ' max-h-0 overflow-hidden opacity-0';
          }
          region.setAttribute('class', rClass.replace(/\s+/g, ' ').trim());
        }
      }

      // Tab logo dots: bg-sc-red-700 when selected
      for (const tab of section.querySelectorAll('[role="tab"]')) {
        const selected = tab.getAttribute('aria-selected') === 'true';
        for (const dot of tab.querySelectorAll('span[aria-hidden]')) {
          let dc = dot.getAttribute('class') || '';
          if (/rounded-full|h-1\.5|h-2/.test(dc)) {
            dc = selected
              ? dc.replace(/\bbg-transparent\b/g, 'bg-sc-red-700')
              : dc.replace(/\bbg-sc-red-700\b/g, 'bg-transparent');
            if (selected && !/bg-sc-red/.test(dc)) dc += ' bg-sc-red-700';
            if (!selected && !/bg-transparent/.test(dc) && /bg-sc-red/.test(dc)) {
              dc = dc.replace(/\bbg-sc-red-700\b/g, 'bg-transparent');
            }
            dot.setAttribute('class', dc.trim());
          }
        }
        // Opacity on logo tabs
        let tc = tab.getAttribute('class') || '';
        if (selected) {
          tc = tc.replace(/\bopacity-40\b/g, '').replace(/\s+/g, ' ').trim();
        } else if (!/opacity-40/.test(tc) && /NavButton/.test(tc)) {
          tc = `${tc} opacity-40 hover:opacity-100`.trim();
        }
        tab.setAttribute('class', tc);
      }

      return section.outerHTML;
    },
    { html: structureHtml, merged },
  );
}

/**
 * Collect open-state across viewports (re-activating via beforeDevice) and patch structure HTML.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   sectionSelector: string,
 *   structureHtml: string,
 *   devices?: string[],
 *   beforeDevice?: (page: import('playwright').Page, device: string) => Promise<void>,
 *   preferredOpenLabel?: string,
 * }} opts
 * @returns {Promise<{ html: string, openLabels: string[], patched: boolean }>}
 */
export async function syncOpenStateFromLivePage(page, opts) {
  const {
    sectionSelector,
    structureHtml,
    devices = ['desktop', 'tablet', 'mobile'],
    beforeDevice = null,
    preferredOpenLabel = '',
  } = opts;

  if (!structureHtml || !sectionSelector) {
    return { html: structureHtml || '', openLabels: [], patched: false };
  }

  /** @type {object[]} */
  const snaps = [];
  for (const device of devices) {
    await page.setViewportSize(VIEWPORTS[device] || VIEWPORTS.desktop);
    await ensureOverlayScrollbars(page);
    await page.waitForTimeout(120);
    if (typeof beforeDevice === 'function') {
      await beforeDevice(page, device);
      await page.waitForTimeout(200);
    }
    const snap = await page
      .evaluate(collectOpenStateFingerprintsInBrowser, sectionSelector)
      .catch(() => null);
    if (snap) snaps.push(snap);
  }

  const merged = mergeOpenStateFingerprints(snaps, preferredOpenLabel);
  if (!merged.openLabels.length) {
    return { html: structureHtml, openLabels: [], patched: false };
  }

  let html = await applyOpenStateFingerprintsWithPage(page, structureHtml, merged);

  // Stamp display:none for nodes that are hidden at tablet in the live page so
  // desktop computed overlays cannot resurrect dual chrome (e.g. CompactLayout).
  try {
    await page.setViewportSize(VIEWPORTS.tablet);
    await ensureOverlayScrollbars(page);
    await page.waitForTimeout(100);
    if (typeof beforeDevice === 'function') {
      await beforeDevice(page, 'tablet');
      await page.waitForTimeout(150);
    }
    // Desktop computed overlays can resurrect dual chrome at narrow widths.
    // Mark tablet-hidden nodes and inject a max-width rule (keeps desktop shots intact).
    const hiddenKeys = await page
      .evaluate((sel) => {
        const root = document.querySelector(sel);
        if (!(root instanceof Element)) return { bqIds: [], ids: [] };
        /** @type {string[]} */
        const bqIds = [];
        /** @type {string[]} */
        const ids = [];
        for (const el of root.querySelectorAll('*')) {
          if (!(el instanceof HTMLElement)) continue;
          const st = window.getComputedStyle(el);
          if (st.display !== 'none') continue;
          const bq = el.getAttribute('data-bq-id');
          if (bq) bqIds.push(bq);
          if (el.id) {
            try {
              if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
                ids.push(el.id);
              }
            } catch {
              /* ignore */
            }
          }
        }
        return { bqIds: bqIds.slice(0, 120), ids: ids.slice(0, 80) };
      }, sectionSelector)
      .catch(() => ({ bqIds: [], ids: [] }));

    if (html) {
      html = await page.evaluate(
        ({ docHtml, bqIds, ids }) => {
          const doc = new DOMParser().parseFromString(
            `<div id="bq-sync-root">${docHtml}</div>`,
            'text/html',
          );
          const root = doc.getElementById('bq-sync-root')?.firstElementChild;
          if (!root) return docHtml;

          for (const bq of bqIds || []) {
            try {
              const el = root.querySelector(`[data-bq-id="${CSS.escape(bq)}"]`);
              if (el instanceof HTMLElement) el.setAttribute('data-bq-narrow-hide', '1');
            } catch {
              /* ignore */
            }
          }
          for (const id of ids || []) {
            try {
              const el = root.querySelector(`#${CSS.escape(id)}`);
              if (el instanceof HTMLElement) el.setAttribute('data-bq-narrow-hide', '1');
            } catch {
              /* ignore */
            }
          }
          for (const el of root.querySelectorAll(
            '[class*="CompactLayout"], [class*="compact-layout"]',
          )) {
            if (el instanceof HTMLElement) el.setAttribute('data-bq-narrow-hide', '1');
          }

          const style = doc.createElement('style');
          style.setAttribute('data-bq-narrow-chrome', '1');
          style.textContent = `
[data-bq-state-closed="1"],
[data-bq-state-closed="1"] * {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
  max-height: 0 !important;
  overflow: hidden !important;
}
@media (max-width: 1023px) {
  [data-bq-narrow-hide="1"],
  [class*="CompactLayout"],
  [class*="compact-layout"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
}`;
          // Prepend style as sibling comment-friendly: wrap return as style+section
          return `${style.outerHTML}${root.outerHTML}`;
        },
        {
          docHtml: html,
          bqIds: hiddenKeys?.bqIds || [],
          ids: hiddenKeys?.ids || [],
        },
      );
    }
  } catch {
    /* non-fatal */
  }

  return {
    html: html || structureHtml,
    openLabels: merged.openLabels,
    patched: Boolean(html && html !== structureHtml),
  };
}
