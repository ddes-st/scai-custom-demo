/**
 * Surgical preserve helpers for build/format AI repair.
 * Previous package is authoritative — request only needed files, pin siblings,
 * reject oversized edits.
 */

/** Tight cap for pure syntax/parse fixes (e.g. TS1005). */
export const SURGICAL_SYNTAX_MAX_LEN_DELTA = 64;
/** Default cap for type / CONTRACT surgical edits. */
export const SURGICAL_DEFAULT_MAX_LEN_DELTA = 4000;
/** Max contiguous changed-line hunks before reject. */
export const SURGICAL_DEFAULT_MAX_HUNKS = 8;
/** Syntax/parse: at most a couple of hunks. */
export const SURGICAL_SYNTAX_MAX_HUNKS = 3;

export const SURGICAL_PRESERVE_SYSTEM = `Minimal repair of a Sitecore Content SDK component package.
Previous package is authoritative. Fix ONLY the reported diagnostics.
Every character outside the fix must stay identical. No reformat, reorder,
rename, restyle, or Sitecore field invention. Never emit 'use server'.
Companions use 'use client' + export default when clientTsx is requested.`;

/**
 * True when build diagnostics require definitionTs repair (mirrors build-repair gate).
 * @param {string[]|null|undefined} diagnostics
 * @returns {boolean}
 */
export function diagnosticsNeedDefinitionFile(diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  return list.some((d) => {
    const s = String(d || '');
    return (
      /valid Sitecore item name/i.test(s) ||
      /content\.items\[\]\.name/i.test(s) ||
      /children\[\]\.name/i.test(s) ||
      /ItemNameValidation/i.test(s) ||
      /definitionTs/i.test(s) ||
      /HARD:\s*content\.items/i.test(s)
    );
  });
}

/**
 * @param {string[]} diagnostics
 * @returns {boolean}
 */
export function diagnosticsAreSyntaxOnly(diagnostics) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  if (!list.length) return false;
  return list.every((d) => {
    const s = String(d || '');
    if (!s.trim()) return false;
    // Pure parse / syntax — not type assignability or CONTRACTs.
    if (/\bCONTRACT:/i.test(s)) return false;
    if (/\bTS1005\b|\bTS1003\b|\bTS1002\b|\bTS1109\b|\bTS1128\b|\bTS1131\b|\bTS1160\b/.test(s)) {
      return true;
    }
    if (/'}'\s*expected|"\}"\s*expected|Unexpected token|Expression expected/i.test(s)) {
      return true;
    }
    // Generic Prettier/parser syntax failures
    if (/SyntaxError|Unexpected character|Missing semicolon/i.test(s) && !/\bTS\d{4}\b/.test(s)) {
      return true;
    }
    // Other TSC codes → not syntax-only
    if (/\bTS\d{4}\b/.test(s)) return false;
    return false;
  });
}

/**
 * Which package files the model may change for these diagnostics.
 * @param {string[]} diagnostics
 * @param {{
 *   previousTsx?: string,
 *   previousClientTsx?: string|null,
 *   previousDefinitionTs?: string|null,
 *   requireClient?: boolean,
 *   failedFile?: string,
 * }} [opts]
 * @returns {{ tsx: boolean, client: boolean, definition: boolean }}
 */
export function selectRepairFiles(diagnostics, opts = {}) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  const blob = list.map((d) => String(d || '')).join('\n');
  const previousClient = String(opts.previousClientTsx || '').trim();
  const previousDefinition = String(opts.previousDefinitionTs || '').trim();
  const failedFile = String(opts.failedFile || '').toLowerCase();

  // Format-repair path: Prettier failed on a specific file.
  if (failedFile === 'clienttsx' || failedFile === 'client') {
    return { tsx: false, client: true, definition: false };
  }
  if (failedFile === 'tsx') {
    return { tsx: true, client: false, definition: false };
  }

  const needDef =
    Boolean(previousDefinition) && diagnosticsNeedDefinitionFile(list);
  const missingClient =
    /map-entry imports .*client.*missing|clientTsx is missing|empty LLM clientTsx|MISSING — you MUST emit/i.test(
      blob,
    ) ||
    (/CONTRACT:.*\.client/i.test(blob) && !previousClient);
  const clientDiag =
    /\bclientTsx\b/i.test(blob) ||
    /companion/i.test(blob) ||
    (/'use client'/i.test(blob) && /CONTRACT/i.test(blob));
  const hasTsc =
    /\bTSC:/i.test(blob) || /\bTS\d{4}\b/.test(blob);
  const defOnlyContract =
    needDef &&
    !hasTsc &&
    !missingClient &&
    !clientDiag &&
    /CONTRACT:|ItemNameValidation|content\.items/i.test(blob);

  /** @type {{ tsx: boolean, client: boolean, definition: boolean }} */
  const sel = {
    tsx: false,
    client: false,
    definition: Boolean(needDef),
  };

  if (defOnlyContract) {
    return { tsx: false, client: false, definition: true };
  }

  if (missingClient) {
    sel.client = true;
    // Import path / map-entry may also need a tsx touch
    if (/import|map-entry/i.test(blob)) sel.tsx = true;
  } else if (clientDiag && previousClient) {
    sel.client = true;
  }

  if (hasTsc || /\btsx\b/i.test(blob) || /CONTRACT:/i.test(blob)) {
    sel.tsx = true;
  }

  if (!sel.tsx && !sel.client && !sel.definition) {
    sel.tsx = true;
  }

  // requireClient with empty previous → must emit client
  if (opts.requireClient && !previousClient) {
    sel.client = true;
  }

  return sel;
}

/**
 * Count line-based change hunks between two strings.
 * @param {string} prev
 * @param {string} next
 * @returns {number}
 */
export function countEditHunks(prev, next) {
  const a = String(prev || '').split(/\r?\n/);
  const b = String(next || '').split(/\r?\n/);
  // Myers-lite: walk with LCS-ish via simple index alignment when lengths differ
  const maxLen = Math.max(a.length, b.length);
  let hunks = 0;
  let inHunk = false;
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const ca = i < a.length ? a[i] : null;
    const cb = j < b.length ? b[j] : null;
    if (ca === cb) {
      inHunk = false;
      i += 1;
      j += 1;
      continue;
    }
    if (!inHunk) {
      hunks += 1;
      inHunk = true;
    }
    // Prefer consuming the side that looks like an insert/delete
    if (ca != null && (cb == null || (j + 1 < b.length && a[i] === b[j + 1]))) {
      i += 1;
    } else if (cb != null && (ca == null || (i + 1 < a.length && a[i + 1] === b[j]))) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
    if (hunks > 50 || i + j > maxLen * 3) break;
  }
  return hunks;
}

/**
 * @param {string} prev
 * @param {string} next
 * @param {{ maxLenDelta?: number, maxHunks?: number, allowCreateFromEmpty?: boolean }} [opts]
 * @returns {{ oversized: boolean, lenDelta: number, hunks: number }}
 */
export function isOversizedEdit(prev, next, opts = {}) {
  const p = String(prev || '');
  const n = String(next || '');
  const lenDelta = Math.abs(n.length - p.length);
  if (opts.allowCreateFromEmpty && !p.trim() && n.trim()) {
    return { oversized: false, lenDelta, hunks: 0 };
  }
  const maxLenDelta =
    opts.maxLenDelta != null
      ? opts.maxLenDelta
      : SURGICAL_DEFAULT_MAX_LEN_DELTA;
  const maxHunks =
    opts.maxHunks != null ? opts.maxHunks : SURGICAL_DEFAULT_MAX_HUNKS;
  const hunks = countEditHunks(p, n);
  const oversized = lenDelta > maxLenDelta || hunks > maxHunks;
  return { oversized, lenDelta, hunks };
}

/**
 * Caps based on diagnostic class.
 * @param {string[]} diagnostics
 * @returns {{ maxLenDelta: number, maxHunks: number }}
 */
export function resolveSurgicalEditCaps(diagnostics) {
  if (diagnosticsAreSyntaxOnly(diagnostics)) {
    return {
      maxLenDelta: SURGICAL_SYNTAX_MAX_LEN_DELTA,
      maxHunks: SURGICAL_SYNTAX_MAX_HUNKS,
    };
  }
  return {
    maxLenDelta: SURGICAL_DEFAULT_MAX_LEN_DELTA,
    maxHunks: SURGICAL_DEFAULT_MAX_HUNKS,
  };
}

/**
 * @param {string[]} before
 * @param {string[]} after
 * @returns {boolean}
 */
export function diagnosticsImproved(before, after) {
  const b = (before || []).map((d) => String(d || '').trim()).filter(Boolean);
  const a = (after || []).map((d) => String(d || '').trim()).filter(Boolean);
  if (!a.length) return true;
  return a.length < b.length;
}

/**
 * Parse surgical JSON response (tsx / clientTsx / definitionTs / reason).
 * Falls back to marker extract if JSON parse fails.
 * @param {string} raw
 * @returns {{ tsx?: string, clientTsx?: string, definitionTs?: string, reason?: string }}
 */
export function parseSurgicalRepairJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return {};
  let body = text;
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === 'object') {
      /** @type {{ tsx?: string, clientTsx?: string, definitionTs?: string, reason?: string }} */
      const out = {};
      if (obj.tsx != null) out.tsx = String(obj.tsx);
      if (obj.clientTsx != null) out.clientTsx = String(obj.clientTsx);
      if (obj.definitionTs != null) out.definitionTs = String(obj.definitionTs);
      // Nested packages[0] shape
      const pkg = Array.isArray(obj.packages) ? obj.packages[0] : null;
      if (pkg && typeof pkg === 'object') {
        if (out.tsx == null && pkg.tsx != null) out.tsx = String(pkg.tsx);
        if (out.clientTsx == null && pkg.clientTsx != null) {
          out.clientTsx = String(pkg.clientTsx);
        }
        if (out.definitionTs == null && pkg.definitionTs != null) {
          out.definitionTs = String(pkg.definitionTs);
        }
      }
      if (obj.reason != null) out.reason = String(obj.reason);
      return out;
    }
  } catch {
    /* fall through */
  }
  return {};
}

/**
 * Build user message for surgical preserve repair.
 * @param {{
 *   componentName: string,
 *   diagnostics: string[],
 *   previousTsx: string,
 *   previousClientTsx?: string|null,
 *   previousDefinitionTs?: string|null,
 *   select: { tsx: boolean, client: boolean, definition: boolean },
 *   header?: string,
 *   extraDiagLabel?: string,
 * }} opts
 * @returns {string}
 */
export function buildSurgicalPreserveUserMessage(opts) {
  const name = opts.componentName || 'component';
  const select = opts.select || { tsx: true, client: false, definition: false };
  const diagBlock = (opts.diagnostics || [])
    .map((d) => String(d || '').trim())
    .filter(Boolean)
    .slice(0, 40)
    .join('\n');
  const header =
    opts.header ||
    'SURGICAL BUILD FIX (hard):\nSmallest possible edit. Do not rewrite files you were not asked to change.';

  const pkg = {
    componentName: name,
    tsx: String(opts.previousTsx || ''),
    clientTsx: opts.previousClientTsx != null && String(opts.previousClientTsx).trim()
      ? String(opts.previousClientTsx)
      : null,
    definitionTs:
      opts.previousDefinitionTs != null && String(opts.previousDefinitionTs).trim()
        ? String(opts.previousDefinitionTs)
        : null,
  };

  const requested = [];
  if (select.tsx) requested.push('"tsx"');
  if (select.client) requested.push('"clientTsx"');
  if (select.definition) requested.push('"definitionTs"');
  requested.push('"reason"');

  const parts = [
    header,
    '',
    `Component: ${name}`,
    '',
    opts.extraDiagLabel || '=== DIAGNOSTICS ===',
    diagBlock || '(none)',
    '',
    '=== PREVIOUS PACKAGE (authoritative context) ===',
    JSON.stringify({ packages: [pkg] }).slice(0, 90000),
    '',
    `Return JSON only with these fields: { ${requested.join(', ')} }.`,
    'Omit fields you were not asked to change. Keep every other character identical.',
  ];

  if (select.definition) {
    parts.push(
      '',
      'DEFINITION FIX: Path names (content.items[].name / children[].name) must be ItemNameValidation-safe — strip ? / \\ % * : | " < > \' ; keep punctuation in Title/displayName only.',
    );
  }
  if (select.client && !(pkg.clientTsx && String(pkg.clientTsx).trim())) {
    parts.push(
      '',
      'CLIENT: companion is missing — emit a complete clientTsx with \'use client\' + export default.',
    );
  }

  return parts.join('\n');
}

/**
 * Apply selection + pin + oversized gates to a parsed surgical response.
 * @param {{
 *   parsed: { tsx?: string, clientTsx?: string, definitionTs?: string },
 *   previousTsx: string,
 *   previousClientTsx?: string|null,
 *   previousDefinitionTs?: string|null,
 *   select: { tsx: boolean, client: boolean, definition: boolean },
 *   diagnostics: string[],
 * }} opts
 * @returns {{
 *   ok: boolean,
 *   skipReason?: string,
 *   tsx: string,
 *   clientTsx?: string,
 *   definitionTs?: string,
 * }}
 */
export function applySurgicalPreserveResult(opts) {
  const select = opts.select;
  const prevTsx = String(opts.previousTsx || '');
  const prevClient =
    opts.previousClientTsx != null ? String(opts.previousClientTsx) : '';
  const prevDef =
    opts.previousDefinitionTs != null
      ? String(opts.previousDefinitionTs)
      : '';
  const caps = resolveSurgicalEditCaps(opts.diagnostics || []);
  const parsed = opts.parsed || {};

  let tsx = select.tsx && parsed.tsx != null ? String(parsed.tsx) : prevTsx;
  let clientTsx =
    select.client && parsed.clientTsx != null
      ? String(parsed.clientTsx)
      : prevClient;
  let definitionTs =
    select.definition && parsed.definitionTs != null
      ? String(parsed.definitionTs)
      : prevDef;

  // Always pin non-selected siblings
  if (!select.tsx) tsx = prevTsx;
  if (!select.client) clientTsx = prevClient;
  if (!select.definition) definitionTs = prevDef;

  if (select.tsx) {
    const gate = isOversizedEdit(prevTsx, tsx, caps);
    if (gate.oversized) {
      return {
        ok: false,
        skipReason: `oversized tsx edit (lenDelta=${gate.lenDelta}, hunks=${gate.hunks})`,
        tsx: prevTsx,
        ...(prevClient.trim() ? { clientTsx: prevClient } : {}),
        ...(prevDef.trim() ? { definitionTs: prevDef } : {}),
      };
    }
  }
  if (select.client) {
    const gate = isOversizedEdit(prevClient, clientTsx, {
      ...caps,
      // Creating a missing companion from empty is allowed to be large
      allowCreateFromEmpty: !prevClient.trim(),
      maxLenDelta: !prevClient.trim()
        ? Number.POSITIVE_INFINITY
        : caps.maxLenDelta,
      maxHunks: !prevClient.trim() ? Number.POSITIVE_INFINITY : caps.maxHunks,
    });
    if (gate.oversized) {
      return {
        ok: false,
        skipReason: `oversized clientTsx edit (lenDelta=${gate.lenDelta}, hunks=${gate.hunks})`,
        tsx: prevTsx,
        ...(prevClient.trim() ? { clientTsx: prevClient } : {}),
        ...(prevDef.trim() ? { definitionTs: prevDef } : {}),
      };
    }
  }
  if (select.definition) {
    const gate = isOversizedEdit(prevDef, definitionTs, {
      maxLenDelta: SURGICAL_DEFAULT_MAX_LEN_DELTA,
      maxHunks: SURGICAL_DEFAULT_MAX_HUNKS,
    });
    if (gate.oversized) {
      return {
        ok: false,
        skipReason: `oversized definitionTs edit (lenDelta=${gate.lenDelta}, hunks=${gate.hunks})`,
        tsx: prevTsx,
        ...(prevClient.trim() ? { clientTsx: prevClient } : {}),
        ...(prevDef.trim() ? { definitionTs: prevDef } : {}),
      };
    }
  }

  if (select.tsx && !String(tsx || '').trim()) {
    return { ok: false, skipReason: 'empty LLM tsx', tsx: prevTsx };
  }
  if (select.client && !String(clientTsx || '').trim()) {
    return {
      ok: false,
      skipReason: 'empty LLM clientTsx',
      tsx: prevTsx,
      ...(prevClient.trim() ? { clientTsx: prevClient } : {}),
    };
  }
  if (select.definition && !String(definitionTs || '').trim()) {
    return {
      ok: false,
      skipReason: 'empty LLM definitionTs',
      tsx: prevTsx,
      ...(prevDef.trim() ? { definitionTs: prevDef } : {}),
    };
  }

  /** @type {{ ok: true, tsx: string, clientTsx?: string, definitionTs?: string }} */
  const out = { ok: true, tsx };
  if (select.client || prevClient.trim()) {
    out.clientTsx = clientTsx;
  }
  if (select.definition || prevDef.trim()) {
    if (String(definitionTs || '').trim()) out.definitionTs = definitionTs;
  }
  return out;
}
