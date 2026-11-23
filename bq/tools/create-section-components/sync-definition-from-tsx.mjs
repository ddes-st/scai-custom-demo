/**
 * TSX is authoritative for single vs composite + placeholder keys.
 * Force-sync definition.placeholders (including overwriting `placeholders: []`).
 */
import { toBasePlaceholderKey, toDefinitionKey, toKebabCase } from './naming.mjs';

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizePhBase(raw) {
  return toBasePlaceholderKey(
    String(raw || '')
      .trim()
      // `key-${id}` / `key-{${id}}` / `key-{*}` / `key-{1}`
      .replace(/-\{\$\{[^}]+\}\}/, '')
      .replace(/-\$\{[^}]+\}/, '')
      .replace(/-\{\*\}$/, '')
      .replace(/-\{\d+\}$/, '')
      .replace(/-\d+$/, ''),
  );
}

/**
 * Pull placeholder keys already present on a definition.ts source.
 * @param {string} definitionTs
 * @returns {string[]}
 */
export function extractPlaceholderKeysFromDefinition(definitionTs) {
  const text = String(definitionTs || '');
  /** @type {string[]} */
  const keys = [];
  const re = /\{\s*key\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) {
    const base = normalizePhBase(m[1]);
    if (base && KEBAB_RE.test(base) && !keys.includes(base)) keys.push(base);
  }
  return keys;
}

/**
 * Concatenate map-entry + companion client sources for AppPlaceholder / base extract.
 * Client hosts (e.g. header context-links) are invisible if only map-entry is scanned.
 * @param {string|null|undefined} tsx
 * @param {string|null|undefined} clientTsx
 * @returns {string}
 */
export function unionStructureTsxSources(tsx, clientTsx) {
  const main = String(tsx || '').trim();
  const client = String(clientTsx || '').trim();
  if (main && client) return `${main}\n\n/* === clientTsx === */\n${client}`;
  return main || client || '';
}

/**
 * True when map-entry or client companion mounts AppPlaceholder.
 * @param {string|null|undefined} tsx
 * @param {string|null|undefined} clientTsx
 * @returns {boolean}
 */
export function hasAppPlaceholderInSources(tsx, clientTsx) {
  const blob = unionStructureTsxSources(tsx, clientTsx);
  // JSX mount only — unused `import { AppPlaceholder }` must not force composite.
  return /<AppPlaceholder\b/.test(blob);
}

/**
 * Placeholder bases declared on plan/package children (placeholderKey / parentPlaceholder).
 * @param {Array<object|null|undefined>|null|undefined} children
 * @returns {string[]}
 */
export function extractPlaceholderBasesFromChildren(children) {
  /** @type {string[]} */
  const keys = [];
  for (const c of children || []) {
    if (!c || typeof c !== 'object') continue;
    for (const raw of [
      c.placeholderKey,
      c.placeholder,
      c.parentPlaceholder,
    ]) {
      const base = normalizePhBase(raw);
      if (base && KEBAB_RE.test(base) && !keys.includes(base)) keys.push(base);
    }
  }
  return keys;
}

/**
 * Scan templates for placeholder base patterns.
 * @param {string} blob
 * @param {(raw: string) => void} add
 * @param {Map<string, string>} [kebabConsts]
 */
function addBasesFromTemplates(blob, add, kebabConsts) {
  const text = String(blob || '');
  // `` `key-${dynId}` ``
  for (const tm of text.matchAll(
    /`([a-z0-9]+(?:-[a-z0-9]+)*)-\$\{[^}]+\}`/gi,
  )) {
    add(tm[1]);
  }
  // Sitecore brace dyn: `` `key-{${dynId}}` ``
  for (const tm of text.matchAll(
    /`([a-z0-9]+(?:-[a-z0-9]+)*)-\{\$\{[^}]+\}\}`/gi,
  )) {
    add(tm[1]);
  }
  // `` `${baseKey}-${dynId}` `` / `` `${baseKey}-{${dynId}}` ``
  for (const tm of text.matchAll(
    /`\$\{([A-Za-z_][\w]*)\}-\$\{[^}]+\}`/g,
  )) {
    const v = kebabConsts?.get(tm[1]);
    if (v) add(v);
  }
  for (const tm of text.matchAll(
    /`\$\{([A-Za-z_][\w]*)\}-\{\$\{[^}]+\}\}`/g,
  )) {
    const v = kebabConsts?.get(tm[1]);
    if (v) add(v);
  }
}

/**
 * Scan a const RHS for templates + else-branch string/idents (assign hop only).
 * @param {string} rhs
 * @param {(raw: string) => void} add
 * @param {Map<string, string>} [kebabConsts]
 */
function addBasesFromAssignRhs(rhs, add, kebabConsts) {
  addBasesFromTemplates(rhs, add, kebabConsts);
  for (const tm of String(rhs || '').matchAll(
    /(['"`])([a-z0-9]+(?:-[a-z0-9]+)*)\1/gi,
  )) {
    add(tm[2]);
  }
  for (const tm of String(rhs || '').matchAll(/:\s*([A-Za-z_][\w]*)\b/g)) {
    const v = kebabConsts?.get(tm[1]);
    if (v) add(v);
  }
}

/**
 * Collect `const ident = 'kebab-case'` (and let / var) string literals.
 * @param {string} text
 * @returns {Map<string, string>}
 */
function collectKebabStringConsts(text) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const m of text.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=\s*(['"`])([a-z0-9]+(?:-[a-z0-9]+)*)\2/gi,
  )) {
    const ident = m[1];
    const value = m[3];
    if (ident && value && KEBAB_RE.test(value)) {
      map.set(ident, value);
    }
  }
  return map;
}

/**
 * Extract placeholder base keys from composite parent TSX.
 * Supports:
 * - `const placeholderBase = 'feature-tiles'` / `const baseKey = '…'`
 * - `const phName = dynId ? \`…-${dynId}\` : baseKey` (one-hop via baseKey)
 * - `const x = dynId ? \`footer-signposts-${dynId}\` : 'footer-signposts'`
 * - `<AppPlaceholder name="hero-actions" …>` / name={'hero-actions'}
 * - `name={\`hero-actions-${dynId}\`}` / `name={phName}` / `name={baseKey}`
 * - `placeholderName('footer-signposts')`
 * - `renderPlaceholder('insured-links')` (string-literal helper calls)
 *
 * @param {string} tsx
 * @returns {string[]} unique base keys (no -{*})
 */
/**
 * True when source mounts Sitecore placeholders (not DOM id template literals).
 * @param {string} text
 */
function tsxHasPlaceholderHostSignal(text) {
  const t = String(text || '');
  return (
    /\bAppPlaceholder\b/.test(t) ||
    /\brenderPlaceholder\s*\(/.test(t) ||
    /\bplaceholderName\s*\(/.test(t)
  );
}

export function extractPlaceholderBasesFromTsx(tsx) {
  const text = String(tsx || '');
  if (!text.trim()) return [];
  /** @type {Set<string>} */
  const keys = new Set();

  const add = (raw) => {
    const base = normalizePhBase(raw);
    if (base && KEBAB_RE.test(base)) keys.add(base);
  };

  const kebabConsts = collectKebabStringConsts(text);
  const hasHostSignal = tsxHasPlaceholderHostSignal(text);

  // Prefer well-known names, but any kebab const is eligible once referenced.
  for (const [ident, value] of kebabConsts) {
    if (
      /^(?:placeholderBase|baseKey|phBase|phKey|placeholderKey)$/i.test(ident)
    ) {
      add(value);
    }
  }

  for (const m of text.matchAll(
    /\bplaceholderBase\s*=\s*(['"`])([^'"`]+)\1/g,
  )) {
    add(m[2]);
  }

  // AppPlaceholder name="…" / name={'…'} / name={"…"}
  for (const m of text.matchAll(
    /<AppPlaceholder\b[^>]*\bname\s*=\s*(?:\{\s*)?(['"`])([^'"`]+)\1/gi,
  )) {
    add(m[2]);
  }

  // AppPlaceholder name={ident} / name={ phName }
  // Also renderPlaceholder(ident) wrappers used by some parents.
  const phNameIdents = new Set();
  for (const m of text.matchAll(
    /<AppPlaceholder\b[^>]*\bname\s*=\s\{\s*([A-Za-z_][\w]*)\s*\}/gi,
  )) {
    phNameIdents.add(m[1]);
  }
  for (const m of text.matchAll(
    /\brenderPlaceholder\s*\(\s*([A-Za-z_][\w]*)\s*\)/g,
  )) {
    phNameIdents.add(m[1]);
  }
  for (const ident of phNameIdents) {
    const fromConst = kebabConsts.get(ident);
    if (fromConst) {
      add(fromConst);
      continue;
    }
    // Trace one-hop: const phName = … ? `${baseKey}-…` / `base-{${id}}` : baseKey
    const assignRe = new RegExp(
      `\\b(?:const|let|var)\\s+${ident}\\s*=\\s*([^;]+)`,
      'i',
    );
    const assign = assignRe.exec(text);
    if (assign) {
      addBasesFromAssignRhs(assign[1], add, kebabConsts);
    }
  }

  // placeholderName('footer-signposts') / renderPlaceholder('insured-links')
  for (const m of text.matchAll(
    /\b(?:placeholderName|renderPlaceholder)\s*\(\s*(['"`])([^'"`]+)\1\s*\)/gi,
  )) {
    add(m[2]);
  }

  // Global `` `kebab-${dyn}` `` harvest is host-only — DOM ids like
  // `` id={`cookie-option-${index}`} `` must not invent placeholder keys.
  if (hasHostSignal) {
    // const foo = dynId ? `key-${dynId}` : 'key'
    for (const m of text.matchAll(
      /=\s*(?:\w+\s*\?\s*)?`([a-z0-9]+(?:-[a-z0-9]+)*)-\$\{[^}]+\}`\s*:\s*(['"`])\1\2/gi,
    )) {
      add(m[1]);
    }

    addBasesFromTemplates(text, add, kebabConsts);

    for (const m of text.matchAll(
      /`\$\{([A-Za-z_][\w]*)\}-\$\{[^}]+\}`/g,
    )) {
      const fromConst = kebabConsts.get(m[1]);
      if (fromConst) add(fromConst);
    }
    for (const m of text.matchAll(
      /`\$\{([A-Za-z_][\w]*)\}-\{\$\{[^}]+\}\}`/g,
    )) {
      const fromConst = kebabConsts.get(m[1]);
      if (fromConst) add(fromConst);
    }

    for (const m of text.matchAll(
      /`[^`]*\$\{[^}]+\}`\s*:\s*([A-Za-z_][\w]*)\b/g,
    )) {
      const fromConst = kebabConsts.get(m[1]);
      if (fromConst) add(fromConst);
    }

    for (const [ident, value] of kebabConsts) {
      const usedInTemplate = new RegExp(
        `\\$\\{\\s*${ident}\\s*\\}`,
      ).test(text);
      const usedAsName = new RegExp(
        `<AppPlaceholder\\b[^>]*\\bname\\s*=\\s*\\{\\s*${ident}\\s*\\}`,
        'i',
      ).test(text);
      const usedInTernaryElse = new RegExp(
        `:\\s*${ident}\\b`,
      ).test(text);
      if (usedInTemplate || usedAsName || usedInTernaryElse) add(value);
    }
  }

  return [...keys];
}

/**
 * Placeholder bases from decompose plan when TSX extract fails.
 * @param {object|null|undefined} plan
 * @returns {string[]}
 */
export function extractPlaceholderBasesFromPlan(plan) {
  /** @type {Set<string>} */
  const keys = new Set();
  const add = (raw) => {
    const base = normalizePhBase(raw);
    if (base && KEBAB_RE.test(base)) keys.add(base);
  };

  add(plan?.section?.placeholderKey);
  add(plan?.section?.placeholder);
  add(plan?.placeholderKey);
  add(plan?.placeholder);

  const sectionKeys = Array.isArray(plan?.section?.placeholderKeys)
    ? plan.section.placeholderKeys
    : Array.isArray(plan?.placeholderKeys)
      ? plan.placeholderKeys
      : [];
  for (const k of sectionKeys) add(k);

  const kids = Array.isArray(plan?.children) ? plan.children : [];
  for (const c of kids) {
    add(c?.placeholder);
    add(c?.placeholderKey);
  }

  // layoutSketch — authoritative multi-slot keys from the same AI response
  const sketch = plan?.layoutSketch;
  const renderings = Array.isArray(sketch?.renderings) ? sketch.renderings : [];
  for (const r of renderings) {
    const ph = r?.placeholders;
    if (!ph || typeof ph !== 'object') continue;
    for (const k of Object.keys(ph)) add(k);
  }

  if (keys.size === 0 && kids.length > 0) {
    const fromSection =
      toDefinitionKey(
        plan?.section?.componentName || plan?.componentName || '',
      ) || '';
    if (fromSection) add(`${fromSection}-items`);
  }

  return [...keys];
}

/**
 * @param {string} tsx
 * @returns {'single'|'composite'}
 */
export function inferPlanModeFromTsx(tsx) {
  const text = String(tsx || '');
  if (/<AppPlaceholder\b/.test(text) || /\bAppPlaceholder\b/.test(text)) {
    return 'composite';
  }
  return 'single';
}

/**
 * Replace `placeholders: […]` in a definition source (handles nested brackets).
 * @param {string} source
 * @param {string} placeholdersLiteral — e.g. `[]` or `[{ key: "x", allowedControls: ["y"] }]`
 * @returns {string}
 */
export function replacePlaceholdersArray(source, placeholdersLiteral) {
  let text = String(source || '');
  const lit = String(placeholdersLiteral || '[]').trim();
  const key = text.match(/\bplaceholders\s*:\s*/);
  if (!key || key.index == null) {
    // Insert before variants if present
    if (/\bvariants\s*:\s*\[/.test(text)) {
      return text.replace(
        /\bvariants\s*:\s*\[/,
        `placeholders: ${lit},\n  variants: [`,
      );
    }
    // Append before closing of object — best-effort before `} satisfies`
    if (/\}\s*satisfies\b/.test(text)) {
      return text.replace(
        /\}\s*satisfies\b/,
        `  placeholders: ${lit},\n} satisfies`,
      );
    }
    return text;
  }
  const open = text.indexOf('[', key.index + key[0].length - 1);
  if (open < 0) return text;
  let depth = 0;
  let close = -1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return text;
  let end = close + 1;
  const after = text.slice(end);
  const comma = after.match(/^\s*,/);
  if (comma) end += comma[0].length;
  const replacement = comma ? `placeholders: ${lit},` : `placeholders: ${lit}`;
  return text.slice(0, key.index) + replacement + text.slice(end);
}

/**
 * Union plan.children with childPackages for allowedControls fill (dedupe by definitionKey).
 * @param {object|null|undefined} plan
 * @param {Array<object>|null|undefined} childPackages
 * @returns {object|null|undefined}
 */
export function planWithChildPackages(plan, childPackages) {
  const fromPlan = Array.isArray(plan?.children) ? plan.children : [];
  const fromPkgs = Array.isArray(childPackages) ? childPackages : [];
  if (!fromPkgs.length) return plan;
  const seen = new Set(
    fromPlan.map((c) => String(c?.definitionKey || '').trim()).filter(Boolean),
  );
  const merged = [...fromPlan];
  for (const c of fromPkgs) {
    if (!c || typeof c !== 'object') continue;
    const k = String(c.definitionKey || '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(c);
  }
  return { ...(plan && typeof plan === 'object' ? plan : {}), children: merged };
}

/**
 * Map plan children → allowedControls per placeholder key.
 * Never invents ghost `"item"` — empty slots stay empty until a real child key maps.
 * @param {object|null|undefined} plan
 * @param {string[]} tsxKeys
 * @param {{ ownDefinitionKey?: string|null }} [options]
 * @returns {Record<string, string[]>}
 */
export function buildAllowedControlsByPlaceholder(plan, tsxKeys, options = {}) {
  /** @type {Record<string, string[]>} */
  const byPh = {};
  for (const k of tsxKeys) byPh[k] = [];

  const kids = Array.isArray(plan?.children) ? plan.children : [];
  const singleKey = tsxKeys.length === 1 ? tsxKeys[0] : null;
  const ownKey = String(options.ownDefinitionKey || '').trim();

  for (const c of kids) {
    const defKey =
      String(c?.definitionKey || '').trim() ||
      toDefinitionKey(c?.componentName || '');
    if (!defKey) continue;
    // Never nest a rendering inside itself via Allowed Controls.
    if (ownKey && defKey === ownKey) continue;
    let ph = toBasePlaceholderKey(String(c?.placeholder || c?.placeholderKey || '').trim());
    if (!ph) {
      // Prefer declared TSX keys — never invent legacy four-band PH names.
      if (singleKey) ph = singleKey;
      else if (
        tsxKeys.includes(defKey) ||
        tsxKeys.some((k) => defKey.endsWith(`-${k}`) || k.endsWith(defKey))
      ) {
        ph =
          tsxKeys.find(
            (k) => defKey.endsWith(`-${k}`) || k.endsWith(defKey) || k === defKey,
          ) || null;
      } else {
        ph = toBasePlaceholderKey(toKebabCase(String(c?.componentName || defKey || '')));
      }
    }
    // Fuzzy: child placeholder aliases onto a declared TSX key
    if (ph && !byPh[ph] && tsxKeys.length) {
      const fuzzy = tsxKeys.find(
        (k) =>
          k === ph ||
          k.endsWith(`-${ph}`) ||
          ph.endsWith(`-${k}`) ||
          (k.includes(ph) && ph.length >= 4) ||
          (ph.includes(k) && k.length >= 4),
      );
      if (fuzzy) ph = fuzzy;
    }
    if (ph && byPh[ph]) {
      byPh[ph].push(defKey);
    } else if (singleKey && byPh[singleKey]) {
      byPh[singleKey].push(defKey);
    }
  }

  // Ensure every TSX key has at least one control when plan has children
  if (kids.length && singleKey && byPh[singleKey]?.length === 0) {
    const first =
      String(kids[0]?.definitionKey || '').trim() ||
      toDefinitionKey(kids[0]?.componentName || '');
    if (first && (!ownKey || first !== ownKey)) byPh[singleKey].push(first);
  }

  // Multi-slot backfill: assign unmapped kids to still-empty bands (stable order)
  const unmapped = kids
    .map((c) =>
      String(c?.definitionKey || '').trim() ||
      toDefinitionKey(c?.componentName || ''),
    )
    .filter(Boolean)
    .filter((k) => !ownKey || k !== ownKey)
    .filter((k) => ![...Object.values(byPh)].some((list) => list.includes(k)));
  if (unmapped.length) {
    for (const k of Object.keys(byPh)) {
      if (byPh[k].length) continue;
      const next = unmapped.shift();
      if (next) byPh[k].push(next);
    }
  }

  for (const k of Object.keys(byPh)) {
    // Strip accidental ghost "item" if real children exist elsewhere;
    // never keep own definitionKey (self-nest).
    byPh[k] = [
      ...new Set(
        byPh[k].filter((c) => c && c !== 'item' && (!ownKey || c !== ownKey)),
      ),
    ];
  }
  return byPh;
}

/**
 * Rewrite ghost `allowedControls: ["item"]` (and empty ghosts) to real child keys.
 * @param {string} definitionTs
 * @param {Record<string, string[]>|null|undefined} controlsByPh
 * @returns {string}
 */
export function rewriteGhostItemAllowedControls(definitionTs, controlsByPh) {
  let text = String(definitionTs || '');
  if (!controlsByPh || typeof controlsByPh !== 'object') return text;
  const keys = Object.keys(controlsByPh);
  if (!keys.length) return text;
  const byPh = buildAllowedControlsByPlaceholder(
    {
      children: keys.flatMap((ph) =>
        (controlsByPh[ph] || []).map((definitionKey) => ({
          definitionKey,
          placeholder: ph,
        })),
      ),
    },
    keys,
  );
  // Also accept direct map
  for (const [ph, ctrls] of Object.entries(controlsByPh)) {
    if (!byPh[ph]) byPh[ph] = [];
    for (const c of ctrls || []) {
      if (c && c !== 'item' && !byPh[ph].includes(c)) byPh[ph].push(c);
    }
  }
  const phLiteral = keys
    .map((k) => {
      const ctrls = (byPh[k] || []).filter((c) => c && c !== 'item');
      return `{ key: "${k}", allowedControls: ${JSON.stringify(ctrls)} }`;
    })
    .join(', ');
  return replacePlaceholdersArray(text, `[${phLiteral}]`);
}

/**
 * @param {string} definitionTs
 * @returns {string}
 */
function extractOwnDefinitionKey(definitionTs) {
  const m = String(definitionTs || '').match(
    /\bdefinitionKey\s*:\s*['"]([^'"]+)['"]/,
  );
  return m ? String(m[1] || '').trim() : '';
}

/**
 * Pull existing placeholders[].allowedControls from a definition source.
 * @param {string} definitionTs
 * @returns {Record<string, string[]>}
 */
export function extractAllowedControlsByPlaceholder(definitionTs) {
  /** @type {Record<string, string[]>} */
  const out = {};
  const text = String(definitionTs || '');
  const re =
    /\{\s*key\s*:\s*['"]([^'"]+)['"]\s*,\s*allowedControls\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(text))) {
    const key = normalizePhBase(m[1]);
    if (!key) continue;
    const body = m[2] || '';
    const ctrls = [];
    const cre = /['"]([^'"]+)['"]/g;
    let cm;
    while ((cm = cre.exec(body))) {
      const c = String(cm[1] || '').trim();
      if (c && c !== 'item' && !ctrls.includes(c)) ctrls.push(c);
    }
    if (ctrls.length) out[key] = ctrls;
  }
  return out;
}

/**
 * @param {string[]} keys
 * @param {object|null|undefined} plan
 * @param {string} text
 * @param {string} [warnPrefix]
 * @param {{ ownDefinitionKey?: string|null, childPackages?: Array<object>|null }} [options]
 */
function applyCompositePlaceholders(keys, plan, text, warnPrefix, options = {}) {
  const ownKey =
    String(options.ownDefinitionKey || '').trim() ||
    extractOwnDefinitionKey(text);
  const planForControls = planWithChildPackages(plan, options.childPackages);
  const byPh = buildAllowedControlsByPlaceholder(planForControls, keys, {
    ownDefinitionKey: ownKey,
  });
  const existingByPh = extractAllowedControlsByPlaceholder(text);
  const existingKeys = Object.keys(existingByPh);

  const phLiteral = keys
    .map((k) => {
      let ctrls = (byPh[k] || []).filter(
        (c) => c && c !== 'item' && (!ownKey || c !== ownKey),
      );
      // Preserve non-empty allowedControls already on the definition when plan /
      // childPackages did not map (common for header Link List hosts under
      // plan.mode=single + AppPlaceholder).
      if (!ctrls.length) {
        const fuzzy =
          existingByPh[k] ||
          existingByPh[
            existingKeys.find(
              (ek) =>
                ek === k ||
                ek.endsWith(`-${k}`) ||
                k.endsWith(`-${ek}`) ||
                (ek.includes(k) && k.length >= 4) ||
                (k.includes(ek) && ek.length >= 4),
            ) || ''
          ] ||
          [];
        ctrls = fuzzy.filter(
          (c) => c && c !== 'item' && (!ownKey || c !== ownKey),
        );
      }
      return `{ key: "${k}", allowedControls: ${JSON.stringify(ctrls)} }`;
    })
    .join(', ');

  const next = replacePlaceholdersArray(text, `[${phLiteral}]`);
  // Routine sync (definition placeholders ← TSX keys) stays quiet; only log
  // when a custom warnPrefix is set (e.g. last-resort plan-fill).
  if (warnPrefix) {
    console.warn(`  ⚠ ${warnPrefix} [${keys.join(', ')}]`);
  }
  return {
    definitionTs: next,
    planMode: /** @type {'composite'} */ ('composite'),
    placeholderKeys: keys,
  };
}

/**
 * Planned mode for this package (section plan.mode or node.mode). Pin sync to this —
 * do not flip effectivePlanMode from TSX shape alone.
 *
 * @param {{
 *   plan?: object|null,
 *   role?: string|null,
 *   nodeMode?: string|null,
 *   plannedMode?: string|null,
 * }} options
 * @returns {'single'|'composite'}
 */
export function resolvePlannedSyncMode(options = {}) {
  const explicit = String(options.plannedMode || options.nodeMode || '')
    .trim()
    .toLowerCase();
  if (explicit === 'composite' || explicit === 'single') return explicit;
  const role = String(options.role || '').toLowerCase();
  // Flat leaf child without nodeMode → single (legacy).
  if (role === 'child') return 'single';
  return String(options.plan?.mode || '').toLowerCase() === 'composite'
    ? 'composite'
    : 'single';
}

/**
 * Sync definition placeholders from TSX.
 *
 * Default (v1/v2): **pinned to planned mode** — TSX must conform; sync never
 * rewrites planMode from AppPlaceholder alone.
 *
 * When `trustTsxStructure`: AppPlaceholder / extracted keys decide
 * composite vs single; planned mode is only a fallback label.
 *
 * @param {string} definitionTs
 * @param {{
 *   tsxSource?: string|null,
 *   clientTsxSource?: string|null,
 *   plan?: object|null,
 *   childPackages?: Array<object>|null,
 *   role?: string|null,
 *   allowPlanFill?: boolean,
 *   nodeMode?: string|null,
 *   plannedMode?: string|null,
 *   trustTsxStructure?: boolean,
 *   definitionKey?: string|null,
 * }} [options]
 * @returns {{ definitionTs: string, planMode: 'single'|'composite', placeholderKeys: string[], tsxDisagreesWithPlan: boolean }}
 */
export function syncDefinitionFromTsx(definitionTs, options = {}) {
  const mapEntry = String(options.tsxSource || '');
  const clientTsx = String(options.clientTsxSource || '');
  const tsx = unionStructureTsxSources(mapEntry, clientTsx);
  const role = String(options.role || '').toLowerCase();
  let text = String(definitionTs || '');
  const hasAppPlaceholder = hasAppPlaceholderInSources(mapEntry, clientTsx);
  const ownDefinitionKey =
    String(options.definitionKey || '').trim() || extractOwnDefinitionKey(text);

  let keys = extractPlaceholderBasesFromTsx(tsx);
  // Child host keys from packages only — never plan.children.
  const childKeys = extractPlaceholderBasesFromChildren(
    Array.isArray(options.childPackages) ? options.childPackages : [],
  );
  const defKeys = extractPlaceholderKeysFromDefinition(text);
  const applyOpts = {
    ownDefinitionKey,
    childPackages: options.childPackages,
  };

  // planMode / plannedMode is informational only — never decides leaf vs composite.
  // Authority: AppPlaceholder, or section host implied by child placeholderKeys.
  const forceLeaf = !hasAppPlaceholder && role === 'child';
  const hostFromChildren = !forceLeaf && childKeys.length > 0;
  const isComposite = hasAppPlaceholder || hostFromChildren;
  // Derived label for logs/callers — not an input.
  const derivedMode = isComposite ? 'composite' : 'single';
  const tsxDisagreesWithPlan = false;

  if (!isComposite) {
    const next = replacePlaceholdersArray(text, '[]');
    if (
      next !== text &&
      /\bplaceholders\s*:\s*\[[^\]]*[^\s\]]/.test(text)
    ) {
      console.warn(
        '  ⚠ TSX sync: no AppPlaceholder / child host keys — cleared placeholders[] (leaf)',
      );
    }
    return {
      definitionTs: next,
      planMode: /** @type {'single'} */ ('single'),
      placeholderKeys: [],
      tsxDisagreesWithPlan,
    };
  }

  // Composite host — fill keys from TSX extract + child packages only (never plan).
  for (const k of childKeys) {
    if (k && !keys.includes(k)) keys.push(k);
  }

  if (keys.length === 0) {
    if (childKeys.length > 0) {
      return {
        ...applyCompositePlaceholders(
          childKeys,
          options.plan,
          text,
          'TSX sync: filled placeholders from child placeholderKey(s)',
          applyOpts,
        ),
        tsxDisagreesWithPlan,
      };
    }
    console.warn(
      '  ⚠ TSX sync: composite host but no placeholder keys — leaving definition as-is',
    );
    return {
      definitionTs: text,
      planMode: /** @type {'composite'} */ (derivedMode),
      placeholderKeys: defKeys,
      tsxDisagreesWithPlan,
    };
  }

  return {
    ...applyCompositePlaceholders(keys, options.plan, text, undefined, applyOpts),
    tsxDisagreesWithPlan,
  };
}
