/**
 * HTML multi-band evidence + sitecoreize emit CONTRACT (detect-only).
 * Composite vs leaf is inferred from packages / placeholders / layoutSketch —
 * never planMode or enrich hints.
 */

/**
 * Count peer stacked bands in section HTML (generic — not class-name authority,
 * but repeated peer blocks under a stack container are strong evidence).
 * @param {string|null|undefined} html
 * @returns {{ multiBand: boolean, bandCount: number, evidence: string }}
 */
export function detectHtmlMultiBandEvidence(html) {
  let src = String(html || '');
  if (!src.trim()) {
    return { multiBand: false, bandCount: 0, evidence: 'empty-html' };
  }
  // Modals / dialogs nest layout chrome (e.g. header search) that must not count
  // as peer content bands.
  src = src.replace(/<dialog\b[\s\S]*?<\/dialog>/gi, '');

  /** @type {Array<{ re: RegExp, label: string }>} */
  const probes = [
    { re: /class\s*=\s*["'][^"']*\bgrid-section\b(?![^"']*container)/gi, label: 'grid-section peers' },
    { re: /<section\b/gi, label: 'section elements' },
    {
      re: /class\s*=\s*["'][^"']*\b(footer-(?:signpost|navigation|legal|branding|column)|footer-group)\b/gi,
      label: 'footer band peers',
    },
  ];

  let bestCount = 0;
  let bestLabel = '';
  for (const p of probes) {
    const n = (src.match(p.re) || []).length;
    if (n > bestCount) {
      bestCount = n;
      bestLabel = p.label;
    }
  }

  // Also: multiple h2 headings often mark stacked editorial bands
  const h2Count = (src.match(/<h2\b/gi) || []).length;
  if (h2Count > bestCount) {
    bestCount = h2Count;
    bestLabel = 'h2 band headings';
  }

  const multiBand = bestCount >= 2;
  return {
    multiBand,
    bandCount: bestCount,
    evidence: multiBand ? `${bestLabel}=${bestCount}` : `bands=${bestCount}`,
  };
}

/**
 * True when parent definitionTs seeds peer-band content as Multi-Line Text / JSON bags.
 * @param {string} definitionTs
 * @returns {boolean}
 */
export function parentDefinitionHasPeerBandFieldBags(definitionTs) {
  const src = String(definitionTs || '');
  if (!src.trim()) return false;
  // Multi-Line Text fields whose names suggest card/link arrays
  if (
    /name\s*:\s*['"][^'"]*(Cards?|Links?|Items?|Bands?|Blocks?)['"]\s*,\s*type\s*:\s*['"]Multi-Line Text['"]/i.test(
      src,
    )
  ) {
    return true;
  }
  // Seed values that look like JSON arrays of { text, url } or card objects
  if (
    /['"][^'"]*(Cards?|Links?|Items?)['"]\s*:\s*(?:JSON\.stringify\s*\()?[\[`']\s*\{/.test(
      src,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Count nested layoutSketch peer entries under any placeholder key.
 * @param {object|null|undefined} layoutSketch
 * @returns {number}
 */
export function countLayoutSketchNestedPeers(layoutSketch) {
  let count = 0;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const ph = node.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const key of Object.keys(ph)) {
        const list = ph[key];
        if (Array.isArray(list)) {
          count += list.length;
          for (const child of list) visit(child);
        }
      }
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r);
    }
  };
  visit(layoutSketch);
  return count;
}

/**
 * Count nested layoutSketch peers grouped by componentName.
 * @param {object|null|undefined} layoutSketch
 * @returns {Map<string, number>}
 */
export function countLayoutSketchPeersByComponentName(layoutSketch) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const ph = node.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const key of Object.keys(ph)) {
        const list = ph[key];
        if (!Array.isArray(list)) continue;
        for (const child of list) {
          const name = String(child?.componentName || '').trim();
          if (name) counts.set(name, (counts.get(name) || 0) + 1);
          visit(child);
        }
      }
    }
    if (Array.isArray(node.renderings)) {
      for (const r of node.renderings) visit(r);
    }
  };
  visit(layoutSketch);
  return counts;
}

/**
 * Flat instance plan from layoutSketch PH peers (order-preserving).
 * @param {object|null|undefined} layoutSketch
 * @returns {Array<{ componentName: string, datasourceItem: string, placeholder: string }>}
 */
export function collectLayoutSketchInstancePlan(layoutSketch) {
  /** @type {Array<{ componentName: string, datasourceItem: string, placeholder: string }>} */
  const out = [];
  /**
   * @param {object[]} list
   * @param {string} placeholder
   */
  const visitList = (list, placeholder) => {
    for (const child of list || []) {
      if (!child || typeof child !== 'object') continue;
      const componentName = String(child.componentName || '').trim();
      if (componentName) {
        out.push({
          componentName,
          datasourceItem: String(
            child.datasourceName || child.datasourceItem || '',
          ).trim(),
          placeholder: String(placeholder || '').trim(),
        });
      }
      const ph = child.placeholders;
      if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
        for (const [phKey, nested] of Object.entries(ph)) {
          if (Array.isArray(nested)) visitList(nested, phKey);
        }
      }
    }
  };
  const roots = Array.isArray(layoutSketch?.renderings)
    ? layoutSketch.renderings
    : layoutSketch?.componentName || layoutSketch?.placeholders
      ? [layoutSketch]
      : [];
  for (const root of roots) {
    const ph = root?.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const [phKey, list] of Object.entries(ph)) {
        if (Array.isArray(list)) visitList(list, phKey);
      }
    }
  }
  return out;
}

/**
 * Count top-level content.items objects in a definitionTs string.
 * @param {string|null|undefined} definitionTs
 * @returns {number}
 */
export function countDefinitionTsContentItems(definitionTs) {
  const src = String(definitionTs || '');
  const itemsStart = src.search(/\bitems\s*:\s*\[/);
  if (itemsStart < 0) return 0;
  const after = src.slice(itemsStart);
  const openIdx = after.indexOf('[');
  if (openIdx < 0) return 0;
  let depth = 0;
  let end = -1;
  for (let i = openIdx; i < after.length; i++) {
    const ch = after[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return 0;
  const arrBody = after.slice(openIdx + 1, end);
  let count = 0;
  let brace = 0;
  for (let i = 0; i < arrBody.length; i++) {
    const ch = arrBody[i];
    if (ch === '{') {
      if (brace === 0) count += 1;
      brace += 1;
    } else if (ch === '}') {
      brace = Math.max(0, brace - 1);
    }
  }
  return count;
}

/**
 * Resolve package componentName for sketch peer matching.
 * @param {{ componentName?: string, definitionKey?: string, definitionTs?: string }} pkg
 * @returns {string}
 */
function packageComponentNameForSketch(pkg) {
  const direct = String(pkg?.componentName || '').trim();
  if (direct) return direct;
  const fromDef = String(pkg?.definitionTs || '').match(
    /componentName\s*:\s*["']([^"']+)["']/,
  );
  if (fromDef?.[1]) return fromDef[1];
  const key = String(pkg?.definitionKey || '').trim();
  if (!key) return '';
  // menzis-split-content-band → MenzisSplitContentBand (best-effort)
  return key
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/**
 * CONTRACT diagnostics: HTML multi-band evidence vs concrete sitecoreize emit.
 * @param {{
 *   sectionHtml?: string|null,
 *   packages?: Array<{ role?: string, parentPlaceholder?: string|null, definitionTs?: string, definitionKey?: string, componentName?: string }>|null,
 *   layoutSketch?: object|null,
 * }} opts
 * @returns {string[]}
 */
export function collectHtmlMultiBandEmitDiagnostics(opts = {}) {
  const evidence = detectHtmlMultiBandEvidence(opts.sectionHtml);
  if (!evidence.multiBand) return [];

  /** @type {string[]} */
  const out = [];
  const packages = Array.isArray(opts.packages) ? opts.packages : [];
  const children = packages.filter(
    (p) =>
      String(p?.role || '').toLowerCase() === 'child' ||
      Boolean(String(p?.parentPlaceholder || '').trim()),
  );
  const sections = packages.filter(
    (p) => String(p?.role || '').toLowerCase() !== 'child',
  );
  const parent = sections[0] || packages[0] || null;
  const parentDef = String(parent?.definitionTs || '');

  if (!children.length) {
    out.push(
      `CONTRACT: HTML multi-band (${evidence.evidence}) requires role:"child" packages with parentPlaceholder — emit composite host + children (not one mega package)`,
    );
  }

  if (parentDef) {
    const emptyAllowed = /allowedControls\s*:\s*\[\s*\]/.test(parentDef);
    const noPlaceholders =
      /\bplaceholders\s*:\s*\[\s*\]/.test(parentDef) ||
      !/\bplaceholders\s*:\s*\[/.test(parentDef);
    if (emptyAllowed || (children.length > 0 && noPlaceholders)) {
      out.push(
        `CONTRACT: HTML multi-band (${evidence.evidence}) — parent definitionTs must declare placeholders[].key with non-empty allowedControls for child definitionKeys`,
      );
    }
    if (parentDefinitionHasPeerBandFieldBags(parentDef) && !children.length) {
      out.push(
        `CONTRACT: HTML multi-band (${evidence.evidence}) — do not stuff peer bands into parent Multi-Line Text/JSON field bags; use child packages + layoutSketch`,
      );
    }
  }

  const sketchPeers = countLayoutSketchNestedPeers(opts.layoutSketch);
  if (children.length > 0 && sketchPeers === 0) {
    out.push(
      `CONTRACT: HTML multi-band (${evidence.evidence}) — layoutSketch must nest peer renderings under placeholder keys (top-level layoutSketch with datasourceName entries)`,
    );
  }

  // Per-type: content.items.length must cover every layoutSketch peer of that componentName.
  // Skip when definitionTs is absent (e.g. parent TSX validate with name-only childPackages) —
  // sitecoreize emit + child write assertContentItemsMatchPeerCount own the hard seed gate.
  const peersByName = countLayoutSketchPeersByComponentName(opts.layoutSketch);
  for (const child of children) {
    const defTs = String(child?.definitionTs || '');
    if (!defTs.trim()) continue;
    const name = packageComponentNameForSketch(child);
    if (!name) continue;
    const expected =
      peersByName.get(name) ||
      [...peersByName.entries()].find(
        ([k]) => k.toLowerCase() === name.toLowerCase(),
      )?.[1] ||
      0;
    if (expected < 2) continue;
    const actual = countDefinitionTsContentItems(defTs);
    if (actual < expected) {
      out.push(
        `CONTRACT: HTML multi-band (${evidence.evidence}) — ${name} content.items.length=${actual} < layoutSketch peers=${expected}; seed one content.items[] row per layoutSketch instance (datasourceName)`,
      );
    }
  }

  return out.map((m) => (m.startsWith('CONTRACT:') ? m : `CONTRACT: ${m}`));
}

/**
 * Map sitecoreize layoutSketch into page/partial presentation children.
 * @param {object|null|undefined} layoutSketch
 * @param {Array<{ componentName?: string, definitionKey?: string, role?: string }>|null|undefined} componentResults
 * @returns {Array<{ definitionKey: string, datasourceItem?: string, placeholder?: string, children?: object[] }>}
 */
export function presentationChildrenFromLayoutSketch(
  layoutSketch,
  componentResults = [],
) {
  const results = Array.isArray(componentResults) ? componentResults : [];
  /** @type {Map<string, string>} */
  const nameToKey = new Map();
  for (const c of results) {
    const name = String(c?.componentName || '').trim();
    const key = String(c?.definitionKey || '').trim();
    if (name && key) nameToKey.set(name.toLowerCase(), key);
  }

  const resolveKey = (componentName) => {
    const n = String(componentName || '').trim();
    if (!n) return '';
    return (
      nameToKey.get(n.toLowerCase()) ||
      results.find(
        (c) =>
          String(c?.definitionKey || '')
            .toLowerCase()
            .endsWith(n.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()),
      )?.definitionKey ||
      ''
    );
  };

  /**
   * @param {object} node
   * @param {string} [placeholder]
   * @returns {object|null}
   */
  const mapNode = (node, placeholder = '') => {
    if (!node || typeof node !== 'object') return null;
    const componentName = String(node.componentName || '').trim();
    const definitionKey = resolveKey(componentName);
    if (!definitionKey) return null;
    const datasourceItem = String(
      node.datasourceName || node.datasourceItem || '',
    ).trim();
    /** @type {object[]} */
    const nested = [];
    const ph = node.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const [phKey, list] of Object.entries(ph)) {
        if (!Array.isArray(list)) continue;
        for (const child of list) {
          const mapped = mapNode(child, phKey);
          if (mapped) nested.push(mapped);
        }
      }
    }
    return {
      definitionKey,
      ...(datasourceItem ? { datasourceItem } : {}),
      ...(placeholder ? { placeholder } : {}),
      ...(nested.length ? { children: nested } : {}),
    };
  };

  /** @type {object[]} */
  const out = [];
  const roots = Array.isArray(layoutSketch?.renderings)
    ? layoutSketch.renderings
    : layoutSketch?.componentName
      ? [layoutSketch]
      : [];

  for (const root of roots) {
    const ph = root?.placeholders;
    if (ph && typeof ph === 'object' && !Array.isArray(ph)) {
      for (const [phKey, list] of Object.entries(ph)) {
        if (!Array.isArray(list)) continue;
        for (const child of list) {
          const mapped = mapNode(child, phKey);
          if (mapped) out.push(mapped);
        }
      }
    }
  }
  return out;
}
