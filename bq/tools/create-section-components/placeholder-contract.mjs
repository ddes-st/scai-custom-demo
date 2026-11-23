/**
 * Pre-generation placeholder + definition contracts for composite parents.
 * Exact prompt literals from the decompose plan; detect-only diagnostics for the validate loop.
 * Supports multi-slot parents (stacked footer bands) and single-track carousels.
 */
import {
  displayNameFromComponentName,
  toBasePlaceholderKey,
  toDefinitionKey,
  toKebabCase,
} from './naming.mjs';
import {
  extractPlaceholderBasesFromChildren,
  extractPlaceholderBasesFromTsx,
  extractPlaceholderKeysFromDefinition,
  hasAppPlaceholderInSources,
  unionStructureTsxSources,
} from './sync-definition-from-tsx.mjs';
import {
  compositeChildrenFromEnrichRepeats,
  matchEnrichCompositePattern,
} from './enrich-structure-fingerprint.mjs';

/**
 * All definitionKeys listed in any placeholders[].allowedControls on a definition.
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function extractAllowedControlKeysFromDefinition(definitionTs) {
  /** @type {string[]} */
  const keys = [];
  const re = /allowedControls\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(String(definitionTs || '')))) {
    const body = m[1] || '';
    for (const km of body.matchAll(/['"]([^'"]+)['"]/g)) {
      keys.push(km[1]);
    }
  }
  return keys;
}

/**
 * Stable placeholder key for a heterogeneous composite child type.
 * repeatHint > 1 → `{kebab}-items`; else kebab of definitionKey / componentName.
 * @param {object|null|undefined} child
 * @param {string} [childKey]
 * @returns {string|null}
 */
export function placeholderKeyForHeterogeneousChild(child, childKey = '') {
  const explicit = explicitChildParentPlaceholder(child);
  if (explicit) return explicit;
  const key =
    String(childKey || '').trim() ||
    String(child?.definitionKey || '').trim() ||
    toDefinitionKey(child?.componentName || '');
  const base = toBasePlaceholderKey(toKebabCase(key));
  if (!base) return null;
  const hint = Number(child?.repeatHint);
  if (Number.isFinite(hint) && hint > 1) {
    return base.endsWith('-items') ? base : `${base}-items`;
  }
  return base;
}

/**
 * Sitecoreize / conversion explicit parent PH on a child package result.
 * Prefer this over footer name heuristics when nesting under a parent.
 *
 * @param {object|null|undefined} child
 * @returns {string|null}
 */
export function explicitChildParentPlaceholder(child) {
  return (
    toBasePlaceholderKey(
      toKebabCase(
        String(
          child?.placeholder ||
            child?.placeholderKey ||
            child?.parentPlaceholder ||
            '',
        ).trim(),
      ),
    ) || null
  );
}

/**
 * Child placeholder: explicit plan/package key only.
 * Does **not** invent legacy footer-social / footer-legal / four-band keys
 * or guess from component names (parent section.placeholderKey owns single-track).
 * @param {object|null|undefined} child
 * @returns {string|null}
 */
export function inferPlanChildPlaceholderKey(child) {
  return explicitChildParentPlaceholder(child);
}

/**
 * Resolve which placeholder band a child / package covers.
 * Prefer explicit `placeholder` / `placeholderKey`; else infer from name.
 * @param {object|null|undefined} child
 * @returns {string|null}
 */
export function resolveChildPlaceholder(child) {
  return inferPlanChildPlaceholderKey(child);
}

/**
 * True when any child already covers the given placeholder base key.
 * @param {Array<object|null|undefined>|null|undefined} children
 * @param {string} placeholder
 * @returns {boolean}
 */
export function placeholderCovered(children, placeholder) {
  const want = toBasePlaceholderKey(toKebabCase(String(placeholder || '').trim()));
  if (!want) return false;
  return (children || []).some((c) => resolveChildPlaceholder(c) === want);
}

/**
 * First real package in componentResults that covers `placeholder` (never invents keys).
 * @param {Array<object|null|undefined>|null|undefined} componentResults
 * @param {string} placeholder
 * @param {string} [parentKey]
 * @returns {string|undefined}
 */
export function findPackageForPlaceholder(
  componentResults,
  placeholder,
  parentKey = '',
) {
  const want = toBasePlaceholderKey(toKebabCase(String(placeholder || '').trim()));
  if (!want) return undefined;
  const parent = String(parentKey || '').trim();
  /** @type {string|undefined} */
  let fuzzy = undefined;
  for (const c of componentResults || []) {
    const key = String(c?.definitionKey || '').trim();
    if (!key || (parent && key === parent)) continue;
    const role = String(c?.role || '').toLowerCase();
    // Section parent packages are not child band fill.
    if (role === 'section') continue;
    if (
      resolveChildPlaceholder({
        definitionKey: key,
        componentName: c?.componentName,
        placeholder: c?.placeholder || c?.placeholderKey || c?.parentPlaceholder,
        placeholderKey: c?.placeholderKey,
        parentPlaceholder: c?.parentPlaceholder,
      }) === want
    ) {
      return key;
    }
    // Fuzzy: package kebab ends with / equals the placeholder base
    // (e.g. crelan-header-navigation → header-navigation).
    const short = key.includes('-') ? key.split('-').slice(1).join('-') : key;
    if (
      !fuzzy &&
      (key === want ||
        short === want ||
        key.endsWith(`-${want}`) ||
        want.endsWith(short) ||
        short.endsWith(want))
    ) {
      fuzzy = key;
    }
  }
  return fuzzy;
}

/**
 * Footer presentation required PH keys follow AI codegen:
 * parent definition placeholders first; else explicit/inferred keys from child packages.
 * Never invents the legacy four-band checklist
 * (`footer-signposts` / `footer-navigation` / `footer-social` / `footer-legal`).
 *
 * @param {{
 *   parentPlaceholderKeys?: string[],
 *   componentResults?: Array<object|null|undefined>,
 *   extractPlaceholderKeysFromDefinition?: (src: string) => string[],
 *   extractPlaceholderBasesFromTsx?: (src: string) => string[],
 * }} opts
 * @returns {string[]}
 */
export function resolvePartialFooterRequiredPlaceholders(opts = {}) {
  const {
    parentPlaceholderKeys = [],
    componentResults = [],
    extractPlaceholderKeysFromDefinition = null,
    extractPlaceholderBasesFromTsx = null,
  } = opts;

  const parent = [
    ...new Set(
      (parentPlaceholderKeys || [])
        .map((k) => toBasePlaceholderKey(toKebabCase(String(k || '').trim())))
        .filter(Boolean),
    ),
  ];
  if (parent.length) return parent;

  /** @type {Set<string>} */
  const keys = new Set();
  for (const c of componentResults || []) {
    if (String(c?.role || '') === 'section') continue;
    const explicit = toBasePlaceholderKey(
      toKebabCase(String(c?.placeholder || c?.placeholderKey || '').trim()),
    );
    if (explicit) keys.add(explicit);
    const inferred = resolveChildPlaceholder(c);
    if (inferred) keys.add(inferred);
    if (
      typeof extractPlaceholderKeysFromDefinition === 'function' &&
      c?.sources?.definition
    ) {
      for (const k of extractPlaceholderKeysFromDefinition(
        String(c.sources.definition),
      ) || []) {
        const b = toBasePlaceholderKey(toKebabCase(String(k || '').trim()));
        if (b) keys.add(b);
      }
    }
    if (
      typeof extractPlaceholderBasesFromTsx === 'function' &&
      c?.sources?.tsx
    ) {
      for (const k of extractPlaceholderBasesFromTsx(String(c.sources.tsx)) || []) {
        const b = toBasePlaceholderKey(toKebabCase(String(k || '').trim()));
        if (b) keys.add(b);
      }
    }
  }
  return [...keys];
}

/**
 * Placeholders that enrich/HTML evidence says must be present on a composite parent.
 * Pattern-driven (any ENRICH_COMPOSITE_PATTERNS match) — not hard-coded band names.
 * @param {{ sectionInfo?: object|null, sectionHtml?: string }} opts
 * @returns {string[]}
 */
export function collectRequiredPlaceholdersFromSection(opts = {}) {
  const { sectionInfo = null, sectionHtml = '' } = opts;
  /** @type {Set<string>} */
  const required = new Set();

  for (const stub of compositeChildrenFromEnrichRepeats(sectionInfo)) {
    const ph = toBasePlaceholderKey(toKebabCase(String(stub?.placeholder || '').trim()));
    if (ph) required.add(ph);
  }

  const pat = matchEnrichCompositePattern(sectionInfo);
  const html = String(sectionHtml || '');
  if (pat && html) {
    for (const role of pat.roles || []) {
      const ph = toBasePlaceholderKey(toKebabCase(String(role?.placeholder || '').trim()));
      if (!ph) continue;
      const phFlex = ph.replace(/-/g, '[-_\\s]?');
      const comp = String(role?.componentName || '');
      if (
        (role.repeat && role.repeat.test(html)) ||
        new RegExp(phFlex, 'i').test(html) ||
        (comp && new RegExp(comp, 'i').test(html))
      ) {
        required.add(ph);
      }
    }
    // Generic: "copyright" text implies any matched-pattern placeholder whose key contains "legal"
    if (/copyright/i.test(html)) {
      for (const role of pat.roles || []) {
        const ph = toBasePlaceholderKey(toKebabCase(String(role?.placeholder || '').trim()));
        if (ph && /legal/.test(ph)) required.add(ph);
      }
    }
  }

  return [...required];
}

/**
 * Ensure each required placeholder has a real child from componentResults.
 * Never invents definitionKeys. Warns only when evidence requires `ph` and no package covers it.
 * @param {{
 *   children?: Array<object>,
 *   componentResults?: Array<object>,
 *   requiredPlaceholders?: string[],
 *   parentKey?: string,
 *   logWarn?: (...args: any[]) => void,
 *   logInfo?: (...args: any[]) => void,
 * }} opts
 * @returns {Array<object>}
 */
export function ensureRequiredPlaceholdersFromResults(opts = {}) {
  const {
    children = [],
    componentResults = [],
    requiredPlaceholders = [],
    parentKey = '',
    logWarn = console.warn,
    logInfo = console.log,
  } = opts;
  let out = Array.isArray(children) ? [...children] : [];
  const parent = String(parentKey || '').trim();

  for (const rawPh of requiredPlaceholders || []) {
    const ph = toBasePlaceholderKey(toKebabCase(String(rawPh || '').trim()));
    if (!ph) continue;
    if (placeholderCovered(out, ph)) continue;

    const key = findPackageForPlaceholder(componentResults, ph, parent);
    if (key) {
      out = [
        ...out,
        {
          definitionKey: key,
          placeholder: ph,
        },
      ];
      // Backstop fill — expected when nesting already missed the slot; not an error.
      logInfo(
        `  · Presentation: wired "${ph}" → "${key}" under "${parent || '(unknown)'}"`,
      );
    } else {
      logWarn(
        `  ⚠ Presentation: skipped ghost "${ph}" under "${parent || '(unknown)'}" (no package in componentResults)`,
      );
    }
  }
  return out;
}

/**
 * Resolve plan placeholder key(s) + child definitionKeys for prompts / diagnostics.
 * @param {object|null|undefined} plan
 * @param {string|null|undefined} parentDefinitionKey
 * @returns {{
 *   mode: 'composite'|'single',
 *   placeholderKey: string|null,
 *   placeholderKeys: string[],
 *   slots: { key: string, childKeys: string[] }[],
 *   childKeys: string[],
 *   placeholdersLiteral: string,
 *   multiSlot: boolean,
 * }}
 */
export function resolvePlanPlaceholderContract(plan, parentDefinitionKey) {
  const parentKey = String(parentDefinitionKey || '').trim();
  const kids = Array.isArray(plan?.children) ? plan.children : [];
  const sectionKeys = Array.isArray(plan?.section?.placeholderKeys)
    ? plan.section.placeholderKeys
    : [];
  // Derive composite from children / placeholder keys — never planMode label.
  const mode =
    kids.length > 0 ||
    sectionKeys.length > 0 ||
    Boolean(
      String(plan?.section?.placeholderKey || plan?.placeholderKey || '').trim(),
    )
      ? 'composite'
      : 'single';
  /** @type {string[]} */
  const childKeys = [];
  for (const c of kids) {
    const k =
      String(c?.definitionKey || '').trim() ||
      toDefinitionKey(c?.componentName || '');
    if (k && k !== parentKey && !childKeys.includes(k)) childKeys.push(k);
  }
  if (mode === 'composite' && childKeys.length === 0) {
    const fallback =
      toDefinitionKey(kids[0]?.componentName || 'item') ||
      (parentKey ? `${parentKey}-item` : 'item');
    if (fallback && fallback !== parentKey) childKeys.push(fallback);
    else if (parentKey) childKeys.push(`${parentKey}-item`);
    else childKeys.push('item');
  }

  /** @type {Map<string, string[]>} */
  const controlsByPh = new Map();

  const addSlot = (rawKey, childKey) => {
    const key = toBasePlaceholderKey(toKebabCase(String(rawKey || '').trim()));
    if (!key) return;
    if (!controlsByPh.has(key)) controlsByPh.set(key, []);
    if (childKey && childKey !== parentKey) {
      const list = controlsByPh.get(key);
      if (!list.includes(childKey)) list.push(childKey);
    }
  };

  // Explicit multi-key list on the plan section
  for (const k of sectionKeys) {
    addSlot(typeof k === 'string' ? k : k?.key, null);
  }

  // Per-child placeholder / band inference
  for (const c of kids) {
    const childKey =
      String(c?.definitionKey || '').trim() ||
      toDefinitionKey(c?.componentName || '');
    const ph = inferPlanChildPlaceholderKey(c);
    if (ph) addSlot(ph, childKey);
  }

  // Single-track fallback (one child type, or no inferred bands yet)
  if (mode === 'composite' && controlsByPh.size === 0) {
    const primary = toBasePlaceholderKey(
      toKebabCase(
        plan?.section?.placeholderKey ||
          plan?.placeholderKey ||
          (parentKey ? `${parentKey}-items` : 'items'),
      ),
    );
    if (primary) {
      for (const ck of childKeys) addSlot(primary, ck);
    }
  }

  // If only one slot but children lacked keys, put all children on primary
  if (mode === 'composite' && controlsByPh.size === 1) {
    const onlyKey = [...controlsByPh.keys()][0];
    for (const ck of childKeys) {
      const list = controlsByPh.get(onlyKey);
      if (!list.includes(ck)) list.push(ck);
    }
  }

  // Heterogeneous auto-partition: ≥2 distinct child types stuck in one dump slot
  // (page-body stacked bands — nav grid + feature + USP grid). Same-type carousels
  // keep childKeys.length === 1 and stay single-track.
  if (
    mode === 'composite' &&
    childKeys.length >= 2 &&
    controlsByPh.size <= 1
  ) {
    controlsByPh.clear();
    for (const c of kids) {
      const childKey =
        String(c?.definitionKey || '').trim() ||
        toDefinitionKey(c?.componentName || '');
      if (!childKey || childKey === parentKey) continue;
      const ph = placeholderKeyForHeterogeneousChild(c, childKey);
      if (!ph) continue;
      addSlot(ph, childKey);
      // Stamp so presentation / compose-tree can resolve without footer heuristics
      if (c && typeof c === 'object' && !c.placeholder && !c.placeholderKey) {
        c.placeholder = ph;
      }
    }
  } else if (mode === 'composite' && controlsByPh.size > 1) {
    // Multi-slot already (footer/header/explicit): stamp missing child placeholders
    for (const c of kids) {
      if (!c || typeof c !== 'object') continue;
      if (c.placeholder || c.placeholderKey) continue;
      const childKey =
        String(c?.definitionKey || '').trim() ||
        toDefinitionKey(c?.componentName || '');
      if (!childKey || childKey === parentKey) continue;
      for (const [ph, list] of controlsByPh) {
        if (list.includes(childKey)) {
          c.placeholder = ph;
          break;
        }
      }
    }
  }

  const slots = [...controlsByPh.entries()].map(([key, ctrls]) => ({
    key,
    childKeys: ctrls.length ? ctrls : [...childKeys],
  }));

  const placeholderKeys = slots.map((s) => s.key);
  const multiSlot = placeholderKeys.length > 1;
  const placeholderKey = placeholderKeys[0] || null;

  // Keep section.placeholderKeys in sync when we auto-partitioned
  if (
    multiSlot &&
    plan?.section &&
    typeof plan.section === 'object' &&
    (!Array.isArray(plan.section.placeholderKeys) ||
      plan.section.placeholderKeys.length < 2)
  ) {
    plan.section.placeholderKeys = [...placeholderKeys];
  }

  let placeholdersLiteral = 'placeholders: [],';
  if (mode === 'composite' && slots.length === 1) {
    placeholdersLiteral = `placeholders: [{ key: "${slots[0].key}", allowedControls: ${JSON.stringify(slots[0].childKeys)} }],`;
  } else if (mode === 'composite' && slots.length > 1) {
    const parts = slots.map(
      (s) =>
        `{ key: "${s.key}", allowedControls: ${JSON.stringify(s.childKeys)} }`,
    );
    placeholdersLiteral = `placeholders: [${parts.join(', ')}],`;
  }

  return {
    mode,
    placeholderKey,
    placeholderKeys,
    slots,
    childKeys,
    placeholdersLiteral,
    multiSlot,
  };
}

/**
 * Exact definition + TSX AppPlaceholder contract for the codegen user message.
 * @param {{
 *   plan?: object|null,
 *   definitionKey?: string|null,
 *   role?: string|null,
 *   componentName?: string|null,
 *   nodeMode?: string|null,
 *   nodePlaceholderKey?: string|null,
 *   nodeChildren?: object[]|null,
 * }} opts
 * @returns {string}
 */
export function formatPlaceholderContractForPrompt(opts = {}) {
  const role = String(opts.role || '').toLowerCase();
  const definitionKey = String(opts.definitionKey || '').trim();
  const contract = resolvePlanPlaceholderContract(opts.plan, definitionKey);
  const nodeMode = String(opts.nodeMode || '').toLowerCase();

  // Nested composite child (e.g. Navigation under Header with its own placeholder children).
  if (role === 'child' && nodeMode === 'composite') {
    const ph =
      toBasePlaceholderKey(
        String(opts.nodePlaceholderKey || '').trim(),
      ) ||
      toBasePlaceholderKey(
        String(opts.componentName || definitionKey || 'items')
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase() + '-items',
      );
    const kids = Array.isArray(opts.nodeChildren) ? opts.nodeChildren : [];
    const allowed = kids
      .map((c) => toDefinitionKey(c?.componentName || c?.definitionKey || ''))
      .filter(Boolean);
    const allowedLit = JSON.stringify(allowed.length ? allowed : ['item']);
    return [
      '=== DEFINITION PLACEHOLDERS (hard — definitionTs) ===',
      `You are a NESTED COMPOSITE child (nodeMode=composite). Emit placeholders: [{ key: "${ph}", allowedControls: ${allowedLit} }],`,
      `TSX: const placeholderBase = '${ph}'; + AppPlaceholder name={phName} — match the key exactly.`,
      'Wrap AppPlaceholder in flex/grid matching your band — never bare.',
      'You still render only your band under the parent placeholder — not the whole section chrome.',
      'If definitionTs keeps placeholders: [] while presentation has children, authoring:generate fails (parent placeholders empty).',
    ].join('\n');
  }

  if (role === 'child') {
    const childName = String(opts.componentName || '').trim();
    const ownPh = inferPlanChildPlaceholderKey(
      (Array.isArray(opts.plan?.children) ? opts.plan.children : []).find(
        (c) =>
          toDefinitionKey(c?.componentName || '') === definitionKey ||
          String(c?.definitionKey || '') === definitionKey ||
          (childName &&
            (String(c?.componentName || '') === childName ||
              toDefinitionKey(c?.componentName || '') ===
                toDefinitionKey(childName))),
      ) || { definitionKey, componentName: childName },
    );
    return [
      '=== DEFINITION PLACEHOLDERS (hard — definitionTs) ===',
      'You are a CHILD package (nodeMode=single). Emit EXACTLY: placeholders: [],',
      'FORBIDDEN: AppPlaceholder, inventing placeholder keys, or allowedControls.',
      ownPh
        ? `You render into parent placeholder "${ownPh}" only — emit UI for that band/slot, not the whole section chrome.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (contract.mode !== 'composite' || !contract.placeholderKey) {
    return [
      '=== DEFINITION PLACEHOLDERS (hard — definitionTs) ===',
      'Leaf package (no child packages / placeholder keys). Emit EXACTLY: placeholders: [],',
      'FORBIDDEN: AppPlaceholder, placeholders:[…], inventing child definitionKeys for slots.',
    ].join('\n');
  }

  if (contract.multiSlot) {
    const keyList = contract.placeholderKeys.map((k) => `"${k}"`).join(', ');
    const tsxLines = [
      'const dynId = props.params?.DynamicPlaceholderId;',
      ...contract.placeholderKeys.map((ph) => {
        const ident =
          ph
            .split('-')
            .map((p, i) =>
              i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1),
            )
            .join('') + 'Ph';
        return [
          `const ${ident}Base = '${ph}';`,
          `const ${ident} = dynId ? \`\${${ident}Base}-\${dynId}\` : ${ident}Base;`,
          `<AppPlaceholder name={${ident}} rendering={props.rendering} page={props.page} componentMap={componentMap} />`,
        ].join('\n');
      }),
    ];
    return [
      '=== DEFINITION PLACEHOLDERS (hard — definitionTs) ===',
      'MULTI-SLOT parent. Emit EXACTLY this placeholders line (copy keys + allowedControls literally):',
      contract.placeholdersLiteral,
      `FORBIDDEN: collapsing to a single placeholder dump. You MUST declare ALL keys: [${keyList}].`,
      `FORBIDDEN: allowedControls including THIS definitionKey (${definitionKey || 'parent'}).`,
      'If definitionTs keeps placeholders: [] while presentation has children, authoring:generate fails (parent placeholders empty).',
      '',
      '=== TSX AppPlaceholder (hard — extractable, one mount per key) ===',
      'Mount ONE AppPlaceholder per placeholder key. Use extractable kebab bases (sync reads them):',
      ...tsxLines,
      'Wrap each AppPlaceholder in flex/grid matching that band in the crop — never bare; never one dump slot for all bands.',
    ].join('\n');
  }

  const ph = contract.placeholderKey;
  const childList = contract.childKeys.map((k) => `"${k}"`).join(', ');

  return [
    '=== DEFINITION PLACEHOLDERS (hard — definitionTs) ===',
    'Emit EXACTLY this placeholders line (copy the key + allowedControls literally):',
    contract.placeholdersLiteral,
    `FORBIDDEN: allowedControls including THIS definitionKey (${definitionKey || 'parent'}).`,
    `FORBIDDEN: inventing a different placeholder key than "${ph}".`,
    `allowedControls MUST be exactly [${childList}] (prefixed child definitionKeys from the plan).`,
    'If definitionTs keeps placeholders: [] while presentation has children, authoring:generate fails (parent placeholders empty).',
    '',
    '=== TSX AppPlaceholder (hard — extractable) ===',
    'Use this canonical pattern so sync can read the base key (do not invent opaque helpers):',
    `const placeholderBase = '${ph}';`,
    'const dynId = props.params?.DynamicPlaceholderId;',
    'const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;',
    '<AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />',
    `definition.placeholders[].key MUST equal placeholderBase ('${ph}').`,
    'Wrap AppPlaceholder in flex/grid/snap-x matching the crop — never bare.',
  ].join('\n');
}

/**
 * Canonical TSX snippet string for tests / docs.
 * @param {string} placeholderKey
 * @returns {string}
 */
export function canonicalPlaceholderTsxSnippet(placeholderKey) {
  const ph = toBasePlaceholderKey(String(placeholderKey || '').trim());
  return [
    `const placeholderBase = '${ph}';`,
    'const dynId = props.params?.DynamicPlaceholderId;',
    'const phName = dynId ? `${placeholderBase}-${dynId}` : placeholderBase;',
    '<AppPlaceholder name={phName} rendering={props.rendering} page={props.page} componentMap={componentMap} />',
  ].join('\n');
}

/**
 * Detect-only placeholder / definition diagnostics for the validate loop.
 * @param {{
 *   tsx?: string|null,
 *   clientTsx?: string|null,
 *   definitionTs?: string|null,
 *   plan?: object|null,
 *   childPackages?: Array<object>|null,
 *   definitionKey?: string|null,
 *   role?: string|null,
 *   trustTsxStructure?: boolean,
 * }} opts
 * @returns {string[]}
 */
export function collectPlaceholderContractDiagnostics(opts = {}) {
  const mapEntry = String(opts.tsx || '');
  const clientTsx = String(opts.clientTsx || '');
  const tsx = unionStructureTsxSources(mapEntry, clientTsx);
  const definitionTs = String(opts.definitionTs || '');
  const role = String(opts.role || '').toLowerCase();
  const definitionKey = String(opts.definitionKey || '').trim();
  const nodeMode = String(opts.nodeMode || '').toLowerCase();
  const trustTsx = Boolean(opts.trustTsxStructure);
  const hasAppPlaceholder = hasAppPlaceholderInSources(mapEntry, clientTsx);
  const extracted = extractPlaceholderBasesFromTsx(tsx);
  // Structure from packages + TSX only — never capture/runtime "plan" children.
  const packChildren = Array.isArray(opts.childPackages) ? opts.childPackages : [];
  const childPhKeys = extractPlaceholderBasesFromChildren(packChildren);
  /** @type {string[]} */
  const childDefKeys = [];
  for (const c of packChildren) {
    const k =
      String(c?.definitionKey || '').trim() ||
      toDefinitionKey(c?.componentName || '');
    if (k && k !== definitionKey && !childDefKeys.includes(k)) childDefKeys.push(k);
  }
  const expectedPhKeys = [...new Set([...extracted, ...childPhKeys])];
  const multiSlot = expectedPhKeys.length > 1;
  const placeholdersHint =
    expectedPhKeys.length === 0
      ? 'placeholders: [{ key: "<kebab-base>", allowedControls: [<child-definitionKey>] }],'
      : expectedPhKeys.length === 1
        ? `placeholders: [{ key: "${expectedPhKeys[0]}", allowedControls: ${JSON.stringify(childDefKeys.length ? childDefKeys : ['<child-definitionKey>'])} }],`
        : `placeholders: [${expectedPhKeys
            .map(
              (k) =>
                `{ key: "${k}", allowedControls: ${JSON.stringify(childDefKeys.length ? childDefKeys : ['<child-definitionKey>'])} }`,
            )
            .join(', ')}],`;

  /** Effective mode from TSX / packages (nodeMode only when set for nested hosts). */
  let effectiveMode =
    nodeMode === 'composite' || nodeMode === 'single'
      ? nodeMode
      : role === 'child'
        ? 'single'
        : 'single';
  if (trustTsx) {
    if (hasAppPlaceholder || extracted.length > 0) {
      effectiveMode = 'composite';
    } else if (role === 'child') {
      effectiveMode = 'single';
    } else if (childPhKeys.length > 0) {
      effectiveMode = 'composite';
    } else if (mapEntry.trim() || clientTsx.trim()) {
      effectiveMode = 'single';
    }
  } else if (
    (mapEntry.trim() || clientTsx.trim()) &&
    !hasAppPlaceholder &&
    extracted.length === 0 &&
    childPhKeys.length === 0
  ) {
    effectiveMode = 'single';
  } else if (hasAppPlaceholder || extracted.length > 0 || childPhKeys.length > 0) {
    effectiveMode = 'composite';
  }
  /** @type {string[]} */
  const out = [];

  const defPlaceholdersMatch = definitionTs.match(
    /\bplaceholders\s*:\s*\[([\s\S]*?)\]/,
  );
  const defPhBody = defPlaceholdersMatch ? defPlaceholdersMatch[1] || '' : '';
  const defHasKeys = /key\s*:/.test(defPhBody);

  // Child packages declare host keys → parent definition must host them.
  if (role !== 'child' && childPhKeys.length > 0 && !defHasKeys) {
    out.push(
      `CONTRACT: child placeholderKey(s) [${childPhKeys.join(', ')}] require parent definitionTs placeholders with matching keys + allowedControls — never placeholders: [] (AppPlaceholder may live in clientTsx; definition must still declare the host)`,
    );
  }

  if (effectiveMode !== 'composite') {
    if (hasAppPlaceholder) {
      out.push(
        'CONTRACT: AppPlaceholder in TSX requires definition placeholders with keys (TSX structure is authoritative)',
      );
    }
    if (defHasKeys && !trustTsx) {
      out.push(
        'CONTRACT: leaf package definitionTs must use placeholders: [] — remove placeholder keys',
      );
    }
    if (defHasKeys && trustTsx && !hasAppPlaceholder) {
      out.push(
        'CONTRACT: definitionTs has placeholders but TSX has no AppPlaceholder — add AppPlaceholder or clear placeholders: []',
      );
    }
    return out.map((m) => (m.startsWith('CONTRACT:') ? m : `CONTRACT: ${m}`));
  }

  // Nested composite child: require AppPlaceholder + keys (same as parent composite).
  if (role === 'child' && effectiveMode === 'composite') {
    if (!hasAppPlaceholder) {
      out.push(
        'CONTRACT: nested composite child requires AppPlaceholder + matching placeholders[]',
      );
    }
    if (!defHasKeys) {
      out.push(
        'CONTRACT: nested composite child definitionTs must declare placeholders with keys',
      );
    }
    if (hasAppPlaceholder && extracted.length === 0) {
      out.push(
        'CONTRACT: AppPlaceholder present but no extractable placeholderBase — use const placeholderBase = \'<kebab-key>\'',
      );
    }
    return out.map((m) => (m.startsWith('CONTRACT:') ? m : `CONTRACT: ${m}`));
  }

  // Composite parent — expected slots from TSX extract + child packages only.
  if (hasAppPlaceholder && extracted.length === 0) {
    const hint =
      childPhKeys.length > 0
        ? ` — use extractable kebab bases for package keys [${childPhKeys.join(', ')}]`
        : " — use const placeholderBase = '<kebab-key>'";
    out.push(
      `CONTRACT: AppPlaceholder present but no extractable placeholderBase${hint}`,
    );
  }

  if (hasAppPlaceholder && extracted.length > 0 && childPhKeys.length > 0) {
    const expected = new Set(childPhKeys);
    const unexpected = extracted.filter((k) => !expected.has(k));
    const missing = [...expected].filter((k) => !extracted.includes(k));
    if (multiSlot || childPhKeys.length > 1) {
      if (missing.length) {
        out.push(
          `CONTRACT: multi-slot parent missing AppPlaceholder base(s) [${missing.join(', ')}] — mount one AppPlaceholder per package key [${[...expected].join(', ')}] (got [${extracted.join(', ')}])`,
        );
      }
      if (unexpected.length) {
        out.push(
          `CONTRACT: AppPlaceholder bases [${unexpected.join(', ')}] are not in child package keys — use only [${[...expected].join(', ')}]`,
        );
      }
    } else if (!extracted.includes(childPhKeys[0])) {
      out.push(
        `CONTRACT: AppPlaceholder base(s) [${extracted.join(', ')}] must include package placeholderKey "${childPhKeys[0]}" — set const placeholderBase = '${childPhKeys[0]}'`,
      );
    }
  }

  if (definitionKey && definitionTs) {
    const selfInAllowed = new RegExp(
      `allowedControls\\s*:\\s*\\[[^\\]]*["']${definitionKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    ).test(definitionTs);
    if (selfInAllowed) {
      const want =
        childDefKeys.length > 0 ? childDefKeys.join(', ') : '<child-definitionKey>';
      out.push(
        `CONTRACT: definitionTs allowedControls must not include own definitionKey "${definitionKey}" — use child key(s): [${want}]`,
      );
    }
  }

  if (effectiveMode === 'composite') {
    // Hollow leaf: no AppPlaceholder and no child PH keys — do not demand AppPlaceholder.
    const hollowLeaf = !hasAppPlaceholder && childPhKeys.length === 0;
    if (!hasAppPlaceholder && defHasKeys && !hollowLeaf) {
      out.push(
        `CONTRACT: composite definition has placeholders but TSX has no AppPlaceholder — add AppPlaceholder for [${expectedPhKeys.join(', ') || childPhKeys.join(', ')}] OR emit placeholders: [] only if this must be a leaf`,
      );
    }
    if (hasAppPlaceholder && !defHasKeys) {
      out.push(
        `CONTRACT: AppPlaceholder in tsx/clientTsx but definitionTs has placeholders: [] — emit ${placeholdersHint} (client host does not make the parent a leaf)`,
      );
    }

    // Child keys present but definition missing some declared bases
    if (childPhKeys.length > 0 && defHasKeys) {
      const declared = new Set(extractPlaceholderKeysFromDefinition(definitionTs));
      const missingChild = childPhKeys.filter((k) => !declared.has(k));
      if (missingChild.length) {
        out.push(
          `CONTRACT: parent definitionTs missing placeholders for child key(s) [${missingChild.join(', ')}] — add matching placeholders[].key + allowedControls`,
        );
      }
    }
    // Hollow host: AppPlaceholder + placeholder key but allowedControls: []
    if (
      role !== 'child' &&
      hasAppPlaceholder &&
      defHasKeys &&
      /allowedControls\s*:\s*\[\s*\]/.test(definitionTs)
    ) {
      const want =
        childDefKeys.length > 0
          ? childDefKeys.join(', ')
          : 'real child definitionKey(s)';
      out.push(
        `CONTRACT: placeholders declare key(s) with empty allowedControls — add child definitionKey(s) [${want}] (AppPlaceholder host cannot ship without Allowed Controls)`,
      );
    }
    // Orphan siblings: child packages on this host must appear in allowedControls.
    if (role !== 'child' && hasAppPlaceholder && defHasKeys) {
      const parentPhKeys = new Set(extractPlaceholderKeysFromDefinition(definitionTs));
      const allowed = new Set(extractAllowedControlKeysFromDefinition(definitionTs));
      const packDefKeys = new Set(childDefKeys);
      /** @type {string[]} */
      const orphanKeys = [];
      for (const c of packChildren) {
        const key = String(c?.definitionKey || '').trim();
        if (!key || key === definitionKey || allowed.has(key)) continue;
        const ph = String(c?.placeholderKey || c?.parentPlaceholder || '').trim();
        const belongsOnParent =
          (ph && parentPhKeys.has(ph)) || (!ph && packDefKeys.has(key));
        if (belongsOnParent && !orphanKeys.includes(key)) orphanKeys.push(key);
      }
      if (orphanKeys.length) {
        out.push(
          `CONTRACT: orphan child package(s) [${orphanKeys.join(', ')}] not in parent allowedControls — attach each to the matching placeholders[].allowedControls (hollow host / unattached sibling)`,
        );
      }
    }
  }

  return out.map((m) => (m.startsWith('CONTRACT:') ? m : `CONTRACT: ${m}`));
}

/**
 * Detect Project rendering Path-leaf / identity copy-paste bugs across sibling
 * definitions. Shared `itemTemplate.name` is allowed (same data architecture);
 * Path leaf comes from unbranded `componentName` stem (or explicit
 * `renderingPathLeaf`).
 *
 * @param {{
 *   definitionKey: string,
 *   name?: string,
 *   componentName?: string,
 *   renderingPathLeaf?: string,
 *   codePrefix?: string,
 *   itemTemplateName?: string,
 * }[]} defs
 * @param {{ codePrefix?: string }} [opts]
 * @returns {string[]}
 */
export function collectPathLeafCollisionDiagnostics(defs, opts = {}) {
  /** @type {string[]} */
  const out = [];
  const list = Array.isArray(defs) ? defs : [];
  const defaultPrefix = String(opts.codePrefix || '').trim();
  /** @type {Map<string, string[]>} */
  const byLeaf = new Map();
  /** @type {Map<string, string>} */
  const keyToName = new Map();

  for (const d of list) {
    const key = String(d?.definitionKey || '').trim();
    if (!key) continue;
    const name = String(d?.name || '').trim();
    const prefix = String(d?.codePrefix || defaultPrefix || '').trim();
    const leaf =
      String(d?.renderingPathLeaf || '').trim() ||
      displayNameFromComponentName(String(d?.componentName || '').trim(), prefix);
    keyToName.set(key, name);
    if (leaf) {
      const arr = byLeaf.get(leaf) || [];
      arr.push(key);
      byLeaf.set(leaf, arr);
    }
  }

  for (const [leaf, keys] of byLeaf) {
    if (keys.length < 2) continue;
    out.push(
      `CONTRACT: rendering Path leaf "${leaf}" shared by [${keys.join(', ')}] — each distinct display/TSX needs a unique componentName stem (shared itemTemplate.name is OK)`,
    );
  }

  for (const [key, name] of keyToName) {
    if (!name || name === key) continue;
    if (keyToName.has(name) && name !== key) {
      out.push(
        `CONTRACT: definition "${key}" name "${name}" copies sibling definitionKey — set name to "${key}"`,
      );
    }
  }

  return out;
}
