/**
 * Post-process AI-generated TSX / definition.ts before write.
 */
import * as esbuild from 'esbuild';
import { normalizeAiSource } from './source-text.mjs';
import { applyDefinitionIcon } from './sitecore-icon.mjs';
import {
  displayNameFromComponentName,
  ensureBrandDefinitionKeyPrefix,
  stripLeadingBrandSpacedLabel,
  toBasePlaceholderKey,
  toDefinitionKey,
  toSpacedDataFolderSegment,
  toSpacedItemName,
} from './naming.mjs';
import { toPlainDisplayName } from '../shared/naming.ts';
import {
  extractRepeatingBlockRootIds,
  extractSectionRootId,
  readIdFromOpenTagAttrs,
} from './root-html-id.mjs';
import { ensureFieldDefaultsFromContentItems } from './field-defaults-from-content.mjs';
import {
  dedupeAppPlaceholderByName,
  ensureClientTrackHorizontalRow,
  ensureMobileNavToggleAttrs,
  ensureMobileNavToggleClickHandler,
  ensureSpacedFieldNamesInDefinition,
  forbidSelfNestedAllowedControls,
  forceEmptyPlaceholdersForPlatformLinkLists,
  rewriteParentCopiedChildSeeds,
  stripDebugOutlineClasses,
  unwrapNestedTrackInsideCarouselChrome,
} from './composite-layout-fixups.mjs';
import {
  mediaTabsAttrRe,
  mediaTabsItemOpenTagRe,
  mediaTabsTitleAssignRe,
  preferredTitleAttrForSource,
} from './media-tabs-attrs.mjs';
import { layoutWantsEqualHeightChildren } from './motion-hints.mjs';
import { noteFixup, warnVerbose } from './create-log.mjs';
import {
  writeDefinitionAfterFixupsDump,
  writeDefinitionSanitizeDump,
} from './ai-debug-dump.mjs';
import { isLinkListAsCompositeEnabled } from '../shared/bq-env.mjs';
import { promoteJsonBagPackageAlwaysOn } from './json-bag-field-map.mjs';
import { alignChildItemTemplateMapsAlwaysOn } from './child-item-template-map.mjs';
import { sanitizeDefinitionContentItemPathNamesSync } from './definition-path-name-normalize.mjs';
import {
  sanitizeDefinitionStringSeeds,
  sanitizeDefinitionStringSeedsDetailed,
  assertDefinitionSeedIntegrity,
  tryParseDefinitionTs,
} from './definition-seed-sanitize.mjs';
import { repairDefinitionContentItems } from './definition-content-items-brace-fix.mjs';
function fixupWarn(message) {
  noteFixup(process.env.BQ_CREATE_SECTION || '_run', String(message ?? ''));
}

export {
  buildMobileNavChromeStub,
  buildCarouselChromeStub,
  clientMatchesCarouselChromeMode,
} from './composite-layout-fixups.mjs';

const FIELD_TYPES = ['TextField', 'RichTextField', 'ImageField', 'LinkField', 'Field'];
const SDK_MODULE = '@sitecore-content-sdk/nextjs';
/** Content SDK value imports that may appear as JSX tags / hooks in generated TSX. */
const SDK_JSX_VALUE_NAMES = [
  'Text',
  'RichText',
  'Image',
  'Link',
  'AppPlaceholder',
  'Placeholder',
  'NextImage',
  'useSitecore',
];

/** Env + process flag: skip the **warn-only** TSX/client post-pass (TSX is never rewritten).
 * Definition (`*.definition.ts`) fixups: still always run on v1; on v2 see
 * {@link shouldSkipMutatingDefinitionFixups}.
 */
let _skipFixupsLogged = false;
let _v2PromptFirstLogged = false;

/** Escape hatch: restore full mutating fixups (default is prompt-first). */
export const BQ_CODEGEN_V2_FIXUPS = 'BQ_CODEGEN_V2_FIXUPS';

/**
 * Whether component/client TSX fixups should no-op (explicit skip only).
 * Set via `BQ_SKIP_AI_SOURCE_FIXUPS=1` or `setSkipAiSourceFixups(true)` / CLI `--skip-fixups`.
 * Prefer {@link shouldSkipMutatingTsxFixups} for call sites.
 * @returns {boolean}
 */
export function shouldSkipAiSourceFixups() {
  if (typeof globalThis.__BQ_SKIP_AI_SOURCE_FIXUPS__ === 'boolean') {
    return globalThis.__BQ_SKIP_AI_SOURCE_FIXUPS__;
  }
  const raw = String(process.env.BQ_SKIP_AI_SOURCE_FIXUPS || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * @param {boolean} skip
 */
export function setSkipAiSourceFixups(skip) {
  globalThis.__BQ_SKIP_AI_SOURCE_FIXUPS__ = Boolean(skip);
}

/**
 * Prompt-first path for section codegen.
 * Always true — mutating TSX/definition fixups stay off unless forced.
 * @param {NodeJS.ProcessEnv} [_env]
 * @returns {boolean}
 */
export function isCodegenPromptFirstFixups(_env = process.env) {
  return true;
}

/** @deprecated Use {@link isCodegenPromptFirstFixups} */
export function isCodegenPromptVersionV2(env = process.env) {
  return isCodegenPromptFirstFixups(env);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isCodegenV2FixupsForced(env = process.env) {
  if (typeof globalThis.__BQ_CODEGEN_V2_FIXUPS__ === 'boolean') {
    return globalThis.__BQ_CODEGEN_V2_FIXUPS__;
  }
  const raw = String(env?.[BQ_CODEGEN_V2_FIXUPS] || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * @param {boolean} on
 */
export function setCodegenV2Fixups(on) {
  if (on) {
    globalThis.__BQ_CODEGEN_V2_FIXUPS__ = true;
    process.env[BQ_CODEGEN_V2_FIXUPS] = '1';
  } else {
    delete globalThis.__BQ_CODEGEN_V2_FIXUPS__;
    delete process.env[BQ_CODEGEN_V2_FIXUPS];
  }
}

/**
 * Codegen is prompt-first: skip mutating TSX/client rewrites unless
 * `BQ_CODEGEN_V2_FIXUPS=1` / `--v2-fixups`. Also honors `--skip-fixups`.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldSkipMutatingTsxFixups(env = process.env) {
  if (shouldSkipAiSourceFixups()) return true;
  if (isCodegenPromptFirstFixups(env) && !isCodegenV2FixupsForced(env)) return true;
  return false;
}

/**
 * Codegen prompt-first: skip salvage/structural definition rewrites unless
 * `BQ_CODEGEN_V2_FIXUPS=1`. Identity + parse gates still run.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldSkipMutatingDefinitionFixups(env = process.env) {
  if (isCodegenPromptFirstFixups(env) && !isCodegenV2FixupsForced(env)) return true;
  return false;
}

function logSkipAiSourceFixupsOnce() {
  if (_skipFixupsLogged) return;
  _skipFixupsLogged = true;
  // Status only — do not noteFixup (would print "fixups N applied" with no rewrite).
  warnVerbose(
    '  ⚠ AI TSX/client warn-pass skipped (BQ_SKIP_AI_SOURCE_FIXUPS)',
  );
}

function logV2PromptFirstOnce() {
  if (_v2PromptFirstLogged) return;
  _v2PromptFirstLogged = true;
  // Name kept for callers; message reflects prompt-first section codegen.
  // Status only — do not noteFixup (would print "fixups N applied" with no rewrite).
  warnVerbose(
    '  ⚠ Codegen prompt-first: mutating TSX/definition fixups skipped (set BQ_CODEGEN_V2_FIXUPS=1 or --v2-fixups to restore)',
  );
}

/** @internal test helper */
export function _resetFixupSkipLogsForTests() {
  _skipFixupsLogged = false;
  _v2PromptFirstLogged = false;
}

const CLIENT_HOOK_NAMES = [
  'useState',
  'useEffect',
  'useRef',
  'useCallback',
  'useMemo',
  'useReducer',
  'useLayoutEffect',
];
const CLIENT_HOOK_RE = new RegExp(`\\b(${CLIENT_HOOK_NAMES.join('|')})\\b`);
const REACT_DOT_HOOK_RE = new RegExp(
  `\\bReact\\.(${CLIENT_HOOK_NAMES.join('|')})\\b`,
  'g',
);

/** Nested PH parents stay Server Components (AppPlaceholder or client Placeholder). */
function hasNestedPlaceholder(source) {
  return (
    /<AppPlaceholder\b/.test(source) ||
    /\bAppPlaceholder\b/.test(source) ||
    /<Placeholder\b/.test(source) ||
    /\bPlaceholder\b/.test(source)
  );
}

/**
 * Prefer named hook imports: rewrite `React.useState` → `useState` and ensure
 * `import { useState, … } from 'react'` when client hooks are used.
 */
export function ensureReactHookImports(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  text = text.replace(REACT_DOT_HOOK_RE, '$1');

  const used = CLIENT_HOOK_NAMES.filter((name) =>
    new RegExp(`\\b${name}\\b`).test(text),
  );
  if (used.length === 0) return text;

  // Merge into an existing value import from 'react' when present.
  const reactValueImportRe =
    /^import\s+(?!type\s)(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/m;
  const reactDefaultOnlyRe =
    /^import\s+(?!type\s)(\w+)\s+from\s*['"]react['"];?\s*$/m;

  if (reactValueImportRe.test(text)) {
    text = text.replace(reactValueImportRe, (full, defaultImport, named) => {
      const existing = named
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\s+as\s+\w+$/, '').trim());
      const missing = used.filter((h) => !existing.includes(h));
      if (missing.length === 0) return full;
      const combined = [...existing, ...missing];
      const defaultPart = defaultImport ? `${defaultImport}, ` : '';
      return `import ${defaultPart}{ ${combined.join(', ')} } from 'react';`;
    });
  } else if (reactDefaultOnlyRe.test(text)) {
    text = text.replace(reactDefaultOnlyRe, (full, defaultImport) => {
      return `import ${defaultImport}, { ${used.join(', ')} } from 'react';`;
    });
  }

  const covered = new Set();
  for (const m of text.matchAll(
    /^import\s+(?!type\s)(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/gm,
  )) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/\s+as\s+\w+$/, '').trim();
      if (name) covered.add(name);
    }
  }

  const stillMissing = used.filter((h) => !covered.has(h));
  if (stillMissing.length === 0) return text;

  const importLine = `import { ${stillMissing.join(', ')} } from 'react';\n`;
  if (/^['"]use client['"];?\s*\n/.test(text)) {
    return text.replace(/^(['"]use client['"];?\s*\n+)/, `$1${importLine}`);
  }
  return importLine + text.replace(/^\uFEFF/, '');
}

/**
 * True when source references JSX.* without importing JSX from 'react'.
 * @param {string} source
 * @returns {boolean}
 */
export function sourceNeedsJsxNamespaceImport(source) {
  const text = String(source || '');
  if (!/\bJSX\s*\./.test(text)) return false;
  const importRe =
    /^import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/gm;
  let m;
  while ((m = importRe.exec(text))) {
    const names = m[1]
      .split(',')
      .map((s) =>
        s
          .trim()
          .replace(/^type\s+/, '')
          .replace(/\s+as\s+\w+$/, '')
          .trim(),
      )
      .filter(Boolean);
    if (names.includes('JSX')) return false;
  }
  return true;
}

/**
 * Always-on: ensure `JSX` is imported from 'react' when `JSX.Element` / `JSX.*` is used
 * (TS2694). Mirrors {@link ensureReactHookImports}.
 * @param {string} source
 * @returns {string}
 */
export function ensureJsxNamespaceImport(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!sourceNeedsJsxNamespaceImport(text)) return text;

  const reactValueImportRe =
    /^import\s+(?!type\s)(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/m;
  const reactDefaultOnlyRe =
    /^import\s+(?!type\s)(\w+)\s+from\s*['"]react['"];?\s*$/m;
  const reactTypeImportRe =
    /^import\s+type\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react['"];?\s*$/m;

  if (reactValueImportRe.test(text)) {
    text = text.replace(reactValueImportRe, (full, defaultImport, named) => {
      const existing = named
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bare = existing.map((s) =>
        s.replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '').trim(),
      );
      if (bare.includes('JSX')) return full;
      const combined = [...existing, 'JSX'];
      const defaultPart = defaultImport ? `${defaultImport}, ` : '';
      return `import ${defaultPart}{ ${combined.join(', ')} } from 'react';`;
    });
  } else if (reactDefaultOnlyRe.test(text)) {
    text = text.replace(reactDefaultOnlyRe, (full, defaultImport) => {
      return `import ${defaultImport}, { JSX } from 'react';`;
    });
  } else if (reactTypeImportRe.test(text)) {
    text = text.replace(reactTypeImportRe, (full, defaultImport, named) => {
      const existing = named
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const bare = existing.map((s) =>
        s.replace(/^type\s+/, '').replace(/\s+as\s+\w+$/, '').trim(),
      );
      if (bare.includes('JSX')) return full;
      const combined = [...existing, 'JSX'];
      const defaultPart = defaultImport ? `${defaultImport}, ` : '';
      return `import type ${defaultPart}{ ${combined.join(', ')} } from 'react';`;
    });
  }

  if (!sourceNeedsJsxNamespaceImport(text)) return text;

  const importLine = `import React, { JSX } from 'react';\n`;
  if (/^['"]use client['"];?\s*\n/.test(text)) {
    return text.replace(/^(['"]use client['"];?\s*\n+)/, `$1${importLine}`);
  }
  return importLine + text.replace(/^\uFEFF/, '');
}

/**
 * When a component body can `return null`, widen bare `: JSX.Element` (etc.)
 * annotations to `: JSX.Element | null` — fixes TS2322 without inventing null returns.
 * @param {string} source
 * @returns {string}
 */
export function ensureNullableJsxReturnType(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\breturn\s+null\b/.test(text)) return text;

  const before = text;
  // ): JSX.Element => / ): React.JSX.Element { / ): ReactElement =>
  // Skip when already `| null` (or other union) after the Element type.
  text = text.replace(
    /(\)\s*:\s*)((?:React\.)?JSX\.Element|ReactElement)(\s*)(?!\||&)/g,
    (full, prefix, elem, ws) => {
      // Don't touch if the next non-ws token starts a union/intersection.
      return `${prefix}${elem} | null${ws}`;
    },
  );
  // Guard against double-widen if regex edge cases leave " | null | null"
  text = text.replace(
    /((?:React\.)?JSX\.Element|ReactElement)\s*\|\s*null(?:\s*\|\s*null)+/g,
    '$1 | null',
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: widened return type to JSX.Element | null (component returns null)',
    );
  }
  return text;
}

/**
 * Capture / CMS data-* attrs that must not appear in sitecoreized TSX.
 * Allowlist: data-bq-*, data-media-tab-*, data-story-*, data-mobile-menu(-toggle).
 * @param {string} name
 * @returns {boolean}
 */
export function isAllowedBqDataAttribute(name) {
  const n = String(name || '').toLowerCase();
  if (n.startsWith('data-bq-')) return true;
  if (n.startsWith('data-media-tab-')) return true;
  if (n.startsWith('data-story-')) return true;
  if (n === 'data-mobile-menu' || n === 'data-mobile-menu-toggle') return true;
  return false;
}

/**
 * Strip capture-style JSX data-* attributes; keep BQ layout allowlist.
 * @param {string} source
 * @returns {string}
 */
export function stripCaptureDataAttributes(source) {
  let text = String(source || '');
  if (!text.trim() || !/\bdata-[a-z0-9_-]+\b/i.test(text)) return text;
  const before = text;
  // data-foo / data-foo="…" / data-foo='…' / data-foo={…}
  text = text.replace(
    /\s+data-([A-Za-z0-9_-]+)(\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})|(?=[\s/>]))/g,
    (full, namePart) => {
      const name = `data-${namePart}`;
      if (isAllowedBqDataAttribute(name)) return full;
      return '';
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped capture data-* attributes (kept BQ allowlist)',
    );
  }
  return text;
}

/**
 * Parse comma-separated destructure bindings → binding names (ignore rest/renames carefully).
 * @param {string} destructureInner
 * @returns {string[]}
 */
function parseDestructureBindingNames(destructureInner) {
  /** @type {string[]} */
  const names = [];
  for (const part of String(destructureInner || '').split(',')) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('...')) continue;
    // fields: renamed → use binding `renamed`; fields → fields
    const renamed = trimmed.match(
      /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/,
    );
    if (renamed) {
      names.push(renamed[2]);
      continue;
    }
    const plain = trimmed.match(/^([A-Za-z_$][\w$]*)/);
    if (plain) names.push(plain[1]);
  }
  return names;
}

/**
 * Rewrite top-level binding uses `name` / `name.` → `props.name` (not nested `.name`).
 * Skips type-annotation positions `name:` .
 * @param {string} text
 * @param {string} name
 * @returns {string}
 */
function rewriteBareBindingToPropsMember(text, name) {
  const n = String(name || '');
  if (!n || n === 'props') return text;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // name. / name?. / name[  → props.name…
  let out = text.replace(
    new RegExp(`(?<![\\w.$])${esc}(?=\\s*(?:\\?\\.|\.|\\[))`, 'g'),
    `props.${n}`,
  );
  // getDatasource(name) / (name) value uses — not `name:` types
  out = out.replace(
    new RegExp(`(?<![\\w.$])${esc}(?!\\s*\\??\\s*:)(?=\\s*\\))`, 'g'),
    `props.${n}`,
  );
  // if (!name) / && name /
  out = out.replace(
    new RegExp(`(?<![\\w.$])${esc}(?!\\s*\\??\\s*:)(?=\\s*(?:&&|\\|\\||;|,|\\}|\\?\\s|\\s*[=!]=))`, 'g'),
    `props.${n}`,
  );
  // Collapse props.props.name if double-applied
  out = out.replace(new RegExp(`\\bprops\\.props\\.${esc}\\b`, 'g'), `props.${n}`);
  return out;
}

/**
 * Standardize chrome on `(props: Props)` — rewrite `({ fields })` signatures and
 * body uses of those bindings to `props.<name>`.
 * @param {string} source
 * @returns {string}
 */
export function normalizeChromeToPropsParam(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  /** @type {Set<string>} */
  const collected = new Set();

  /**
   * @param {string} full
   * @param {string} destInner
   * @param {string|undefined} typeAnn
   * @param {(propsSig: string) => string} build
   */
  const takeDestructure = (full, destInner, typeAnn, build) => {
    if (/\bprops\b/.test(destInner)) return full;
    for (const n of parseDestructureBindingNames(destInner)) collected.add(n);
    const ann = (typeAnn && String(typeAnn).trim()) || 'Props';
    return build(`(props: ${ann})`);
  };

  // export default function Name({ … }: Type)
  text = text.replace(
    /export\s+default\s+function\s+(\w+)\s*\(\s*\{([^}]*)\}\s*(?::\s*([^{)=]+))?\)/g,
    (full, name, dest, typeAnn) =>
      takeDestructure(full, dest, typeAnn, (sig) =>
        `export default function ${name}${sig}`,
      ),
  );
  // function Name({ … }: Type) {  (non-export companions)
  text = text.replace(
    /(?:^|\n)(export\s+)?function\s+(\w+)\s*\(\s*\{([^}]*)\}\s*(?::\s*([^{)=]+))?\)/g,
    (full, exp, name, dest, typeAnn) => {
      if (/^export\s+default\s+function/.test(full.trim())) return full;
      return takeDestructure(full, dest, typeAnn, (sig) =>
        `${exp || ''}function ${name}${sig}`,
      );
    },
  );
  // export const Default = ({ … }: Props): Ret =>
  // const Chrome = ({ … }: Props): Ret =>
  text = text.replace(
    /((?:export\s+)?const\s+(?:Default|\w+)\s*=\s*(?:async\s*)?)\(\s*\{([^}]*)\}\s*(?::\s*([^)=]+))?\)(\s*(?::\s*[^=]+)?\s*=>)/g,
    (full, lead, dest, typeAnn, arrow) =>
      takeDestructure(full, dest, typeAnn, (sig) => `${lead}${sig}${arrow}`),
  );

  if (collected.size) {
    for (const n of collected) {
      text = rewriteBareBindingToPropsMember(text, n);
    }
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: normalized chrome to (props: Props) + props.* access',
    );
  }
  return text;
}

/**
 * Client chrome must not call getDatasource — map-entry unwraps and passes flat fields.
 * @param {string} source
 * @returns {string}
 */
export function stripClientGetDatasource(source) {
  let text = String(source || '');
  if (!text.trim() || !/\bgetDatasource\b/.test(text)) return text;
  const before = text;

  /** @type {string[]} */
  const binds = [];
  text = text.replace(
    /^\s*(?:const|let|var)\s+(\w+)\s*=\s*getDatasource\s*(?:<[^>]*>)?\s*\([\s\S]*?\);?\s*$/gm,
    (full, name) => {
      binds.push(name);
      return '';
    },
  );
  for (const b of binds) {
    text = rewriteBareBindingToPropsMember(text, b);
    // rewriteBareBinding maps b → props.b; we want props.fields
    text = text.replace(
      new RegExp(
        `\\bprops\\.${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'g',
      ),
      'props.fields',
    );
  }
  // Inline getDatasource(props.fields|fields) → props.fields
  text = text.replace(
    /\bgetDatasource\s*(?:<[^>]*>)?\s*\(\s*(?:props\.)?fields\s*\)/g,
    'props.fields',
  );

  // Drop unused getDatasource import
  if (!/\bgetDatasource\s*[<(]/.test(text)) {
    text = text.replace(
      /^import\s*\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
      (full, named) => {
        const keep = named
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && !/^getDatasource\b/.test(s));
        if (!keep.length) return '';
        return `import { ${keep.join(', ')} } from 'lib/component-props';`;
      },
    );
    text = text.replace(
      /^import\s+type\s*\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
      (full, named) => {
        const keep = named
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && !/^getDatasource\b/.test(s));
        if (!keep.length) return '';
        return `import type { ${keep.join(', ')} } from 'lib/component-props';`;
      },
    );
  }

  // Collapse blank lines from removed const
  text = text.replace(/\n{3,}/g, '\n\n');

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped getDatasource from client (unwrap at map-entry)',
    );
  }
  return text;
}

/**
 * Map-entry with fields companion: ensure getDatasource(props.fields) and pass flat bag.
 * @param {string} tsx
 * @param {string|null|undefined} clientTsx
 * @returns {string}
 */
export function ensureMapEntryUnwrapsDatasourceForCompanion(tsx, clientTsx) {
  let text = String(tsx || '');
  if (!text.trim() || !String(clientTsx || '').trim()) return text;
  const allowed = collectClientChromePropNames(clientTsx);
  if (!allowed.has('fields')) return text;

  const before = text;
  const existing = text.match(
    /\b(?:const|let|var)\s+(\w+)\s*=\s*getDatasource\s*(?:<[^>]*>)?\s*\(/,
  );
  let bind = existing ? existing[1] : 'datasource';

  if (!existing) {
    text = ensureGetDatasourceLibImport(text);
    // Prefer typed Fields when in scope
    const call = /\bFields\b/.test(text)
      ? `  const ${bind} = getDatasource<Fields>(props.fields);\n`
      : `  const ${bind} = getDatasource(props.fields);\n`;
    const inserted = insertAtComponentBodyStart(text, call);
    if (inserted === text) {
      // Fallback: after export const Default = (props…) => {
      text = text.replace(
        /(export\s+const\s+Default\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^{=]+)?\s*=>\s*\{)/,
        `$1\n${call}`,
      );
    } else {
      text = inserted;
    }
    fixupWarn(
      '  ⚠ Codegen fixup: map-entry unwraps props.fields via getDatasource for companion',
    );
  }

  // Rewrite companion fields={props.fields|fields} → fields={bind}
  const alias = parseCompanionClientImportAlias(text);
  if (alias) {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const openRe = new RegExp(`<${esc}\\b`, 'g');
    /** @type {{ start: number, end: number, replacement: string }[]} */
    const edits = [];
    let match;
    while ((match = openRe.exec(text)) !== null) {
      const parsed = parseJsxOpeningTag(text, match.index);
      if (!parsed) continue;
      let attrs = parsed.attrs || '';
      if (/\bfields\s*=\s*\{\s*(?:props\.)?fields(?:\s+as\s+any)?\s*\}/.test(attrs)) {
        attrs = attrs.replace(
          /\bfields\s*=\s*\{\s*(?:props\.)?fields(?:\s+as\s+any)?\s*\}/,
          `fields={${bind}}`,
        );
        const open = parsed.selfClosing
          ? `<${alias}${attrs} />`
          : `<${alias}${attrs}>`;
        edits.push({ start: match.index, end: parsed.end, replacement: open });
      }
    }
    for (let i = edits.length - 1; i >= 0; i -= 1) {
      const e = edits[i];
      text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
    }
  }

  if (text !== before && existing) {
    // only warn once when we rewrote props without inserting
    if (/\bfields=\{(?:props\.)?fields\}/.test(before) &&
      new RegExp(`\\bfields=\\{${bind}\\}`).test(text)) {
      fixupWarn(
        `  ⚠ Codegen fixup: companion fields={${bind}} (flat unwrap)`,
      );
    }
  }
  return text;
}

/**
 * Resolve peer column count from sectionInfo / layout analysis (2–6).
 * @param {object|null|undefined} sectionInfo
 * @returns {number}
 */
export function resolvePeerColumnsMax(sectionInfo) {
  const info = sectionInfo && typeof sectionInfo === 'object' ? sectionInfo : {};
  const layout = info.layout && typeof info.layout === 'object' ? info.layout : {};
  const analysis =
    info.htmlLayout ||
    info.layoutAnalysis ||
    layout.analysis ||
    {};
  const desktop =
    analysis.desktop && typeof analysis.desktop === 'object'
      ? analysis.desktop
      : {};
  const candidates = [
    layout.columnsMax,
    desktop.columnsMax,
    analysis.columnsMax,
    info.columnsMax,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 2 && n <= 6) return Math.trunc(n);
  }
  const cards = Number(layout.cardCount ?? analysis.cardCount ?? info.cardCount);
  if (Number.isFinite(cards) && cards >= 2 && cards <= 6) return Math.trunc(cards);
  return 0;
}

/**
 * Host chrome that `Children.toArray` + hardcodes band titles (e.g. "Meer gezondheid")
 * duplicates (and often mis-places) headings owned by peer child packages. Strip those
 * literal h2/h3 text nodes so Sitecore + preview render the child Heading field instead.
 * @param {string} source
 * @param {string|null|undefined} sectionHtml
 * @returns {string}
 */
export function stripHardcodedPeerBandHeadingsFromHostChrome(source, sectionHtml) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/Children\.toArray|parts\[\d+\]/.test(text)) return text;

  /** @type {Set<string>} */
  const headings = new Set();
  const html = String(sectionHtml || '');
  if (html.trim()) {
    for (const m of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)) {
      const t = String(m[1] || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (t.length >= 4 && t.length <= 80) headings.add(t);
    }
  }
  // Always strip common dual-owned band titles even without HTML.
  headings.add('Meer gezondheid');

  for (const heading of headings) {
    const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<h([23])([^>]*)>\\s*${esc}\\s*<\\/h\\1>`,
      'g',
    );
    const next = text.replace(re, '');
    if (next !== text) {
      text = next;
      noteFixup(
        `host-chrome: stripped hardcoded band heading "${heading}" (owned by peer child)`,
      );
    }
  }
  return text;
}

/**
 * Ensure AppPlaceholder peer track has lg:grid-cols-N when columnsMax/cardCount ≥ 2.
 * @param {string} source
 * @param {object|null|undefined} sectionInfo
 * @returns {string}
 */
export function ensurePeerGridAroundAppPlaceholder(source, sectionInfo) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\bAppPlaceholder\b/.test(text)) return text;
  const n = resolvePeerColumnsMax(sectionInfo);
  if (n < 2) return text;
  const colToken = `lg:grid-cols-${n}`;
  if (
    new RegExp(`\\b${colToken.replace(':', '\\:')}\\b`).test(text) ||
    new RegExp(`\\bgrid-cols-${n}\\b`).test(text)
  ) {
    return text;
  }

  const tokensToAdd = ['grid', 'grid-cols-1', 'gap-6', colToken];
  const prefix = tokensToAdd.join(' ');
  const apCount = (text.match(/<AppPlaceholder\b/g) || []).length;

  // Multi-PH hosts: wrap the first AppPlaceholder only — never put lg:grid-cols-N on a
  // shared ancestor that also hosts unrelated placeholders (e.g. health + link panels).
  if (apCount >= 2) {
    const wrapped = text.replace(
      /(<AppPlaceholder\b[\s\S]*?(?:\/>|<\/AppPlaceholder>))/,
      `<div className="${prefix}">$1</div>`,
    );
    if (wrapped !== text) {
      fixupWarn(
        `  ⚠ Codegen fixup: peer grid track lg:grid-cols-${n} around first AppPlaceholder`,
      );
    }
    return wrapped;
  }

  const apIdx = text.search(/<AppPlaceholder\b/);
  if (apIdx < 0) return text;
  const before = text.slice(0, apIdx);
  const classRe =
    /className\s*=\s*(?:\{\s*`([^`]*)`\s*\}|"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
  /** @type {RegExpExecArray|null} */
  let last = null;
  let m;
  while ((m = classRe.exec(before))) last = m;
  if (!last) {
    return text.replace(
      /(<AppPlaceholder\b[\s\S]*?(?:\/>|<\/AppPlaceholder>))/,
      `<div className="${prefix}">$1</div>`,
    );
  }
  const full = last[0];
  const cls = last[1] ?? last[2] ?? last[3] ?? last[4] ?? last[5] ?? '';
  let nextCls = cls;
  if (!/\bgrid\b/.test(nextCls)) nextCls = `grid ${nextCls}`.trim();
  if (!/\bgrid-cols-1\b/.test(nextCls) && !/\bgrid-cols-\d+\b/.test(nextCls)) {
    nextCls = nextCls.replace(/\bgrid\b/, 'grid grid-cols-1');
  }
  if (!new RegExp(`\\blg:grid-cols-${n}\\b`).test(nextCls)) {
    nextCls = `${nextCls} ${colToken}`.trim();
  }
  if (!/\bgap-/.test(nextCls)) nextCls = `${nextCls} gap-6`.trim();
  if (nextCls === cls) return text;
  const patched = full.includes('`')
    ? full.replace(/`[^`]*`/, `\`${nextCls}\``)
    : full.replace(/(["'])([^"']*)\1/, (_sm, q) => `${q}${nextCls}${q}`);
  const out =
    before.slice(0, last.index) +
    patched +
    before.slice(last.index + full.length) +
    text.slice(apIdx);
  if (out !== text) {
    fixupWarn(
      `  ⚠ Codegen fixup: peer grid track lg:grid-cols-${n} around AppPlaceholder`,
    );
  }
  return out;
}

/**
 * Remap camelCase Link field access + unwrap Link wrapping Image when field is ImageField.
 * @param {string} source
 * @returns {string}
 */
export function ensureImageInLinkUsesLinkField(source) {
  let text = String(source || '');
  if (!text.trim() || !/<Link\b/.test(text)) return text;
  const before = text;

  // Remap common camelCase card-link access before spaced-field pass (belt+suspenders).
  text = text.replace(
    /\b((?:props\.)?fields)\.CardLink\b/g,
    `$1["Card Link"]`,
  );

  // <Link field={fields.Image}>…<Image|figure>…</Link> → unwrap (ImageField is not a LinkField)
  text = text.replace(
    /<Link\s+field=\{((?:props\.)?fields(?:\[["'][^"']*Image[^"']*["']\]|\.Image))\}\s*>\s*([\s\S]*?)\s*<\/Link>/gi,
    '$2',
  );

  // Link field typed as ImageField on Fields interface — unwrap those mounts
  const imageFieldKeys = [];
  const fieldsBody = text.match(/\b(?:interface|type)\s+Fields\s*=?\s*\{([\s\S]*?)\n\}/);
  if (fieldsBody) {
    const re = /["']([^"']+)["']\s*[?]?\s*:\s*ImageField\b|\b([A-Za-z_][\w]*)\s*[?]?\s*:\s*ImageField\b/g;
    let km;
    while ((km = re.exec(fieldsBody[1] || ''))) {
      imageFieldKeys.push(km[1] || km[2]);
    }
  }
  for (const key of imageFieldKeys) {
    if (!key || /link/i.test(key)) continue;
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const access =
      /\s/.test(key)
        ? `\\[\\s*["']${esc}["']\\s*\\]`
        : `(?:\\.${esc}|\\[\\s*["']${esc}["']\\s*\\])`;
    const wrapRe = new RegExp(
      `<Link\\s+field=\\{((?:props\\.)?fields${access})\\}\\s*>\\s*([\\s\\S]*?)\\s*<\\/Link>`,
      'gi',
    );
    text = text.replace(wrapRe, '$2');
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: Image-in-Link — Card Link access / unwrap ImageField Link wrappers',
    );
  }
  return text;
}

/**
 * Parse definition Image seeds that include svgMarkup (mask/chrome SVGs).
 * @param {string|null|undefined} definitionTs
 * @returns {Map<string, string>} field name → svg markup
 */
/**
 * Parse a JS/TS string literal starting at `from` (index of opening quote).
 * Handles \\ escapes inside "…" / '…' and raw template literals without ${}.
 * @param {string} src
 * @param {number} from
 * @returns {{ value: string, end: number }|null}
 */
function parseJsStringLiteralAt(src, from) {
  const q = src[from];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  if (q === '`') {
    const end = src.indexOf('`', from + 1);
    if (end < 0) return null;
    return { value: src.slice(from + 1, end), end: end + 1 };
  }
  let i = from + 1;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      const n = src[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 'r') out += '\r';
      else if (n === 't') out += '\t';
      else out += n;
      i += 2;
      continue;
    }
    if (ch === q) return { value: out, end: i + 1 };
    out += ch;
    i += 1;
  }
  return null;
}

export function extractSvgMarkupSeedsFromDefinition(definitionTs) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const def = String(definitionTs || '');
  if (!def.trim()) return out;
  // 'Field Name': { … svgMarkup: "…" … } — value may contain escaped quotes
  const fieldRe = /['"]([^'"]+)['"]\s*:\s*\{/g;
  let fm;
  while ((fm = fieldRe.exec(def))) {
    const name = fm[1];
    const braceStart = fm.index + fm[0].length - 1;
    let depth = 0;
    let i = braceStart;
    for (; i < def.length; i += 1) {
      const ch = def[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      } else if (ch === '"' || ch === "'" || ch === '`') {
        const parsed = parseJsStringLiteralAt(def, i);
        if (parsed) i = parsed.end - 1;
      }
    }
    const body = def.slice(braceStart, i);
    const svgIdx = body.search(/\bsvgMarkup\s*:/);
    if (svgIdx < 0) continue;
    const after = body.slice(svgIdx).match(/\bsvgMarkup\s*:\s*/);
    if (!after) continue;
    const litStart = svgIdx + after[0].length;
    const lit = parseJsStringLiteralAt(body, litStart);
    if (!lit) continue;
    const markup = String(lit.value || '').trim();
    if (markup && /<svg[\s>]/i.test(markup)) out.set(name, markup);
  }
  return out;
}

/**
 * When definition has svgMarkup for Mask fields, paint mask-image via data-URI (CORS-safe).
 * @param {string} source
 * @param {string|null|undefined} definitionTs
 * @returns {string}
 */
export function rewriteMaskPaintFromSvgMarkup(source, definitionTs) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/maskImage|WebkitMaskImage|mask-image/i.test(text)) return text;
  const seeds = extractSvgMarkupSeedsFromDefinition(definitionTs);
  if (!seeds.size) return text;
  const before = text;
  /** @type {string[]} */
  const consts = [];
  let constIdx = 0;

  for (const [fieldName, markup] of seeds) {
    if (!/mask/i.test(fieldName)) continue;
    const esc = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fieldAccessRe = new RegExp(
      `(?:(?:props\\.)?fields\\[\\s*['"]${esc}['"]\\s*\\]|(?:props\\.)?fields\\.${esc.replace(/\s+/g, '')})`,
    );
    if (!fieldAccessRe.test(text) && !new RegExp(esc, 'i').test(text)) continue;

    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    const constName = `__maskSvgDataUri_${constIdx++}`;
    consts.push(`const ${constName} = ${JSON.stringify(dataUri)};`);

    // Replace ternary / direct maskImage values that reference this field's getImageSrc var or field
    const pascal = fieldName.replace(/\s+/g, '');
    const varHint = pascal.replace(/Mask$/i, 'Mask').replace(/^./, (c) => c.toLowerCase());
    // mobileMask / desktopMask style locals from getImageSrc(fields['… Mask'])
    const localRe = new RegExp(
      `\\b((?:${pascal}|${varHint}|${pascal.replace(/([a-z])([A-Z])/g, '$1$2')})[A-Za-z]*)\\b`,
      'i',
    );
    // Prefer: any maskImage/WebkitMaskImage value that uses url(${…}) tied to Mask naming
    text = text.replace(
      /(\b(?:WebkitMaskImage|maskImage)\s*:\s*)([^,}\n]+)/g,
      (full, prop, val) => {
        const v = String(val || '');
        if (!/url\s*\(/i.test(v) && !/\$\{/.test(v)) return full;
        if (
          fieldAccessRe.test(v) ||
          new RegExp(`\\b${pascal}\\b`, 'i').test(v) ||
          (localRe.test(v) && /mask/i.test(v))
        ) {
          return `${prop}\`url(\${${constName}})\``;
        }
        // Heuristic: Mobile Mask → mobileMask local
        const short = fieldName.toLowerCase().includes('mobile')
          ? 'mobile'
          : fieldName.toLowerCase().includes('desktop')
            ? 'desktop'
            : '';
        if (short && new RegExp(`${short}Mask`, 'i').test(v)) {
          return `${prop}\`url(\${${constName}})\``;
        }
        return full;
      },
    );
  }

  if (consts.length && text !== before) {
    // Insert consts after imports / before first export or component
    const insertAt =
      text.search(/\nexport\s/);
    if (insertAt >= 0) {
      text = `${text.slice(0, insertAt)}\n${consts.join('\n')}\n${text.slice(insertAt)}`;
    } else {
      text = `${consts.join('\n')}\n${text}`;
    }
    fixupWarn(
      '  ⚠ Codegen fixup: mask-image painted from definition svgMarkup data-URI (CORS-safe)',
    );
  }
  return text;
}

/**
 * Strip cross-origin CSS mask-image (absolute http(s) or field-src url()) that CORS-blanks content.
 * Keeps backgroundImage decorative layers. Call after rewriteMaskPaintFromSvgMarkup.
 * @param {string} source
 * @returns {string}
 */
export function stripCrossOriginCssMaskImage(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/maskImage|WebkitMaskImage|mask-image|maskSize|maskRepeat/i.test(text)) {
    return text;
  }
  const before = text;

  // style={{ … maskImage: `url(${…})` / url(https://…) … }}
  // Value matcher must allow `${…}` braces and nested template literals — not [^,}\n]+.
  text = text.replace(
    /(\b(?:WebkitMaskImage|maskImage|WebkitMaskSize|maskSize|WebkitMaskRepeat|maskRepeat)\s*:\s*)((?:`[^`]*`|'[^']*'|"[^"]*"|[^,`'"}\n]|\$\{[^}]*\})+)/g,
    (full, prop, val) => {
      const v = String(val || '').trim();
      const propName = String(prop).replace(/\s*:\s*$/, '');
      // Keep size/repeat tokens unless they embed a url()
      if (/Size|Repeat/i.test(propName) && !/url\s*\(/i.test(v)) {
        return full;
      }
      // Keep data-URI masks (svgMarkup rewrite / inline const)
      if (
        /url\(\s*(['"`]?)data:image\//i.test(v) ||
        /data:image\/svg/i.test(v) ||
        /__maskSvgDataUri_/.test(v)
      ) {
        return full;
      }
      if (
        /url\(\s*(['"`]?)https?:\/\//i.test(v) ||
        /url\s*\(\s*`?\s*\$\{/.test(v) ||
        /getImageSrc\s*\(/.test(v)
      ) {
        return `${prop}undefined`;
      }
      return full;
    },
  );

  // Tailwind arbitrary [mask-image:url(https://…)]
  text = text.replace(
    /\s*\[(?:-webkit-)?mask-image:url\(['"]?https?:\/\/[^\]'"]+['"]?\)\]/gi,
    '',
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped cross-origin CSS mask-image (CORS blanks masked content)',
    );
  }
  return text;
}

/**
 * @param {string} media
 * @param {number} nextMin
 * @returns {string}
 */
function visibilityClassForMedia(media, nextMin) {
  const m = /\(min-width:\s*(\d+)px\)/i.exec(String(media || ''));
  const min = m ? Number(m[1]) : 0;
  if (!Number.isFinite(min) || min <= 1) {
    if (nextMin > 0) return `block min-[${nextMin}px]:hidden`;
    return 'block';
  }
  if (nextMin > min) {
    return `hidden min-[${min}px]:block min-[${nextMin}px]:hidden`;
  }
  // Tailwind md = 768
  if (min >= 768) return 'hidden md:block';
  return `hidden min-[${min}px]:block`;
}

/**
 * Rewrite salvageable <picture>+<source srcSet={ident}> to multi-<Image> with visibility classes.
 * Only when an <Image field={…}> fallback already exists inside the picture.
 * @param {string} source
 * @returns {string}
 */
export function rewritePictureSrcSetToImages(source) {
  let text = String(source || '');
  if (!text.trim() || !/<picture\b/i.test(text)) return text;
  const before = text;

  /** @type {Map<string, string>} */
  const identToField = new Map();
  for (const bm of text.matchAll(
    /\b(?:const|let|var)\s+([A-Za-z_][\w]*)\s*=\s*getImageSrc\s*\(\s*((?:props\.)?fields\s*(?:\[[^\]]+\]|\.\w+))\s*\)/g,
  )) {
    identToField.set(bm[1], bm[2]);
  }

  text = text.replace(
    /<picture\b([^>]*)>([\s\S]*?)<\/picture>/gi,
    (full, picAttrs, body) => {
      const imageMount = /<Image\b[^>]*\bfield=\{[^}]+\}[^>]*\/?>/.exec(body);
      if (!imageMount) return full;
      // Already has multiple Image mounts (Crelan-style) — leave picture wrapper if only spans+Images.
      if ((body.match(/<Image\b/g) || []).length > 1) {
        // Drop raw <source srcSet> if any remain beside multi-Image.
        if (/<source\b/i.test(body)) {
          return body.replace(/<source\b[^>]*\/?>/gi, '').trim();
        }
        return full;
      }
      const sources = [
        ...body.matchAll(
          /<source\b[^>]*\bmedia=(["'])([^"']+)\1[^>]*\bsrcSet=\{([^}]+)\}[^>]*\/?>|<source\b[^>]*\bsrcSet=\{([^}]+)\}[^>]*\bmedia=(["'])([^"']+)\5[^>]*\/?>/gi,
        ),
      ];
      if (!sources.length) {
        return imageMount[0];
      }

      /** @type {{ media: string, fieldExpr: string, min: number }[]} */
      const mapped = [];
      for (const sm of sources) {
        const media = sm[2] || sm[6] || '';
        const ident = String(sm[3] || sm[4] || '').trim();
        const fieldExpr = identToField.get(ident);
        if (!fieldExpr) continue;
        const minM = /\(min-width:\s*(\d+)px\)/i.exec(media);
        mapped.push({
          media,
          fieldExpr,
          min: minM ? Number(minM[1]) : 0,
        });
      }

      const fallbackField =
        /field=\{([^}]+)\}/.exec(imageMount[0])?.[1]?.trim() || '';
      const classMatch = /\bclassName="([^"]*)"/.exec(imageMount[0]);
      const baseClass = classMatch ? classMatch[1] : 'block h-full w-full object-cover';

      if (mapped.length >= 2) {
        mapped.sort((a, b) => a.min - b.min);
        const parts = mapped.map((row, i) => {
          const nextMin = i + 1 < mapped.length ? mapped[i + 1].min : 0;
          const vis = visibilityClassForMedia(row.media, nextMin);
          // Highest breakpoint: hide below, show from min up (no upper bound)
          const visFinal =
            i === mapped.length - 1
              ? row.min >= 768
                ? 'hidden md:block'
                : row.min > 1
                  ? `hidden min-[${row.min}px]:block`
                  : 'block'
              : vis;
          return `<Image field={${row.fieldExpr}} className="${visFinal} ${baseClass}" />`;
        });
        // Ensure fallback field also represented if missing
        if (
          fallbackField &&
          !mapped.some((r) => r.fieldExpr.replace(/\s/g, '') === fallbackField.replace(/\s/g, ''))
        ) {
          parts.unshift(
            `<Image field={${fallbackField}} className="block min-[340px]:hidden ${baseClass}" />`,
          );
        }
        const picClass = /\bclassName="([^"]*)"/.exec(String(picAttrs || ''));
        const wrapClass = picClass ? picClass[1] : 'block h-full w-full';
        return `<div className="${wrapClass}">\n${parts.join('\n')}\n</div>`;
      }

      // Single mapped / unmapped sources — unwrap to SDK Image (drop raw srcSet).
      return imageMount[0];
    },
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: collapsed <picture>/<source srcSet> to Content SDK <Image>',
    );
  }
  return text;
}

/**
 * Ensure peer-card host track around AppPlaceholder has items-stretch + [&>*]:h-full.
 * Narrow string rewrite — no AST.
 * @param {string} source
 * @param {object|null|undefined} sectionInfo
 * @returns {string}
 */
export function ensureEqualHeightTrackAroundAppPlaceholder(source, sectionInfo) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!layoutWantsEqualHeightChildren(sectionInfo)) return text;
  if (!/\bAppPlaceholder\b/.test(text)) return text;

  const hasStretch = /\bitems-stretch\b/.test(text);
  const hasFill =
    /\[&>\*\]:h-full|\bself-stretch\b/.test(text) ||
    /grid[\s\S]{0,160}items-stretch/.test(text);
  if (hasStretch && hasFill) return text;

  const tokensToAdd = [];
  if (!hasStretch) tokensToAdd.push('items-stretch');
  if (!/\[&>\*\]:h-full|\bself-stretch\b/.test(text) && !hasFill) {
    tokensToAdd.push('[&>*]:h-full');
  }
  if (!tokensToAdd.length) return text;

  const prefix = tokensToAdd.join(' ');
  const apIdx = text.search(/<AppPlaceholder\b/);
  if (apIdx < 0) return text;
  const before = text.slice(0, apIdx);
  const classRe =
    /className\s*=\s*(?:\{\s*`([^`]*)`\s*\}|"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
  /** @type {RegExpExecArray|null} */
  let last = null;
  let m;
  while ((m = classRe.exec(before))) last = m;
  if (!last) {
    return text.replace(
      /(<AppPlaceholder\b[\s\S]*?(?:\/>|<\/AppPlaceholder>))/,
      `<div className="flex ${prefix}">$1</div>`,
    );
  }
  const full = last[0];
  const cls =
    last[1] ?? last[2] ?? last[3] ?? last[4] ?? last[5] ?? '';
  if (
    /\bitems-stretch\b/.test(cls) &&
    (/\[&>\*\]:h-full|\bself-stretch\b/.test(cls) ||
      /\bgrid\b/.test(cls))
  ) {
    return text;
  }
  const nextCls = `${prefix} ${cls}`.trim();
  const patched = full.includes('`')
    ? full.replace(/`[^`]*`/, `\`${nextCls}\``)
    : full.replace(/(["'])([^"']*)\1/, (_sm, q) => `${q}${nextCls}${q}`);
  return before.slice(0, last.index) + patched + before.slice(last.index + full.length) + text.slice(apIdx);
}

/**
 * Temporary kill switch for write-path always-on TSX sanitizers.
 * Set `true` to restore mechanical rewrites on create / build-repair.
 */
export const WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED = false;

/**
 * Write-path / build-gate always-on sanitizers (prompt-first safe).
 * Same set as write-component final normalize, plus {@link ensureJsxNamespaceImport}.
 *
 * @param {{
 *   tsx?: string|null,
 *   clientTsx?: string|null,
 *   kebab?: string|null,
 *   sectionInfo?: object|null,
 *   role?: string|null,
 *   definitionTs?: string|null,
 *   sectionHtml?: string|null,
 *   fontSvg?: string|null,
 * }} opts
 * @returns {{ tsx: string, clientTsx: string|null, definitionTs: string }}
 */
export function applyWritePathAlwaysOnTsxSanitizers(opts = {}) {
  if (!WRITE_PATH_ALWAYS_ON_TSX_SANITIZERS_ENABLED) {
    // Kill switch off: still run desktop md→lg + list-none + JSX/Field-type
    // imports (CONTRACT mechanical-only) and strip 'use server'
    // (Next breaker tsc alone may miss).
    let tsx = opts.tsx != null ? String(opts.tsx) : '';
    let clientTsx =
      opts.clientTsx != null && String(opts.clientTsx).trim()
        ? String(opts.clientTsx)
        : null;
    if (tsx.trim()) {
      tsx = stripForbiddenUseServerDirective(tsx);
      tsx = normalizeDesktopLayoutToLg(tsx);
      tsx = ensureListNoneOnLists(tsx);
      tsx = ensureJsxNamespaceImport(tsx);
      tsx = ensureFieldTypesFromContentSdk(tsx);
    }
    if (clientTsx) {
      clientTsx = stripForbiddenUseServerDirective(clientTsx);
      clientTsx = normalizeDesktopLayoutToLg(clientTsx);
      clientTsx = ensureListNoneOnLists(clientTsx);
      clientTsx = ensureJsxNamespaceImport(clientTsx);
      clientTsx = ensureFieldTypesFromContentSdk(clientTsx);
    }
    return {
      tsx,
      clientTsx,
      definitionTs: opts.definitionTs != null ? String(opts.definitionTs) : '',
    };
  }
  const rawClient =
    opts.clientTsx != null && String(opts.clientTsx).trim().length > 0
      ? String(opts.clientTsx)
      : null;
  const kebab = opts.kebab || null;
  const sectionInfo = opts.sectionInfo || null;
  const equalHeight = layoutWantsEqualHeightChildren(sectionInfo);
  const sectionHtml =
    opts.sectionHtml != null ? String(opts.sectionHtml) : '';
  const fontSvg = opts.fontSvg != null ? String(opts.fontSvg) : '';

  // Promote Multi-LineText JSON card bags → childItemTemplate + getDatasource
  // before other sanitizers (real Sitecore items for apply/authoring/Edge).
  // Feature title/body bags also get Icon svgMarkup from icon-font glyphs.
  const promoted = promoteJsonBagPackageAlwaysOn({
    definitionTs: opts.definitionTs != null ? String(opts.definitionTs) : '',
    tsx: opts.tsx != null ? String(opts.tsx) : '',
    sectionHtml,
    fontSvg,
  });
  if (promoted.promoted.length) {
    noteFixup(
      `json-bag→childItemTemplate: ${promoted.promoted.join(', ')}`,
    );
  }

  // childItemTemplate already present but TSX still fields.Cards.map → children.results;
  // seed missing media children from section HTML under the Heading band.
  const aligned = alignChildItemTemplateMapsAlwaysOn({
    definitionTs: promoted.definitionTs,
    tsx: promoted.tsx,
    sectionHtml,
    fontSvg,
  });
  if (aligned.rewritten.length) {
    noteFixup(
      `childItemTemplate map→children.results: ${aligned.rewritten.join(', ')}`,
    );
  }
  if (aligned.seeded) {
    noteFixup('childItemTemplate: seeded children from section HTML under Heading');
  }

  // After promote/seed, Path-sanitize item/children names (titles with ? etc.).
  const pathSanitized = sanitizeDefinitionContentItemPathNamesSync(
    aligned.definitionTs,
  );
  if (pathSanitized.changed > 0) {
    noteFixup(
      `Path name sanitize: ${pathSanitized.changed} content item/children name(s)`,
    );
  }

  /** @param {string} text */
  function applyLayoutTracks(text) {
    let t = String(text || '');
    if (!t.trim()) return t;
    t = ensurePeerGridAroundAppPlaceholder(t, sectionInfo);
    if (equalHeight) {
      t = ensureEqualHeightTrackAroundAppPlaceholder(t, sectionInfo);
    }
    return t;
  }

  const definitionTs = pathSanitized.text;

  /** @param {string} text */
  function sanitizeCommon(text) {
    let t = String(text || '');
    if (!t.trim()) return t;
    t = quoteBareMultiWordFieldsKeys(t);
    t = ensureSpacedFieldNamesInTsx(t);
    t = fixSpacedFieldAccess(t);
    t = ensureImageInLinkUsesLinkField(t);
    t = rewriteMaskPaintFromSvgMarkup(t, definitionTs);
    t = stripCrossOriginCssMaskImage(t);
    t = rewritePictureSrcSetToImages(t);
    t = fixGluedJsxTagAttributes(t);
    t = ensureFieldTypesFromContentSdk(t);
    t = rewriteTextOnLinkField(t);
    t = ensureSdkJsxValueImports(t);
    t = normalizeCustomEventDetailVsFieldString(t);
    t = ensureNullableJsxReturnType(t);
    t = normalizeChromeToPropsParam(t);
    t = stripCaptureDataAttributes(t);
    return t;
  }

  /** @param {string} text */
  function sanitizeMapEntry(text) {
    let t = sanitizeCommon(text);
    if (!t.trim()) return t;
    t = ensureAppPlaceholderDynamicNames(t);
    t = ensureUseClientDirective(t);
    t = stripForbiddenUseServerDirective(t);
    t = ensureJsxNamespaceImport(t);
    t = rewriteFieldsChildrenViaDatasource(t);
    t = rewriteGetDatasourceImportPath(t);
    t = normalizeDesktopLayoutToLg(t);
    t = ensureListNoneOnLists(t);
    t = applyLayoutTracks(t);
    if (kebab) t = rewriteCompanionClientImport(t, kebab);
    if (rawClient) {
      t = ensureCompanionClientImport(t, {
        kebab,
        clientTsx: rawClient,
      });
      t = stripUnknownChromeProps(t, rawClient);
      t = rewriteCompanionPropsSpread(t);
      t = ensureMapEntryUnwrapsDatasourceForCompanion(t, rawClient);
      t = ensureMapEntryPassesFieldsToCompanion(t, rawClient);
      t = ensureMapEntryFieldsTypeMatchesCompanion(t, rawClient, kebab);
    }
    return t;
  }

  /** @param {string} text */
  function sanitizeClient(text) {
    let t = sanitizeCommon(text);
    if (!t.trim()) return t;
    t = ensureCompanionClientUseClient(t);
    t = stripForbiddenUseServerDirective(t);
    t = ensureJsxNamespaceImport(t);
    t = rewriteFieldsChildrenViaDatasource(t);
    t = rewriteGetDatasourceImportPath(t);
    t = stripClientGetDatasource(t);
    t = normalizeDesktopLayoutToLg(t);
    t = ensureListNoneOnLists(t);
    t = applyLayoutTracks(t);
    // Peer PH hosts must not hardcode band titles (e.g. "Meer gezondheid") —
    // those belong on the child package Heading field for Sitecore + preview.
    t = stripHardcodedPeerBandHeadingsFromHostChrome(t, sectionHtml);
    t = narrowCompanionChromePropsType(t);
    if (kebab) t = rewriteRelativeImportsToPackageKebab(t, kebab);
    t = ensureImplicitAnyParamsTyped(t);
    t = ensureFieldsIndexedAccessTyped(t);
    t = ensureFieldsTypeExported(t);
    return t;
  }

  const tsx = sanitizeMapEntry(aligned.tsx || String(opts.tsx || ''));
  return {
    tsx,
    clientTsx: rawClient ? sanitizeClient(rawClient) : null,
    definitionTs,
  };
}

const SINGLETON_DEF_KEYS = [
  'datasourceLocation',
  'model',
  'variants',
  'placeholders',
  'content',
  'collectionSystem',
  'definitionKey',
  'componentName',
];

/**
 * Prepend `'use client'` when React client hooks are used and the directive is missing.
 * Never add it when the file contains AppPlaceholder / Placeholder (RSC: parents stay servers).
 */
export function ensureUseClientDirective(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (/^['"]use client['"];?\s*\n/.test(text)) return text;
  if (hasNestedPlaceholder(text)) return text;
  if (!CLIENT_HOOK_RE.test(text)) return text;
  return `'use client';\n\n${text.replace(/^\uFEFF/, '').replace(/^\s+/, '')}`;
}

/**
 * Filename contract for `*.client.tsx` / companion clientTsx: always start with
 * `'use client'`. Safe under prompt-first and validateClean (no hook heuristic).
 * @param {string} source
 * @returns {string}
 */
export function ensureCompanionClientUseClient(source) {
  let text = String(source || '').replace(/^\uFEFF/, '');
  if (!text.trim()) return text;
  text = dedupeUseClientDirective(text);
  if (/^['"]use client['"];?\s*\n/.test(text)) return text;
  return `'use client';\n${text.replace(/^\s+/, '')}`;
}

/**
 * Strip `'use server'` from map-entry / companion sources.
 * Sitecore Content SDK components are RSC or `'use client'` chrome — never Server Actions.
 * Leading `'use server'` makes Next treat `export const Default` as a Server Action
 * ("Server Actions must be async functions" on Turbopack build).
 * @param {string} source
 * @returns {string}
 */
export function stripForbiddenUseServerDirective(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/['"]use server['"]/.test(text)) return text;
  const before = text;
  // Leading file directive (with optional BOM / blank lines after).
  text = text.replace(/^\uFEFF?\s*['"]use server['"];?\s*\r?\n+/, '');
  // Stray mid-file directives AI sometimes inserts before exports.
  text = text.replace(/^\s*['"]use server['"];?\s*\r?\n+/gm, '');
  if (text !== before) {
    fixupWarn(
      "  ⚠ Codegen fixup: stripped forbidden 'use server' (Sitecore map-entry/chrome are not Server Actions)",
    );
  }
  return text;
}

/**
 * True when map-entry imports a local `./….client` companion.
 * @param {string} source
 * @returns {boolean}
 */
export function mapEntryImportsCompanionClient(source) {
  // Default-only OR default + named/type: `import Foo, { type Bars } from './x.client'`
  return /\bimport\s+[A-Za-z_$][\w$]*(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]\.\/[^'"]+\.client['"]/.test(
    String(source || ''),
  );
}

/**
 * Strip `'use client'` and client hooks from main TSX when it also uses AppPlaceholder / Placeholder.
 * Rewrites common useRef scroll-button carousels to CSS-only (RelatedContentCarousel style).
 */
export function resolvePlaceholderClientConflict(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!hasNestedPlaceholder(text)) return text;

  const hadUseClient = /^['"]use client['"];?\s*\n/.test(text);
  const hadHooks = CLIENT_HOOK_RE.test(text);
  if (!hadUseClient && !hadHooks) return text;

  fixupWarn(
    '  ⚠ React Server Components (RSC) fixup: main TSX had AppPlaceholder/Placeholder + use client/hooks; converting to Server Component (CSS-only scroll if applicable)',
  );

  text = text.replace(/^['"]use client['"];?\s*\n+/, '');

  // Drop react hook imports
  text = text.replace(
    /^import\s*\{[^}]*\}\s*from\s*['"]react['"];?\s*\n/gm,
    (imp) => {
      const cleaned = imp
        .replace(/\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useLayoutEffect)\b\s*,?\s*/g, '')
        .replace(/,\s*}/, ' }')
        .replace(/\{\s*}/, '');
      if (/import\s*\{\s*\}\s*from/.test(cleaned) || /import\s*\{\s*,/.test(cleaned)) return '';
      if (!/\b(useState|useEffect|useRef|useCallback|useMemo|useReducer|useLayoutEffect)\b/.test(cleaned) &&
          /import\s*\{[^}]*\}\s*from\s*['"]react['"]/.test(cleaned)) {
        // still has other named imports from react
        return cleaned.replace(/,\s*,/g, ',').replace(/\{\s*,/, '{').replace(/,\s*}/, ' }');
      }
      return /\{[^}]*\w/.test(cleaned) ? cleaned : '';
    },
  );

  // Remove useRef / useState declarations (simple single-line)
  text = text.replace(
    /^\s*const\s+\[[^\]]+\]\s*=\s*useState\s*<[^>]*>\([^)]*\);\s*\n/gm,
    '',
  );
  text = text.replace(/^\s*const\s+\[[^\]]+\]\s*=\s*useState\([^)]*\);\s*\n/gm, '');
  text = text.replace(
    /^\s*const\s+\w+\s*=\s*useRef\s*<[^>]*>\([^)]*\);\s*\n/gm,
    '',
  );
  text = text.replace(/^\s*const\s+\w+\s*=\s*useRef\([^)]*\);\s*\n/gm, '');

  // Remove scrollCards helpers
  text = text.replace(
    /^\s*const\s+scrollCards\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\};\s*\n/gm,
    '',
  );

  // Drop onClick / ref that depended on hooks
  text = text.replace(/\s+onClick=\{[^}]+\}/g, '');
  text = text.replace(/\s+ref=\{[^}]+\}/g, '');
  // Mark carousel control buttons disabled when they lost handlers
  text = text.replace(
    /<button(?![^>]*\bdisabled\b)([^>]*aria-label=["'](?:Vorige|Volgende|Previous|Next)["'][^>]*)>/gi,
    '<button disabled$1>',
  );

  if (CLIENT_HOOK_RE.test(text)) {
    fixupWarn(
      '  ⚠ React Server Components (RSC) fixup: residual client hooks after Placeholder conflict scrub — remove manually if build fails',
    );
  }

  return text;
}

/**
 * Prefer AppPlaceholder + server component-map for composite parents.
 * Rewrites simple `<Placeholder name=… rendering=… />` to AppPlaceholder with page + map.
 */
export function preferAppPlaceholder(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const hasClientPlaceholder =
    /<Placeholder\b/.test(text) ||
    (/\bPlaceholder\b/.test(text) && !/\bAppPlaceholder\b/.test(text));
  if (!hasClientPlaceholder) {
    return ensureAppPlaceholderImports(text);
  }

  fixupWarn(
    '  ⚠ React Server Components (RSC) fixup: replacing client <Placeholder> with AppPlaceholder + server component-map',
  );

  // Replace JSX tags first
  text = text.replace(/<Placeholder\b/g, '<AppPlaceholder');
  text = text.replace(/<\/Placeholder>/g, '</AppPlaceholder>');

  // Ensure page + componentMap props on each AppPlaceholder that lacks them
  text = text.replace(/<AppPlaceholder\b([^>]*?)\/>/g, (full, attrs) => {
    let next = attrs;
    if (!/\bpage=/.test(next)) {
      next += ' page={props.page}';
    }
    if (!/\bcomponentMap=/.test(next)) {
      next += ' componentMap={componentMap}';
    }
    // Normalize to multiline self-closing tag
    const name = (next.match(/\bname=\{([^}]+)\}/) || [])[1];
    const rendering = (next.match(/\brendering=\{([^}]+)\}/) || [])[1];
    if (name && rendering) {
      return `<AppPlaceholder\n        name={${name}}\n        rendering={${rendering}}\n        page={props.page}\n        componentMap={componentMap}\n      />`;
    }
    return `<AppPlaceholder${next} />`;
  });

  text = ensureAppPlaceholderImports(text);
  text = ensureComponentWithContextProps(text);
  return text;
}

/** Carousel track when capture shows a slider (not the default for bare placeholders). */
export const PLACEHOLDER_CHILD_LAYOUT_CLASS =
  'flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center lg:gap-[30px] [&>*]:w-[min(90%,350px)] [&>*]:shrink-0 [&>*]:snap-center';

/** Neutral flex wrap when layout mode is unknown — no snap-x carousel. */
export const PLACEHOLDER_NEUTRAL_LAYOUT_CLASS =
  'flex flex-wrap items-stretch gap-4 lg:justify-center';

/** Equal-width column strip for metrics / stats (columns from tablet `md:` up). */
export const PLACEHOLDER_METRIC_STRIP_LAYOUT_CLASS =
  'flex flex-col items-stretch justify-center text-center md:flex-row md:flex-wrap md:[&>*]:box-border md:[&>*]:w-1/3 md:[&>*]:shrink-0 md:[&>*]:px-5 md:[&>*+*]:border-l md:[&>*+*]:border-solid md:[&>*+*]:border-black/25 [&>*+*]:mt-12 md:[&>*+*]:mt-0';

/** Equal-width desktop columns (desktop = `lg:` ≥1024). */
export const PLACEHOLDER_COLUMNS_LAYOUT_CLASS =
  'flex flex-col items-stretch gap-4 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-[30px] lg:[&>*]:min-w-0 lg:[&>*]:flex-1';

/** Intrinsic DOM tags — not custom chrome components. */
const PLACEHOLDER_DOM_PARENT_TAG_RE =
  /^(div|section|article|aside|main|nav|ul|ol|li|span|header|footer|fragment|Fragment)$/i;

/** Media-tabs: PH children must not stack as block siblings — parent chrome owns layout. */
export const PLACEHOLDER_MEDIA_TABS_LAYOUT_CLASS =
  'flex w-full min-w-0 flex-col [&>*]:min-w-0';

/**
 * True when the JSX tag is a custom component (PascalCase), not a DOM element.
 * Client chrome (AnnouncementChrome, *CarouselChrome, …) owns PH child layout.
 * @param {string} tag
 */
export function isCustomChromeJsxTag(tag) {
  const t = String(tag || '');
  return /^[A-Z]/.test(t) && !PLACEHOLDER_DOM_PARENT_TAG_RE.test(t);
}

/**
 * True when `parentTag` is imported from a `*.client` module in `source`.
 * @param {string} source
 * @param {string} parentTag
 */
export function parentIsImportedClientChrome(source, parentTag) {
  const tag = String(parentTag || '').trim();
  if (!tag || !/^[A-Za-z_][\w]*$/.test(tag)) return false;
  const text = String(source || '');
  const defaultImport = new RegExp(
    `import\\s+${tag}\\s+from\\s+['"][^'"]*\\.client['"]`,
  );
  if (defaultImport.test(text)) return true;
  const namedImport = new RegExp(
    `import\\s*\\{[^}]*\\b${tag}\\b[^}]*\\}\\s*from\\s*['"][^'"]*\\.client['"]`,
  );
  return namedImport.test(text);
}

/**
 * Unwrap nested snap-x carousel wrappers inside equal-width column parents.
 * AI/fixup sometimes nests `PLACEHOLDER_CHILD_LAYOUT_CLASS` inside a metric
 * strip — the outer `[&>*]:w-1/3` then shrinks the whole carousel and children pile up.
 * Also collapses double snap-x wrappers (outer carousel + default fixup wrapper).
 * @param {string} source
 */
export function unwrapNestedPlaceholderCarousel(source) {
  let text = String(source || '');
  if (!text.trim() || !/<AppPlaceholder\b/.test(text)) return text;

  let unwrapped = 0;

  // Outer column strip ([&>*]:w-1/3) wrapping inner snap-x → drop inner
  text = text.replace(
    /(<div\b[^>]*\bclassName=(["'`])([^"'`]*\[&>\*\]:w-1\/3[^"'`]*)\2[^>]*>)\s*<div\b[^>]*\bclassName=(["'`])([^"'`]*\bsnap-x\b[^"'`]*)\4[^>]*>\s*(<AppPlaceholder\b[\s\S]*?\/>)\s*<\/div>/g,
    (full, outerOpen, _q1, _c1, _q2, _c2, ph) => {
      unwrapped += 1;
      return `${outerOpen}\n          ${ph}`;
    },
  );

  // Double snap-x: outer snap-x wrapping inner default snap-x → drop inner
  text = text.replace(
    /(<div\b[^>]*\bclassName=(["'`])([^"'`]*\bsnap-x\b[^"'`]*)\2[^>]*>)\s*<div\b[^>]*\bclassName=(["'`])([^"'`]*\bsnap-x\b[^"'`]*)\4[^>]*>\s*(<AppPlaceholder\b[\s\S]*?\/>)\s*<\/div>/g,
    (full, outerOpen, _q1, _c1, _q2, _c2, ph) => {
      unwrapped += 1;
      return `${outerOpen}\n            ${ph}`;
    },
  );

  if (unwrapped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: unwrapped ${unwrapped} nested placeholder layout wrapper(s)`,
    );
  }
  return text;
}

/**
 * Extract className string from an opening JSX tag (static string or simple template).
 * @param {string} openTag
 * @returns {string}
 */
function extractJsxClassName(openTag) {
  const lit = openTag.match(/\bclassName\s*=\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
  if (lit) return lit[2];
  const tmpl = openTag.match(/\bclassName\s*=\s*\{`([^`]*)`\}/);
  if (tmpl) return tmpl[1];
  const braced = openTag.match(/\bclassName\s*=\s*\{(["'])((?:\\.|(?!\1)[^\\])*)\1\}/);
  if (braced) return braced[2];
  return '';
}

/**
 * Scan forward from `<` for a complete JSX/HTML tag, respecting quoted attrs
 * (so `className="[&>*]:…"` does not truncate on the `>` inside the string).
 * @param {string} source
 * @param {number} start index of `<`
 * @returns {{ end: number, full: string }|null}
 */
function scanJsxTagEnd(source, start) {
  if (source[start] !== '<') return null;
  let i = start + 1;
  let quote = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\' && (quote === '"' || quote === "'")) {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '>') {
      return { end: i + 1, full: source.slice(start, i + 1) };
    }
    i += 1;
  }
  return null;
}

/**
 * Find the open tag of the immediate JSX parent of the node at `index`.
 * @param {string} source
 * @param {number} index
 * @returns {{ tag: string, className: string, full: string, start: number }|null}
 */
function findImmediateParentOpenTag(source, index) {
  const slice = source.slice(0, index);
  /** @type {Array<{ full: string, tag: string, selfClosing: boolean, closing: boolean, start: number }>} */
  const tags = [];
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] !== '<') continue;
    if (slice.startsWith('<!--', i)) {
      const end = slice.indexOf('-->', i + 4);
      if (end < 0) break;
      i = end + 2;
      continue;
    }
    const scanned = scanJsxTagEnd(slice, i);
    if (!scanned) break;
    const full = scanned.full;
    const closing = /^<\//.test(full);
    const selfClosing = /\/\s*>$/.test(full);
    const tagMatch = full.match(/^<\/?\s*([A-Za-z][\w.]*)/);
    if (tagMatch) {
      tags.push({
        full,
        tag: tagMatch[1],
        selfClosing,
        closing,
        start: i,
      });
    }
    i = scanned.end - 1;
  }

  let depth = 0;
  for (let i = tags.length - 1; i >= 0; i--) {
    const t = tags[i];
    if (t.closing) {
      depth += 1;
      continue;
    }
    if (t.selfClosing) continue;
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    return {
      tag: t.tag,
      className: extractJsxClassName(t.full),
      full: t.full,
      start: t.start,
    };
  }
  return null;
}

function ensureAppPlaceholderImports(source) {
  let text = source;
  if (!/\bAppPlaceholder\b/.test(text)) return text;

  // Swap Placeholder → AppPlaceholder in SDK value imports
  text = text.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/g,
    (full, names) => {
      let next = names;
      if (/\bPlaceholder\b/.test(next) && !/\bAppPlaceholder\b/.test(next)) {
        next = next.replace(/\bPlaceholder\b/g, 'AppPlaceholder');
      } else if (!/\bAppPlaceholder\b/.test(next) && !/\bPlaceholder\b/.test(next)) {
        next = `AppPlaceholder, ${next.trim()}`;
      }
      return `import {${next}} from '@sitecore-content-sdk/nextjs'`;
    },
  );

  if (!/from\s*['"]\.sitecore\/component-map['"]/.test(text)) {
    const sdkImport = text.match(
      /^import\s+[\s\S]*?from\s*['"]@sitecore-content-sdk\/nextjs['"];?\s*\n/m,
    );
    const insert = `import componentMap from '.sitecore/component-map';\n`;
    if (sdkImport) {
      const idx = sdkImport.index + sdkImport[0].length;
      text = text.slice(0, idx) + insert + text.slice(idx);
    } else {
      text = insert + text;
    }
  }

  return text;
}

function ensureComponentWithContextProps(source) {
  let text = source;
  if (!/\bAppPlaceholder\b/.test(text)) return text;

  if (/ComponentWithContextProps/.test(text)) {
    // Prefer ComponentWithContextProps over ComponentProps for the main props type
    text = text.replace(
      /type\s+(\w+)\s*=\s*ComponentProps\s*&/g,
      'type $1 = ComponentWithContextProps &',
    );
    return text;
  }

  // Upgrade import { ComponentProps } → type { ComponentWithContextProps }
  if (/import\s*\{\s*ComponentProps\s*\}\s*from\s*['"]lib\/component-props['"]/.test(text)) {
    text = text.replace(
      /import\s*\{\s*ComponentProps\s*\}\s*from\s*['"]lib\/component-props['"]/,
      "import type { ComponentWithContextProps } from 'lib/component-props'",
    );
  } else if (
    /import\s+type\s*\{\s*ComponentProps\s*\}\s*from\s*['"]lib\/component-props['"]/.test(text)
  ) {
    text = text.replace(
      /import\s+type\s*\{\s*ComponentProps\s*\}\s*from\s*['"]lib\/component-props['"]/,
      "import type { ComponentWithContextProps } from 'lib/component-props'",
    );
  } else if (!/from\s*['"]lib\/component-props['"]/.test(text)) {
    text =
      `import type { ComponentWithContextProps } from 'lib/component-props';\n` + text;
  } else {
    // Mixed import — add ComponentWithContextProps if missing
    text = text.replace(
      /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]lib\/component-props['"]/,
      (full, typeKw, names) => {
        if (/\bComponentWithContextProps\b/.test(names)) return full;
        const prefix = typeKw || '';
        return `import ${prefix}{ ComponentWithContextProps, ${names.trim()} } from 'lib/component-props'`;
      },
    );
  }

  text = text.replace(
    /type\s+(\w+)\s*=\s*ComponentProps\s*&/g,
    'type $1 = ComponentWithContextProps &',
  );
  return text;
}

/**
 * Warn when client Placeholder remains without a server component map.
 */
export function warnClientPlaceholderWithoutMap(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  if (!/<Placeholder\b/.test(text) && !/\bPlaceholder\b/.test(text)) return;
  if (/\bAppPlaceholder\b/.test(text)) return;
  if (/from\s*['"]\.sitecore\/component-map['"]/.test(text)) return;
  fixupWarn(
    '  ⚠ React Server Components (RSC) fixup: nested <Placeholder> without server component-map — prefer AppPlaceholder + .sitecore/component-map',
  );
}
/**
 * Collect identifiers already imported from the SDK module (value or type).
 */
function collectSdkImports(source) {
  const imported = new Set();
  const re =
    /import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+))\s+from\s+['"]@sitecore-content-sdk\/nextjs['"]/g;
  let m;
  while ((m = re.exec(source))) {
    if (m[2]) {
      imported.add(m[2]);
      continue;
    }
    for (const part of String(m[1] || '').split(',')) {
      const cleaned = part
        .replace(/\btype\b/g, '')
        .trim()
        .split(/\s+as\s+/i)[0]
        .trim();
      if (cleaned) imported.add(cleaned);
    }
  }
  return imported;
}

/**
 * Ensure TextField / RichTextField / ImageField / LinkField / Field used in source
 * are imported from @sitecore-content-sdk/nextjs.
 */
export function ensureTsxFieldTypeImports(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const used = new Set();
  for (const name of FIELD_TYPES) {
    // Avoid matching *Field components; require type-ish usage (after : or in type position)
    const re = new RegExp(
      `(?:^|[\\s:,<>|&(\\[]|typeof\\s+)${name}\\b`,
      'm',
    );
    if (re.test(text)) used.add(name);
  }
  if (!used.size) return text;

  const imported = collectSdkImports(text);
  const missing = [...used].filter((n) => !imported.has(n));
  if (!missing.length) return text;

  const typeImport = `import type { ${missing.join(', ')} } from '${SDK_MODULE}';\n`;

  // Insert after last SDK import, or after 'use client', or at top.
  const sdkImportRe =
    /^import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"]@sitecore-content-sdk\/nextjs['"];?\s*\n/gm;
  let lastSdk = null;
  let m;
  while ((m = sdkImportRe.exec(text))) {
    lastSdk = m;
  }
  if (lastSdk) {
    const insertAt = lastSdk.index + lastSdk[0].length;
    return text.slice(0, insertAt) + typeImport + text.slice(insertAt);
  }

  const useClient = text.match(/^['"]use client['"];?\s*\n/);
  if (useClient) {
    const insertAt = useClient[0].length;
    return text.slice(0, insertAt) + typeImport + text.slice(insertAt);
  }

  return typeImport + text;
}

/**
 * Strip Field / TextField / RichTextField / ImageField / LinkField from
 * `lib/component-props` imports (those names are not re-exported — TS2459).
 * @param {string} source
 * @returns {string}
 */
export function stripFieldTypesFromLibComponentPropsImports(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const fieldTypeSet = new Set(FIELD_TYPES);
  return text.replace(
    /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]lib\/component-props['"]\s*;?/g,
    (full, typeKw, inner) => {
      const parts = String(inner || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      /** @type {string[]} */
      const kept = [];
      let stripped = false;
      for (const part of parts) {
        const name = part
          .replace(/\btype\b/g, '')
          .trim()
          .split(/\s+as\s+/i)[0]
          .trim();
        if (fieldTypeSet.has(name)) {
          stripped = true;
          continue;
        }
        kept.push(part);
      }
      if (!stripped) return full;
      if (!kept.length) return '';
      const kw = typeKw || '';
      return `import ${kw}{ ${kept.join(', ')} } from 'lib/component-props';`;
    },
  );
}

/**
 * Always-on write-path rewrite: Field\* types must come from Content SDK, never
 * from `lib/component-props`. Safe under prompt-first (deterministic import split).
 * @param {string} source
 * @returns {string}
 */
export function ensureFieldTypesFromContentSdk(source) {
  const before = String(source || '');
  if (!before.trim()) return before;
  let text = stripFieldTypesFromLibComponentPropsImports(before);
  text = ensureTsxFieldTypeImports(text);
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: Field types → import type from @sitecore-content-sdk/nextjs (not lib/component-props)',
    );
  }
  return text;
}

/**
 * Advance past a JS/TS string literal starting at `i` (must point at quote).
 * @param {string} text
 * @param {number} i
 */
function skipStringLiteral(text, i) {
  const q = text[i];
  if (q !== '"' && q !== "'" && q !== '`') return i;
  i += 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === q) return i + 1;
    i += 1;
  }
  return i;
}

/**
 * Skip a value starting at `valueStart` (object / array / string / primitive).
 * Returns index after the value and an optional trailing comma + whitespace/newline.
 * Must not stop at commas inside quoted strings (e.g. alt: "AI, Content").
 */
function skipObjectOrValue(text, valueStart) {
  let i = valueStart;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
    i = skipStringLiteral(text, i);
  } else if (text[i] === '{') {
    let depth = 0;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipStringLiteral(text, i) - 1;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
  } else if (text[i] === '[') {
    let depth = 0;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipStringLiteral(text, i) - 1;
        continue;
      }
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
  } else {
    // bare primitive / identifier until comma, newline, or closing brace
    while (
      i < text.length &&
      text[i] !== ',' &&
      text[i] !== '\n' &&
      text[i] !== '}'
    ) {
      i++;
    }
  }
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === ',') i++;
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++;
  if (text[i] === '\r') i++;
  if (text[i] === '\n') i++;
  return i;
}

/** Item-level keys that must stay outside `content.items[].fields`. */
const CONTENT_ITEM_META_KEYS = new Set([
  'name',
  'displayName',
  'fields',
  'variant',
  'children',
  'renderingIdentifier',
]);

/**
 * Find top-level `{ … }` elements inside an array literal starting at `[`.
 * @param {string} text
 * @param {number} openBracket index of `[`
 * @returns {{ start: number, closeBrace: number, after: number }[]}
 */
function findTopLevelArrayObjects(text, openBracket) {
  /** @type {{ start: number, closeBrace: number, after: number }[]} */
  const spans = [];
  let i = openBracket + 1;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') {
      i += 1;
      continue;
    }
    const start = i;
    const after = skipObjectOrValue(text, start);
    let closeBrace = after - 1;
    while (closeBrace > start && text[closeBrace] !== '}') closeBrace -= 1;
    if (text[closeBrace] !== '}') break;
    spans.push({ start, closeBrace, after });
    i = after;
  }
  return spans;
}

/**
 * AI sometimes closes `fields: { … }` too early, leaving CTA/Link/Title as item
 * siblings (`…Description: "…" }, CTA: { … }`). Lift those stray seeds back into
 * `fields` so emit/Pages see them as datasource fields.
 * @param {string} source
 */
export function liftStrayContentItemFieldSeeds(source) {
  let text = String(source || '');
  if (!text.trim() || !/\bfields\s*:\s*\{/.test(text)) return text;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;
  const contentOpen = text.indexOf('{', contentMatch.index);
  if (contentOpen < 0) return text;
  const itemsMatch = text.slice(contentOpen).match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return text;
  const itemsAbs = contentOpen + itemsMatch.index;
  const itemsBracket = text.indexOf('[', itemsAbs);
  if (itemsBracket < 0) return text;

  const items = findTopLevelArrayObjects(text, itemsBracket);
  let lifted = 0;

  for (let ii = items.length - 1; ii >= 0; ii -= 1) {
    const { start, closeBrace } = items[ii];
    const body = text.slice(start + 1, closeBrace);
    const hits = findTopLevelObjectKeyHits(body);
    const fieldsHit = hits.find((h) => h.key === 'fields');
    if (!fieldsHit) continue;

    const stray = hits.filter((h) => !CONTENT_ITEM_META_KEYS.has(h.key));
    if (!stray.length) continue;

    // Absolute offsets in `text`
    const abs = (rel) => start + 1 + rel;
    /** @type {{ key: string, literal: string, start: number, end: number }[]} */
    const pieces = [];
    for (const hit of stray) {
      const keyStart = abs(hit.start);
      const keyEnd = abs(hit.end);
      const slice = text.slice(keyStart, keyEnd);
      const colon = slice.indexOf(':');
      if (colon < 0) continue;
      const keyTok = slice.slice(0, colon).trim();
      let valuePart = slice.slice(colon + 1).trim();
      valuePart = valuePart.replace(/,\s*$/, '').trim();
      pieces.push({
        key: hit.key,
        literal: `${keyTok}: ${valuePart}`,
        start: keyStart,
        end: keyEnd,
      });
    }
    if (!pieces.length) continue;

    // Remove stray props from the item (last → first)
    pieces.sort((a, b) => b.start - a.start);
    for (const p of pieces) {
      text = text.slice(0, p.start) + text.slice(p.end);
      lifted += 1;
    }

    // Re-locate fields block in the mutated item (offsets shifted)
    const itemOpen = start;
    // closeBrace may have moved — rescan this item from original start if still `{`
    if (text[itemOpen] !== '{') continue;
    const itemAfter = skipObjectOrValue(text, itemOpen);
    let itemClose = itemAfter - 1;
    while (itemClose > itemOpen && text[itemClose] !== '}') itemClose -= 1;
    if (text[itemClose] !== '}') continue;

    const itemBody = text.slice(itemOpen + 1, itemClose);
    const fieldsRe = /\bfields\s*:\s*\{/;
    const fm = itemBody.match(fieldsRe);
    if (!fm || fm.index == null) continue;
    const fieldsKeyAbs = itemOpen + 1 + fm.index;
    const fieldsOpen = text.indexOf('{', fieldsKeyAbs);
    if (fieldsOpen < 0) continue;
    const fieldsAfter = skipObjectOrValue(text, fieldsOpen);
    let fieldsClose = fieldsAfter - 1;
    while (fieldsClose > fieldsOpen && text[fieldsClose] !== '}') fieldsClose -= 1;
    if (text[fieldsClose] !== '}') continue;

    let inner = text.slice(fieldsOpen + 1, fieldsClose).trim();
    // Insert in original order
    const insert = [...pieces].reverse();
    const existingKeys = new Set(
      findTopLevelObjectKeyHits(inner).map((h) => h.key),
    );
    const toAdd = insert.filter((p) => !existingKeys.has(p.key));
    if (!toAdd.length) continue;

    const addition = toAdd.map((p) => p.literal).join(',\n          ');
    if (inner) {
      inner = `${inner.replace(/,\s*$/, '')},\n          ${addition}`;
    } else {
      inner = addition;
    }
    text =
      text.slice(0, fieldsOpen + 1) +
      `\n          ${inner}\n        ` +
      text.slice(fieldsClose);
  }

  if (lifted > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: lifted ${lifted} stray content item field seed(s) back into fields: { … }`,
    );
  }
  return text;
}

/**
 * Within each content item `fields: { … }`, keep the **last** occurrence of each
 * property key (JS object semantics) and strip earlier duplicates
 * (e.g. two `Link:` seeds — first is silently dropped at runtime).
 */
export function dedupeContentItemFieldKeys(source) {
  let text = String(source || "");
  if (!text.trim()) return text;

  const fieldsOpenRe = /\bfields\s*:\s*\{/g;
  /** @type {{ openBrace: number; closeBrace: number }[]} */
  const blocks = [];
  let fm;
  while ((fm = fieldsOpenRe.exec(text))) {
    const openBrace = text.indexOf("{", fm.index);
    if (openBrace < 0) continue;
    // skipObjectOrValue returns index after the closing `}`
    const afterClose = skipObjectOrValue(text, openBrace);
    let closeBrace = afterClose - 1;
    while (closeBrace > openBrace && text[closeBrace] !== "}") closeBrace--;
    if (text[closeBrace] !== "}") continue;
    blocks.push({ openBrace, closeBrace });
  }

  let removed = 0;
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const { openBrace, closeBrace } = blocks[bi];
    const body = text.slice(openBrace + 1, closeBrace);
    const keyHits = findTopLevelObjectKeyHits(body);
    if (!keyHits.length) continue;

    /** @type {Map<string, typeof keyHits>} */
    const byKey = new Map();
    for (const hit of keyHits) {
      const list = byKey.get(hit.key) ?? [];
      list.push(hit);
      byKey.set(hit.key, list);
    }

    const toRemove = [];
    for (const [, list] of byKey) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length - 1; i++) {
        toRemove.push(list[i]);
      }
    }
    if (!toRemove.length) continue;

    toRemove.sort((a, b) => b.start - a.start);
    let nextBody = body;
    for (const hit of toRemove) {
      nextBody = nextBody.slice(0, hit.start) + nextBody.slice(hit.end);
      removed += 1;
    }
    text = text.slice(0, openBrace + 1) + nextBody + text.slice(closeBrace);
  }

  if (removed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: removed ${removed} duplicate content item field key(s) (kept last)`,
    );
  }
  return text;
}

/**
 * Locate top-level `key:` properties inside an object-literal body (no braces).
 * Each hit: { key, start, end } where end is past the value + optional trailing comma/newline.
 * @param {string} body
 */
function findTopLevelObjectKeyHits(body) {
  /** @type {{ key: string; start: number; end: number }[]} */
  const hits = [];
  let i = 0;
  let depth = 0;
  let inString = null;
  let escape = false;

  while (i < body.length) {
    const ch = body[i];
    if (inString) {
      if (escape) {
        escape = false;
        i++;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        i++;
        continue;
      }
      if (ch === inString) inString = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      i++;
      continue;
    }
    if (ch === "{" || ch === "[") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }

    const slice = body.slice(i);
    const km = slice.match(
      /^(\s*)(?:(["'])([^"'\\]+)\2|([A-Za-z_][\w]*))\s*:/,
    );
    if (!km) {
      i++;
      continue;
    }
    const key = km[3] || km[4];
    const keyStart = i;
    const colonInSlice = km[0].lastIndexOf(":");
    const valueStart = i + colonInSlice + 1;
    const valueEnd = skipObjectOrValue(body, valueStart);
    hits.push({ key, start: keyStart, end: valueEnd });
    i = valueEnd;
  }
  return hits;
}

/**
 * Keep the first occurrence of each singleton top-level key; strip later duplicates.
 */
export function dedupeDefinitionSingletonKeys(source, keys = SINGLETON_DEF_KEYS) {
  let text = String(source || '');
  if (!text.trim()) return text;

  for (const key of keys) {
    const re = new RegExp(`(^|\\n)([ \\t]*)${key}\\s*:`, 'g');
    const matches = [];
    let m;
    while ((m = re.exec(text))) {
      matches.push({
        index: m.index + m[1].length,
        indent: m[2] || '',
        keyStart: m.index + m[1].length + m[2].length,
      });
    }
    if (matches.length < 2) continue;

    // Remove from last to first (skip index 0)
    for (let mi = matches.length - 1; mi >= 1; mi--) {
      const hit = matches[mi];
      const colon = text.indexOf(':', hit.keyStart);
      if (colon < 0) continue;
      const end = skipObjectOrValue(text, colon + 1);
      text = text.slice(0, hit.index) + text.slice(end);
    }
  }

  return text;
}

/**
 * Rewrite spaced Sitecore field access to valid TS/JSX:
 * - fields.MobileImage → fields["Mobile Image"] (when Fields declares spaced key)
 * - fields[Partner Logo] → fields["Partner Logo"] (unquoted bracket keys)
 */
export function fixSpacedFieldAccess(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  // Always quote unquoted multi-word keys in fields[...] / props.fields[...]
  // e.g. fields[Partner Logo] → fields["Partner Logo"]
  const beforeBrackets = text;
  text = text.replace(
    /\b((?:props\.)?fields)\s*\[\s*([A-Za-z_][\w]*(?:\s+[A-Za-z_][\w]*)+)\s*\]/g,
    (full, obj, key) => `${obj}[${JSON.stringify(key)}]`,
  );
  if (text !== beforeBrackets) {
    fixupWarn(
      '  ⚠ Codegen fixup: quoted unquoted spaced fields[...] keys (e.g. fields[Partner Logo] → fields["Partner Logo"])',
    );
  }

  const fieldsMatch = text.match(/\binterface\s+Fields\s*\{([\s\S]*?)\n\}/);
  if (!fieldsMatch) return text;
  const body = fieldsMatch[1] || '';
  const spacedKeys = [];
  const keyRe = /["']([^"']*\s[^"']*)["']\s*:/g;
  let km;
  while ((km = keyRe.exec(body))) {
    spacedKeys.push(km[1]);
  }
  if (!spacedKeys.length) return text;

  for (const key of spacedKeys) {
    const pascal = key.replace(/\s+/g, '');
    if (!pascal || pascal === key) continue;
    const re = new RegExp(`((?:props\\.)?fields)\\.${pascal}\\b`, 'g');
    text = text.replace(re, `$1[${JSON.stringify(key)}]`);
  }
  return text;
}

/**
/** HTML / SVG / Sitecore JSX tags commonly glued to attributes by AI dumps. */
const GLUED_JSX_TAG_NAMES =
  'a|article|aside|button|div|footer|form|h[1-6]|header|img|input|label|li|main|nav|p|section|span|ul|ol|textarea|Link|Image|Text|RichText|NextImage|AppPlaceholder|Placeholder';

/** Attribute names that may be glued immediately after a tag name. */
const GLUED_JSX_ATTR_NAMES =
  'className|class|id|href|src|style|type|name|value|key|ref|field|action|method|role|alt|width|height|placeholder|disabled|checked|selected|target|rel|title|aria-[\\w-]+|data-[\\w-]+|on[A-Z][A-Za-z0-9]*';

/**
 * Insert missing spaces when AI glues JSX tag names to attributes
 * (`<divclassName=` → `<div className=`) or attributes to each other
 * (`type="button"aria-expanded=` → `type="button" aria-expanded=`).
 *
 * @param {string} source
 * @returns {string}
 */
export function fixGluedJsxTagAttributes(source) {
  let text = String(source || '');
  if (!text.trim() || !text.includes('<')) return text;
  const before = text;

  const tagAttrRe = new RegExp(
    `<(${GLUED_JSX_TAG_NAMES})(?=(${GLUED_JSX_ATTR_NAMES})=)`,
    'g',
  );
  text = text.replace(tagAttrRe, '<$1 ');

  // Closing quote/brace of one attr immediately followed by the next attr name.
  const attrAttrRe = new RegExp(
    `(["'\\}])(?=(${GLUED_JSX_ATTR_NAMES})=)`,
    'g',
  );
  text = text.replace(attrAttrRe, '$1 ');

  if (text !== before) {
    fixupWarn(
      'fixGluedJsxTagAttributes: inserted missing spaces between JSX tags/attributes',
    );
  }
  return text;
}

/**
 * Last-resort parse salvage: quote bare multi-word keys on `interface Fields` /
 * `type Fields` and align `fields` / `props.fields` access to quoted brackets.
 * Safe under prompt-first — does not rewrite already-quoted declarations/access.
 *
 * @param {string} source
 * @returns {string}
 */
export function quoteBareMultiWordFieldsKeys(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\binterface\s+Fields\b/.test(text) && !/\btype\s+Fields\b/.test(text)) {
    return text;
  }

  const before = text;
  /** @type {string[]} */
  const newlyQuoted = [];

  text = rewriteFieldsTypeBlocks(text, (body) =>
    body.replace(
      /(^|[;{\n]\s*)(?!["'])([A-Za-z_][\w]*(?:\s+[A-Za-z_][\w]*)+)(\s*\??\s*:)/gm,
      (full, prefix, key, rest) => {
        newlyQuoted.push(key);
        return `${prefix}${JSON.stringify(key)}${rest}`;
      },
    ),
  );

  // Unquoted multi-word brackets: fields[Card Link] → fields["Card Link"]
  text = text.replace(
    /\b((?:props\.)?fields)\s*\[\s*([A-Za-z_][\w]*(?:\s+[A-Za-z_][\w]*)+)\s*\]/g,
    (_full, obj, key) => `${obj}[${JSON.stringify(key)}]`,
  );

  /** @type {Set<string>} */
  const spacedKeys = new Set(newlyQuoted);
  rewriteFieldsTypeBlocks(text, (body) => {
    const keyRe = /["']([^"']*\s[^"']*)["']\s*\??\s*:/g;
    let km;
    while ((km = keyRe.exec(body))) spacedKeys.add(km[1]);
    return body;
  });

  for (const key of spacedKeys) {
    const pascal = key.replace(/\s+/g, '');
    if (!pascal || pascal === key) continue;
    const re = new RegExp(`((?:props\\.)?fields)\\.${pascal}\\b`, 'g');
    text = text.replace(re, `$1[${JSON.stringify(key)}]`);
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen salvage: quoted bare multi-word Fields keys + aligned fields["…"] access',
    );
  }
  return text;
}

/**
 * Ensure datasourceLocation includes scope: "site" when the object is present.
 */
export function ensureDatasourceLocationScope(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  text = text.replace(
    /datasourceLocation\s*:\s*\{([^{}]*)\}/g,
    (full, body) => {
      if (/\bscope\s*:/.test(body)) return full;
      const trimmed = body.trim();
      const insert = trimmed
        ? ` scope: "site", ${trimmed}`
        : ` scope: "site" `;
      return `datasourceLocation: {${insert}}`;
    },
  );

  return text;
}

/**
 * Remap Desktop/Mobile/Tablet Image content urls from responsive inventory.
 * @param {string} source
 * @param {import('./responsive-images.mjs').ResponsiveImageInventory|null|undefined} imageInventory
 */
export function remapViewportImageUrls(source, imageInventory) {
  let text = String(source || '');
  if (!text.trim() || !imageInventory) return text;

  const map = [
    { re: /desktop/i, viewport: 'desktop' },
    { re: /mobile/i, viewport: 'mobile' },
    { re: /tablet/i, viewport: 'tablet' },
  ];

  for (const { re, viewport } of map) {
    const hit = imageInventory[viewport]?.[0];
    if (!hit?.url) continue;

    // Match "Desktop Image": { url: "...", alt: "..." } (and quoted keys)
    const fieldRe = new RegExp(
      `([\\"'\\\`]?)([^\\"'\\\`\\n]*${re.source}[^\\"'\\\`\\n]*)\\1\\s*:\\s*\\{([\\s\\S]*?)\\}`,
      'gi',
    );
    text = text.replace(fieldRe, (full, q, name, body) => {
      // Only touch Image-like objects that have a url key
      if (!/\burl\s*:/.test(body)) return full;
      const otherUrls = ['desktop', 'tablet', 'mobile']
        .filter((v) => v !== viewport)
        .map((v) => imageInventory[v]?.[0]?.url)
        .filter(Boolean);
      const urlMatch = body.match(/\burl\s*:\s*(["'`])([\s\S]*?)\1/);
      const current = urlMatch?.[2] || '';
      const needsFix =
        !current.trim() ||
        otherUrls.includes(current) ||
        (viewport === 'mobile' && /desktop|woman\.jpg/i.test(current) && /mobile/i.test(hit.url)) ||
        (viewport === 'desktop' && /mobile/i.test(current) && !/mobile/i.test(hit.url));

      if (!needsFix && current === hit.url) return full;
      if (!needsFix && current && !otherUrls.includes(current)) {
        // Keep AI pick if it looks unique and non-empty — still prefer inventory when path clearly mismatches viewport
        if (viewport === 'mobile' && !/mobile/i.test(current) && /mobile/i.test(hit.url)) {
          /* fall through */
        } else if (viewport === 'desktop' && /mobile/i.test(current) && !/mobile/i.test(hit.url)) {
          /* fall through */
        } else {
          return full;
        }
      }

      let nextBody = body;
      if (urlMatch) {
        nextBody = body.replace(
          /\burl\s*:\s*(["'`])([\s\S]*?)\1/,
          `url: ${urlMatch[1]}${hit.url}${urlMatch[1]}`,
        );
      } else {
        nextBody = ` url: ${JSON.stringify(hit.url)},${body}`;
      }
      if (hit.alt && !/\balt\s*:\s*["'`][^"'`]+/.test(nextBody)) {
        nextBody = nextBody.replace(
          /\balt\s*:\s*(["'`])\s*\1/,
          `alt: ${JSON.stringify(hit.alt)}`,
        );
      }
      const key = q ? `${q}${name}${q}` : name;
      return `${key}: {${nextBody}}`;
    });
  }

  return text;
}

/**
 * Convert a suggestedFields value into a definition content literal fragment.
 * @param {unknown} value
 * @param {string} type
 * @returns {string|null} TS object/string literal body (without field key), or null to skip
 */
/**
 * True when a string looks like a URL (never valid Title/Heading/text seed).
 * @param {unknown} value
 */
export function isUrlLikeTextValue(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  // Bare absolute path mistaken for a title (e.g. /nl/Newsroom)
  if (/^\/[a-z0-9][\w./-]*$/i.test(s) && /\/.+/.test(s)) return true;
  return false;
}

function seedValueToTsLiteral(value, type) {
  const t = String(type || '').toLowerCase();
  if (value == null) return null;
  if (t === 'array') return null; // structural; leave to AI

  // Capture-language seeds are the source of truth (content.culture). Prefer
  // suggestedFields / HTML locale copy; emit translates to en + cultures.
  if (
    t === 'text' ||
    t === 'single-line text' ||
    t === 'rich text' ||
    t === 'richtext' ||
    t === 'string' ||
    t === 'html' ||
    t === 'multiline' ||
    t === 'number'
  ) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(String(value));
    }
    if (typeof value === 'string' && value.trim()) {
      if (isUrlLikeTextValue(value) && t !== 'rich text' && t !== 'richtext' && t !== 'html') {
        return null;
      }
      return JSON.stringify(value);
    }
    return null;
  }

  if (t === 'image' || (value && typeof value === 'object' && value !== null && 'src' in value)) {
    const src =
      typeof value === 'string'
        ? value
        : String(/** @type {{ src?: unknown }} */ (value).src || '');
    if (!src.trim() || !/^https?:\/\//i.test(src)) return null;
    const alt =
      typeof value === 'object' && value !== null
        ? String(/** @type {{ alt?: unknown }} */ (value).alt || '')
        : '';
    // Keep capture-language alt (emit translates); empty if missing
    return `{ url: ${JSON.stringify(src)}, alt: ${JSON.stringify(alt)} }`;
  }

  if (t === 'link' || (value && typeof value === 'object' && value !== null && 'url' in value)) {
    const o = /** @type {{ text?: unknown, url?: unknown, href?: unknown }} */ (
      typeof value === 'object' && value ? value : {}
    );
    const linkText = o.text != null ? String(o.text) : '';
    const linkUrl = String(o.url ?? o.href ?? '').trim();
    if (!linkText && isPlaceholderLinkUrl(linkUrl)) return null;
    if (isPlaceholderLinkUrl(linkUrl) && !linkText) return null;
    // Prefer full { text, url } when both present; url-only patches use injectSeedLinkUrls
    if (linkText && linkUrl && !isPlaceholderLinkUrl(linkUrl)) {
      return `{ text: ${JSON.stringify(linkText)}, url: ${JSON.stringify(linkUrl)} }`;
    }
    if (linkText && (!linkUrl || isPlaceholderLinkUrl(linkUrl))) {
      return `{ text: ${JSON.stringify(linkText)}, url: ${JSON.stringify(linkUrl || '/')} }`;
    }
    return null;
  }

  // Plain strings/numbers from suggestedFields — capture-language copy
  if (typeof value === 'string' && value.trim()) {
    if (isUrlLikeTextValue(value)) return null;
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  return null;
}

/**
 * Capture heading for Title/Heading seeds (never URL / componentName).
 * @param {Record<string, unknown>|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 */
export function resolveCaptureHeading(info, sectionHtml = null) {
  if (info && typeof info === 'object') {
    const heading = String(info.heading || '').trim();
    if (heading && !isUrlLikeTextValue(heading)) return heading;
    const seeds = Array.isArray(info.suggestedFields) ? info.suggestedFields : [];
    for (const seed of seeds) {
      if (!seed || typeof seed !== 'object') continue;
      const n = String(seed.name || '').toLowerCase();
      if (n !== 'heading' && n !== 'title') continue;
      const v = String(seed.value || '').trim();
      if (v && !isUrlLikeTextValue(v)) return v;
    }
  }
  const html = String(sectionHtml || '');
  if (html.trim()) {
    const m = html.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i);
    if (m) {
      const text = normalizeLinkLabel(m[1]).replace(/\b\w/g, (c) => c);
      // restore original casing from stripped tags
      const plain = String(m[1] || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (plain && !isUrlLikeTextValue(plain)) return plain;
      void text;
    }
  }
  return '';
}

/**
 * Collect `{ text, url }` link seeds from suggestedFields / repeats (recursive).
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {Array<{ text: string, url: string }>}
 */
function collectLinkSeedsFromSectionInfo(info) {
  /** @type {Array<{ text: string, url: string }>} */
  const out = [];
  if (!info || typeof info !== 'object') return out;

  /**
   * @param {unknown} node
   */
  function walk(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object') return;
    const o = /** @type {Record<string, unknown>} */ (node);
    const urlRaw = o.url ?? o.href;
    if (typeof urlRaw === 'string' && !isPlaceholderLinkUrl(urlRaw)) {
      const text = o.text != null ? String(o.text) : '';
      out.push({ text, url: String(urlRaw).trim() });
    }
    for (const v of Object.values(o)) walk(v);
  }

  walk(info.suggestedFields);
  walk(info.repeats);
  return out;
}

/**
 * When capture seeds have a real url, patch matching Link/CTA objects.
 * Match by link `text` (exact or EN↔locale alias); overwrite `text` with
 * capture-language seed label and fill placeholder urls.
 *
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} info
 */
export function injectSeedLinkUrls(source, info) {
  let text = String(source || '');
  if (!text.trim() || !info) return text;
  const seeds = collectLinkSeedsFromSectionInfo(info).filter(
    (s) => s.text.trim() && !isPlaceholderLinkUrl(s.url),
  );
  if (!seeds.length) return text;

  let patched = 0;
  for (const seed of seeds) {
    const needle = normalizeLinkLabel(seed.text);
    if (!needle) continue;
    const urlLit = JSON.stringify(seed.url);
    const textLit = JSON.stringify(seed.text);
    text = text.replace(
      /\b((?:Link|CTA)\s*:\s*\{)([^}]*)(\})/g,
      (full, open, body, close) => {
        const textMatch = body.match(/\btext\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
        if (!textMatch) return full;
        const currentLabel = textMatch[2];
        const labelsMatch =
          normalizeLinkLabel(currentLabel) === needle ||
          linkLabelsAreAliases(currentLabel, seed.text);
        if (!labelsMatch) return full;
        const urlMatch = body.match(/\burl\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
        const needsUrl = !urlMatch || isPlaceholderLinkUrl(urlMatch[2]);
        const needsText = normalizeLinkLabel(currentLabel) !== needle;
        if (!needsUrl && !needsText) return full;
        patched += 1;
        let newBody = body;
        if (needsText) {
          newBody = newBody.replace(
            /\btext\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1/,
            `text: ${textLit}`,
          );
        }
        if (needsUrl) {
          if (urlMatch) {
            newBody = newBody.replace(
              /\burl\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1/,
              `url: ${urlLit}`,
            );
          } else {
            newBody = newBody.replace(
              /(\btext\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2)/,
              `$1, url: ${urlLit}`,
            );
          }
        }
        return `${open}${newBody}${close}`;
      },
    );
  }
  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: injected ${patched} Link/CTA seed(s) from capture (text + url)`,
    );
  }
  return text;
}

/** Shared EN↔locale label alias groups for footer/nav matching. */
const LINK_LABEL_ALIAS_GROUPS = [
  ['press', 'pers', 'presse'],
  ['about axa', 'over axa', 'a propos axa', "à propos d'axa"],
  ['axa employees', 'personeel axa', 'axa personeel', 'axa staff', 'personnel axa'],
  ['axa.com', 'axa com'],
  [
    'general terms and legal information',
    'general terms & legal information',
    'terms and conditions & legal info',
    'terms and conditions and legal info',
    'algemene voorwaarden en productfiches',
    'algemene voorwaarden & juridische info',
    'algemene voorwaarden en juridische info',
    'algemene voorwaarden',
  ],
  [
    'privacy and cookie policy',
    'privacy and cookies policy',
    'privacy and cookies',
    'privacy en cookiebeleid',
    'privacy-clausule',
    'privacy clausule',
  ],
  ['cookie preferences', 'cookies voorkeuren', 'cookievoorkeuren', 'préférences cookies'],
  ['help and contact', 'help en contact', 'hulp en contact', 'aide et contact'],
  ['our network', 'ons netwerk', 'notre réseau'],
  [
    'accessibility statement',
    'verklaring accessibility',
    'digitale toegankelijkheid',
    'déclaration d accessibilité',
  ],
  ['important information', 'belangrijke info', 'informations importantes'],
  ['contact us', 'contacteer ons', 'contactez-nous'],
  ['follow us', 'volg ons', 'suivez-nous'],
];

/**
 * @param {string} a
 * @param {string} b
 */
function linkLabelsAreAliases(a, b) {
  const na = normalizeLinkLabel(a);
  const nb = normalizeLinkLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  for (const group of LINK_LABEL_ALIAS_GROUPS) {
    const norms = group.map((g) => normalizeLinkLabel(g));
    if (norms.includes(na) && norms.includes(nb)) return true;
  }
  return false;
}

/**
 * Collect per-group capture titles from section-information repeats.
 * Prefer `title`, then `name` (InsuranceCatalog categories use `name`).
 *
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {string[]}
 */
/**
 * Normalize a capture heading that may be a URL into a human column label.
 * e.g. https://www.sitecore.com/Platform → Platform
 * @param {string} raw
 * @returns {string}
 */
export function normalizeCaptureGroupHeading(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const seg = u.pathname.split('/').filter(Boolean).pop() || '';
      if (!seg) return '';
      // Decode and title-case hyphenated segments lightly
      const decoded = decodeURIComponent(seg).replace(/[-_]+/g, ' ');
      return decoded.replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      return '';
    }
  }
  return s;
}

export function captureGroupTitlesFromRepeats(info) {
  /** @type {string[]} */
  const captureTitles = [];
  if (!info || typeof info !== 'object') return captureTitles;
  const pushTitle = (raw) => {
    const title = normalizeCaptureGroupHeading(String(raw || ''));
    if (title && !/^https?:\/\//i.test(title)) captureTitles.push(title);
  };
  const repeats = Array.isArray(info.repeats) ? info.repeats : [];
  for (const rep of repeats) {
    if (!rep || typeof rep !== 'object') continue;
    const values = /** @type {{ value?: unknown }} */ (rep).value;
    if (!Array.isArray(values)) continue;
    for (const row of values) {
      if (!row || typeof row !== 'object') continue;
      const rec = /** @type {{ title?: unknown, name?: unknown, heading?: unknown }} */ (row);
      pushTitle(rec.title || rec.heading || rec.name || '');
    }
  }
  // Also scan suggestedFields array values (footer NavigationGroups often land here).
  const seeds = Array.isArray(info.suggestedFields) ? info.suggestedFields : [];
  for (const seed of seeds) {
    if (!seed || typeof seed !== 'object') continue;
    const s = /** @type {{ name?: unknown, value?: unknown }} */ (seed);
    const seedName = String(s.name || '');
    if (!/navigation|group|column|categor/i.test(seedName)) continue;
    if (!Array.isArray(s.value)) continue;
    for (const row of s.value) {
      if (!row || typeof row !== 'object') continue;
      const rec = /** @type {{ title?: unknown, name?: unknown, heading?: unknown }} */ (row);
      pushTitle(rec.heading || rec.title || rec.name || '');
    }
  }
  return captureTitles;
}

/**
 * Overwrite group `Title` / `displayName` seeds from repeats.value.
 * Uses `title` or `name` on each repeat row. When the seed equals the section
 * `heading` (e.g. every group got "Alle verzekeringen"), replace sequentially
 * with capture group titles. Also matches by EN↔locale alias.
 *
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} info
 */
export function injectGroupTitlesFromRepeats(source, info) {
  let text = String(source || '');
  if (!text.trim() || !info) return text;

  const captureTitles = captureGroupTitlesFromRepeats(info);
  if (!captureTitles.length) return text;

  const sectionHeading = String(
    /** @type {{ heading?: unknown }} */ (info).heading || '',
  ).trim();
  const sectionNorm = sectionHeading
    ? normalizeLinkLabel(sectionHeading)
    : '';

  let patched = 0;
  let sequentialIdx = 0;

  const replaceSeed = (full, prefix, _quote, current) => {
    const currentNorm = normalizeLinkLabel(current);
    const aliasHit = captureTitles.find((t) =>
      linkLabelsAreAliases(current, t),
    );
    if (aliasHit && normalizeLinkLabel(aliasHit) === currentNorm) {
      return full;
    }
    if (aliasHit) {
      patched += 1;
      return `${prefix}${JSON.stringify(aliasHit)}`;
    }

    // Only consume a sequential capture title when the seed looks like the
    // collapsed section heading, placeholder, or empty — not real per-card Titles.
    const looksCollapsed =
      !currentNorm ||
      (sectionNorm && currentNorm === sectionNorm) ||
      /^(title|heading|connect|label|untitled)$/i.test(currentNorm) ||
      /^(all\s+insurances?|alle\s+verzekeringen)$/i.test(currentNorm);
    if (!looksCollapsed) return full;

    const capture = captureTitles[sequentialIdx];
    if (!capture) return full;
    sequentialIdx += 1;
    if (normalizeLinkLabel(capture) === currentNorm) {
      return full;
    }
    patched += 1;
    return `${prefix}${JSON.stringify(capture)}`;
  };

  text = text.replace(
    /(\bTitle\s*:\s*)(["'])((?:\\.|(?!\2)[^\\])*)\2/g,
    replaceSeed,
  );

  // Reset index so displayName on the same groups get the same sequence.
  sequentialIdx = 0;
  text = text.replace(
    /(\bdisplayName\s*:\s*)(["'])((?:\\.|(?!\2)[^\\])*)\2/g,
    replaceSeed,
  );

  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: injected ${patched} Title/displayName seed(s) from capture repeats`,
    );
  }
  return text;
}

/**
 * When child Title/displayName was copied from the parent Heading (e.g. footer
 * "Own the moments that matter."), rewrite both to the item `name`.
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} [info]
 */
export function rewriteSeedTitlesMatchingParentHeading(source, info) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const fromInfo = String(/** @type {{ heading?: unknown }} */ (info || {}).heading || '').trim();
  const fromSource = text.match(/\bHeading\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
  const heading = fromInfo || fromSource?.[2] || '';
  if (!heading) return text;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const before = text;
  text = text.replace(
    new RegExp(
      `(name:\\s*)(["'])([^"']+)\\2(\\s*,\\s*displayName:\\s*)(["'])${escaped}\\5([\\s\\S]*?\\bTitle:\\s*)(["'])${escaped}\\7`,
      'g',
    ),
    '$1$2$3$2$4$5$3$5$6$7$3$7',
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: rewrote child Title/displayName that matched parent Heading → item name',
    );
  }
  return text;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPlaceholderOrUrlTitle(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (/^(title|heading|connect|label|untitled)$/i.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}

/**
 * When Title/displayName is a placeholder (Title, Connect, empty, URL) but item
 * `name` is a real label, rewrite Title/displayName → name.
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} [info]
 */
export function rewriteLiteralTitleSeedsFromItemName(source, info) {
  let text = String(source || '');
  if (!text.trim()) return text;
  void info;
  let patched = 0;
  // Items with name + displayName + Title
  text = text.replace(
    /\{\s*name:\s*(["'])([^"']+)\1\s*,\s*displayName:\s*(["'])((?:\\.|(?!\3)[^\\])*)\3([\s\S]*?\bTitle:\s*)(["'])((?:\\.|(?!\6)[^\\])*)\6/g,
    (full, nq, name, dq, displayName, mid, tq, title) => {
      const badTitle = isPlaceholderOrUrlTitle(title);
      const badDn = isPlaceholderOrUrlTitle(displayName);
      if (!badTitle && !badDn) return full;
      patched += 1;
      const nextDn = badDn ? name : displayName;
      const nextTitle = badTitle ? name : title;
      return `{ name: ${nq}${name}${nq}, displayName: ${dq}${nextDn}${dq}${mid}${tq}${nextTitle}${tq}`;
    },
  );
  // Items with name + Title but no displayName in the matched span
  text = text.replace(
    /\{\s*name:\s*(["'])([^"']+)\1((?:(?!displayName\s*:)[\s\S])*?\bTitle:\s*)(["'])((?:\\.|(?!\4)[^\\])*)\4/g,
    (full, nq, name, mid, tq, title) => {
      if (!isPlaceholderOrUrlTitle(title)) return full;
      if (String(title) === String(name)) return full;
      patched += 1;
      return `{ name: ${nq}${name}${nq}${mid}${tq}${name}${tq}`;
    },
  );
  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: rewrote ${patched} literal/placeholder Title seed(s) → item name`,
    );
  }
  return text;
}

/**
 * Remap definition content field values from section-information suggestedFields.
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 */
export function remapContentFromSuggestedFields(source, info, sectionHtml = null) {
  let text = String(source || '');
  if (!text.trim() || !info) return text;

  text = injectSeedLinkUrls(text, info);

  const captureHeading = resolveCaptureHeading(info, sectionHtml);
  if (captureHeading) {
    text = applyTitleHeadingSeed(text, captureHeading);
  }

  const seeds = Array.isArray(info.suggestedFields) ? info.suggestedFields : [];

  for (const seed of seeds) {
    if (!seed || typeof seed !== 'object') continue;
    const s = /** @type {Record<string, unknown>} */ (seed);
    const name = String(s.name || '');
    if (!name) continue;
    const type = String(s.type || '');
    // Never remap URL-like values onto text/heading/title fields
    if (
      isUrlLikeTextValue(s.value) &&
      /^(heading|title|subtitle|label|description)$/i.test(name)
    ) {
      continue;
    }
    const literal = seedValueToTsLiteral(s.value, type);
    if (!literal) continue;

    // Match "Desktop Image": … / DesktopImage: … / desktopImage: … (quoted or bare)
    const variants = new Set([
      name,
      name.replace(/([a-z])([A-Z])/g, '$1 $2'), // desktopImage → desktop Image
      name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase()), // Desktop Image
      name.charAt(0).toUpperCase() + name.slice(1), // Logo / Heading / Cta
      name.replace(/image$/i, ' Image').replace(/\b\w/g, (c) => c.toUpperCase()).trim(),
    ]);
    // CTA special: cta → CTA
    if (name.toLowerCase() === 'cta') variants.add('CTA');
    // heading/title → both Title and Heading (Sitecore field names)
    if (/^(heading|title)$/i.test(name)) {
      variants.add('Title');
      variants.add('Heading');
    }
    if (/image$/i.test(name)) {
      const base = name.replace(/image$/i, '');
      const titled =
        base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase()) +
        ' Image';
      variants.add(titled.trim());
    }

    for (const variant of variants) {
      if (!variant) continue;
      const esc = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Quoted key
      const quotedRe = new RegExp(
        `([\"'\`])${esc}\\1\\s*:\\s*(\\{(?:[^{}]|\\{[^{}]*\\})*\\}|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`|true|false|null|-?\\d+(?:\\.\\d+)?)`,
        'g',
      );
      text = text.replace(quotedRe, (full, q) => `${q}${variant}${q}: ${literal}`);

      // Bare identifier key (no spaces)
      if (!/\s/.test(variant) && /^[A-Za-z_][\w]*$/.test(variant)) {
        const bareRe = new RegExp(
          `\\b${esc}\\s*:\\s*(\\{(?:[^{}]|\\{[^{}]*\\})*\\}|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|\`(?:\\\\.|[^\`\\\\])*\`|true|false|null|-?\\d+(?:\\.\\d+)?)`,
          'g',
        );
        text = text.replace(bareRe, `${variant}: ${literal}`);
      }
    }
  }

  // Re-apply capture heading last so URL suggestedFields cannot win
  if (captureHeading) {
    text = applyTitleHeadingSeed(text, captureHeading);
  }

  return text;
}

/**
 * Force Title / Heading content seeds to capture heading (overwrite componentName).
 * @param {string} source
 * @param {string} heading
 */
export function applyTitleHeadingSeed(source, heading) {
  let text = String(source || '');
  const lit = JSON.stringify(heading);
  for (const key of ['Title', 'Heading']) {
    const bareRe = new RegExp(
      `\\b${key}\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')`,
      'g',
    );
    text = text.replace(bareRe, `${key}: ${lit}`);
  }
  return text;
}

/**
 * Composite parents with author fields but no content.items never get s:ds
 * (empty carousel chrome / missing Heading). Inject a single seed item.
 *
 * @param {string} source
 * @param {{ sectionInfo?: object|null, sectionHtml?: string|null, planMode?: string|null }} [options]
 */
export function ensureCompositeParentContentSeed(source, options = {}) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (/content\s*:\s*\{[\s\S]*?\bitems\s*:\s*\[/.test(text)) return text;

  const hasPlaceholders =
    /placeholders\s*:\s*\[[\s\S]*?\{[\s\S]*?key\s*:/.test(text) &&
    !/placeholders\s*:\s*\[\s*\]/.test(text);
  const mode = String(options.planMode || '').toLowerCase();
  if (!hasPlaceholders && mode !== 'composite') return text;

  // Only when itemTemplate declares Heading/Title (chrome parents that need s:ds).
  const wantsHeading = /name\s*:\s*["']Heading["']/.test(text);
  const wantsTitle = /name\s*:\s*["']Title["']/.test(text);
  if (!wantsHeading && !wantsTitle) return text;

  const displayMatch = text.match(/\bdisplayName\s*:\s*["']([^"']+)["']/);
  const itemName = String(displayMatch?.[1] || 'Default').trim() || 'Default';
  const captureHeading =
    resolveCaptureHeading(options.sectionInfo, options.sectionHtml) || itemName;
  /** @type {string[]} */
  const fieldLiterals = [];
  if (wantsHeading) {
    fieldLiterals.push(`          Heading: ${JSON.stringify(captureHeading)}`);
  }
  if (wantsTitle) {
    fieldLiterals.push(`          Title: ${JSON.stringify(captureHeading)}`);
  }

  const folderMatch = text.match(
    /datasourceLocation\s*:\s*\{[\s\S]*?folder\s*:\s*(\[[^\]]*\])/,
  );
  const folderLit = folderMatch?.[1] || '[]';
  const contentBlock = `  content: {
    location: {
      root: "data",
      folder: ${folderLit},
    },
    culture: "en",
    items: [
      {
        name: ${JSON.stringify(itemName)},
        displayName: ${JSON.stringify(itemName)},
        fields: {
${fieldLiterals.join(',\n')}
        },
      },
    ],
  },
`;

  if (/placeholders\s*:\s*\[/.test(text)) {
    text = text.replace(
      /(placeholders\s*:\s*\[[\s\S]*?\],)/,
      `$1\n${contentBlock}`,
    );
  } else if (/variants\s*:\s*\[/.test(text)) {
    text = text.replace(/(variants\s*:\s*\[[\s\S]*?\],)/, `$1\n${contentBlock}`);
  } else {
    text = text.replace(/\}\s*satisfies/, `${contentBlock}} satisfies`);
  }
  fixupWarn(
    `  ⚠ Codegen fixup: injected composite parent content.items seed "${itemName}" (enables s:ds)`,
  );
  return text;
}

/**
 * Keep a single ComponentTemplateDefinition export matching `definitionKey`.
 * Drops incomplete stubs (no definitionKey) and sibling/child definitions that
 * would collide with other component files (duplicate definitionKey).
 *
 * @param {string} source
 * @param {{ definitionKey: string }} opts
 * @returns {string}
 */
/**
 * True when AI `definitionKey`/`name` matches the write-time key, including
 * brand-prefix drift (`navigation-item` ↔ `crelan-navigation-item`).
 * @param {string|null|undefined} actual
 * @param {string} expected
 */
function definitionKeysEquivalent(actual, expected) {
  const a = String(actual || '')
    .trim()
    .toLowerCase();
  const b = String(expected || '')
    .trim()
    .toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.endsWith(`-${a}`) || a.endsWith(`-${b}`)) return true;
  return false;
}

export function keepExpectedComponentDefinitionExport(source, opts = {}) {
  const expected = String(opts.definitionKey || '')
    .trim()
    .toLowerCase();
  if (!expected) return String(source || '');

  const text = String(source || '');
  if (!text.trim()) return text;

  const blocks = findComponentDefinitionExports(text);
  if (blocks.length === 0) return text;

  const expectedExportName = kebabToCamelExportName(expected);
  // Unprefixed camel (drop first kebab segment) so NavigationItemDefinition
  // matches expected crelan-navigation-item.
  const expectedTailKebab = expected.includes('-')
    ? expected.slice(expected.indexOf('-') + 1)
    : expected;
  const expectedTailExportName = kebabToCamelExportName(expectedTailKebab);

  const exportMatches = (b) => {
    const en = b.exportName.toLowerCase();
    const camel = expectedExportName.toLowerCase();
    const tailCamel = expectedTailExportName.toLowerCase();
    return (
      en === camel ||
      en === `${camel}definition` ||
      en === `${expected.replace(/-/g, '')}definition` ||
      en === tailCamel ||
      en === `${tailCamel}definition` ||
      en === `${expectedTailKebab.replace(/-/g, '')}definition`
    );
  };

  let chosen = blocks.find((b) =>
    definitionKeysEquivalent(b.definitionKey, expected),
  );
  if (!chosen) {
    // Complete body + name/export match (AI often omits or under-prefixes keys)
    chosen = blocks.find(
      (b) =>
        /\bmodel\s*:/.test(b.body) &&
        (definitionKeysEquivalent(b.name, expected) || exportMatches(b)),
    );
  }

  if (!chosen) {
    // Force-rename / collision suffix: AI export name often still matches the
    // preferred identity (CrelanLocalServicesAndNavigationDefinition) while
    // resolve locked to crelan-header or …2. Keep the sole complete body and
    // rewrite definitionKey below; ensureDefinitionComponentIdentity finishes
    // componentName / name / displayName.
    const complete = blocks.filter((b) => /\bmodel\s*:/.test(b.body));
    if (complete.length === 1) {
      chosen = complete[0];
    } else {
      // Drop stubs + wrong-key siblings so generate cannot see duplicate keys.
      // If nothing remains for this component, leave a clear single-export shell
      // only when at least one block existed (caller may overwrite via fallback).
      return stripNonMatchingComponentExports(text, blocks, expected);
    }
  }

  let body = chosen.body;
  if (!chosen.definitionKey) {
    if (/kind:\s*["']component["']\s*,/.test(body)) {
      body = body.replace(
        /(kind:\s*["']component["']\s*,)/,
        `$1\n  definitionKey: "${expected}",`,
      );
    } else {
      body = body.replace(/^\s*\{/, `{\n  definitionKey: "${expected}",`);
    }
  } else if (chosen.definitionKey !== expected) {
    body = body.replace(
      /definitionKey:\s*["'][^"']*["']/,
      `definitionKey: "${expected}"`,
    );
  }

  if (!/\bname:\s*["']/.test(body)) {
    body = body.replace(
      /(definitionKey:\s*["'][^"']*["']\s*,)/,
      `$1\n  name: "${expected}",`,
    );
  } else if (chosen.definitionKey !== expected || chosen.name !== expected) {
    // Align top-level name with rewritten definitionKey (force-rename / …2).
    body = body.replace(
      /(definitionKey:\s*["'][^"']*["']\s*,\s*\r?\n\s*)name\s*:\s*["'][^"']*["']/,
      `$1name: "${expected}"`,
    );
  }

  const importMatch = text.match(
    /^[\s\S]*?import\s+type\s+\{\s*ComponentTemplateDefinition\s*\}\s+from\s+["'][^"']+["']\s*;?\s*\n/,
  );
  const importLine =
    importMatch?.[0] ||
    `import type { ComponentTemplateDefinition } from "../../../../tools/definitions/types";\n\n`;

  // Prefer expected export name so keep + identity agree after rename/suffix.
  const exportName = `${expectedExportName}Definition`;

  return `${importLine}export const ${exportName} = ${body} satisfies ComponentTemplateDefinition;\n`;
}

/**
 * Remove component definition exports that are stubs or use a different definitionKey.
 * Preserves import preamble. Used when no matching complete export was found.
 */
function stripNonMatchingComponentExports(text, blocks, expected) {
  if (!blocks.length) return text;
  // Remove from end to start
  let out = text;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (definitionKeysEquivalent(b.definitionKey, expected)) continue;
    out = out.slice(0, b.start) + out.slice(b.end);
  }
  // Collapse excess blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  return out;
}

/**
 * @param {string} kebab
 */
function kebabToCamelExportName(kebab) {
  return String(kebab || '')
    .split(/-+/)
    .filter(Boolean)
    .map((p, i) =>
      i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join('')
    .replace(/[^a-zA-Z0-9_$]/g, '');
}

/**
 * @param {string} text
 * @returns {Array<{
 *   exportName: string,
 *   start: number,
 *   end: number,
 *   body: string,
 *   definitionKey: string|null,
 *   name: string|null,
 * }>}
 */
function findComponentDefinitionExports(text) {
  const blocks = [];
  const re = /export\s+const\s+(\w+)\s*=\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const exportName = m[1];
    const braceStart = m.index + m[0].length - 1;
    const braceEnd = skipBalancedBrace(text, braceStart);
    if (braceEnd < 0) continue;
    let end = braceEnd;
    const after = text.slice(braceEnd);
    const sat = after.match(/^\s*satisfies\s+ComponentTemplateDefinition\s*;?/);
    if (sat) end = braceEnd + sat[0].length;
    else {
      const semi = after.match(/^\s*;/);
      if (semi) end = braceEnd + semi[0].length;
    }
    const body = text.slice(braceStart, braceEnd);
    // Only treat as component defs (kind: "component")
    if (!/kind:\s*["']component["']/.test(body)) continue;
    const keyMatch = body.match(/definitionKey:\s*["']([^"']+)["']/);
    const nameMatch = body.match(/^\s*name:\s*["']([^"']+)["']/m);
    blocks.push({
      exportName,
      start: m.index,
      end,
      body,
      definitionKey: keyMatch ? keyMatch[1].trim().toLowerCase() : null,
      name: nameMatch ? nameMatch[1].trim().toLowerCase() : null,
    });
  }
  return blocks;
}

/** @param {string} text @param {number} openIdx index of '{' */
function skipBalancedBrace(text, openIdx) {
  if (text[openIdx] !== '{') return -1;
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i++;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === q) break;
        i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Ensure every `placeholders: [{ key: "…" }]` entry is the base key (no `-{*}`).
 * Emit adds `-{*}` to the Sitecore Placeholder Key field.
 * @param {string} source
 */
export function ensurePlaceholderKeysAreBase(source) {
  const text = String(source || '');
  if (!text.trim()) return text;

  return text.replace(/(placeholders\s*:\s*\[[\s\S]*?\])/g, (block) =>
    block.replace(
      /(\bkey\s*:\s*)(["'])([^"']*)\2/g,
      (_full, prefix, quote, key) =>
        `${prefix}${quote}${toBasePlaceholderKey(key)}${quote}`,
    ),
  );
}

/** @deprecated Use ensurePlaceholderKeysAreBase */
export const ensurePlaceholderKeysHaveWildcard = ensurePlaceholderKeysAreBase;

/**
 * Parse `JSON.stringify( '…' | "…" )` at `start` (index of `J`).
 * Recovers AI-broken single-quoted mega seeds where an unescaped apostrophe
 * (e.g. Extra's) terminates the string early — spans until quote + `)`.
 * @param {string} text
 * @param {number} start
 * @returns {{ end: number, value: string } | null}
 */
function parseJsonStringifyStringArg(text, start) {
  if (!text.startsWith('JSON.stringify', start)) return null;
  let i = start + 'JSON.stringify'.length;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== '(') return null;
  i += 1;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  const q = text[i];
  if (q !== '"' && q !== "'") return null;
  const valueStart = i + 1;

  // Strict reader (well-formed escapes).
  let j = valueStart;
  let value = '';
  while (j < text.length) {
    const ch = text[j];
    if (ch === '\\' && j + 1 < text.length) {
      value += text[j + 1];
      j += 2;
      continue;
    }
    if (ch === q) {
      j += 1;
      break;
    }
    value += ch;
    j += 1;
  }
  let k = j;
  while (k < text.length && /\s/.test(text[k])) k += 1;
  if (text[k] === ')') {
    return { end: k + 1, value };
  }

  // Broken: premature quote mid-prose (Extra's). Span until quote + optional
  // whitespace + `)` — same idea as spanBrokenSingleQuotedValue, end = `)`.
  for (let p = valueStart; p < text.length; p++) {
    const c = text[p];
    if (c === '\\') {
      p += 1;
      continue;
    }
    if (c !== q) continue;
    const after = text.slice(p + 1);
    if (!/^\s*\)/.test(after)) continue;
    const raw = text.slice(valueStart, p);
    const decoded = raw.replace(/\\(.)/g, '$1');
    let end = p + 1;
    while (end < text.length && /\s/.test(text[end])) end += 1;
    if (text[end] !== ')') return null;
    return { end: end + 1, value: decoded };
  }
  return null;
}

/**
 * Rewrite every `JSON.stringify( stringLiteral )` to a plain TS string literal.
 * Covers Path names, displayName, folder segments, and field/link/image seeds
 * (`Heading: JSON.stringify('…')`, `text: JSON.stringify('welkom')`, …).
 * Leaves `JSON.stringify([…])` / object args untouched (not a single string arg).
 * @param {string} source
 * @returns {string}
 */
export function unwrapJsonStringifyOnPathNames(source) {
  const text = String(source || '');
  if (!text.includes('JSON.stringify')) return text;

  let out = '';
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf('JSON.stringify', i);
    if (idx < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, idx);
    const parsed = parseJsonStringifyStringArg(text, idx);
    if (!parsed) {
      out += text[idx];
      i = idx + 1;
      continue;
    }
    // Emit a double-quoted TS literal (evaluates without wrapping quotes).
    out += JSON.stringify(parsed.value);
    i = parsed.end;
  }
  return out;
}

/**
 * Lock `itemTemplate.name` / `folderTemplate.name` to unbranded spaced Title Case
 * for custom (non-platform-list) packages.
 *
 * Prefer `componentName` (stable) over `displayName` when displayName looks like
 * marketing/content copy (trademarks, long headlines) — AI sometimes copies a
 * card title into displayName, which forced SCS hash-folder template paths and
 * duplicate-ID leftovers next to `Project/…/Recognition Cards.yml`.
 * When `codePrefix` is set, strip the site brand from the stem (Menzis stays
 * only on FE componentName / definitionKey).
 *
 * Platform Link/Icon/Image Link Lists packages may share data-template names
 * (`Link List` / `Link List Folder`). Do not uniquify those to the component
 * stem — Project rendering Path leaf uniqueness is apply-time from componentName.
 *
 * @param {string} source
 * @param {string} [codePrefix]
 */
export function ensureSpacedTemplateNames(source, codePrefix = '') {
  const text = String(source || '');
  if (!text.trim()) return text;

  // Shared data architecture under platform list folders — keep template names.
  if (
    /folder\s*:\s*\[[^\]]*["'](?:Link Lists|Icon Link Lists|Image Link Lists)["']/.test(
      text,
    )
  ) {
    return text;
  }

  const displayName =
    text.match(/\bdisplayName\s*:\s*["']([^"']+)["']/)?.[1] ||
    (() => {
      const m = text.match(
        /\bdisplayName\s*:\s*JSON\.stringify\s*\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*\)/,
      );
      return m ? m[2].replace(/\\(.)/g, '$1') : undefined;
    })();
  const componentName = text.match(/\bcomponentName\s*:\s*["']([^"']+)["']/)?.[1];
  const prefix = String(codePrefix || '').trim();
  const fromComponent = displayNameFromComponentName(
    componentName || '',
    prefix,
  );
  const fromDisplay = stripLeadingBrandSpacedLabel(displayName || '', prefix);
  const displayLooksLikeContentTitle =
    !fromDisplay ||
    fromDisplay.length > 48 ||
    /[®™©]/.test(displayName || '') ||
    /\b(Gartner|Forrester|Wave|Magic Quadrant)\b/i.test(displayName || '');
  const stem =
    fromComponent && displayLooksLikeContentTitle
      ? fromComponent
      : fromDisplay || fromComponent;
  if (!stem) return text;

  let next = text;
  const folderLit = /(\bfolderTemplate\s*:\s*\{\s*name\s*:\s*)(["'])([^"']*)\2/;
  const folderJs =
    /(\bfolderTemplate\s*:\s*\{\s*name\s*:\s*)JSON\.stringify\s*\(\s*(['"])(?:\\.|(?!\2)[^\\])*\2\s*\)/;
  const itemLit = /(\bitemTemplate\s*:\s*\{\s*name\s*:\s*)(["'])([^"']*)\2/;
  const itemJs =
    /(\bitemTemplate\s*:\s*\{\s*name\s*:\s*)JSON\.stringify\s*\(\s*(['"])(?:\\.|(?!\2)[^\\])*\2\s*\)/;

  if (folderJs.test(next)) {
    next = next.replace(
      folderJs,
      (_full, pfx) => `${pfx}${JSON.stringify(`${stem} Folder`)}`,
    );
  } else {
    next = next.replace(
      folderLit,
      (_full, pfx, quote) => `${pfx}${quote}${stem} Folder${quote}`,
    );
  }
  if (itemJs.test(next)) {
    next = next.replace(
      itemJs,
      (_full, pfx) => `${pfx}${JSON.stringify(stem)}`,
    );
  } else {
    next = next.replace(
      itemLit,
      (_full, pfx, quote) => `${pfx}${quote}${stem}${quote}`,
    );
  }
  if (next !== text && displayLooksLikeContentTitle && fromComponent) {
    fixupWarn(
      `  ⚠ Codegen fixup: locked itemTemplate/folderTemplate names to "${stem}" (ignored content-like displayName)`,
    );
  }
  return next;
}

/**
 * Last resort: strip leading site brand from Sitecore structural names and
 * force spaced Title Case. Does not touch componentName / definitionKey.
 * @param {string} source
 * @param {string} codePrefix
 */
export function stripBrandFromSitecoreStructuralNames(source, codePrefix) {
  const prefix = String(codePrefix || '').trim();
  let text = String(source || '');
  if (!prefix || !text.trim()) return text;

  const rewriteQuoted = (value) => {
    const next = stripLeadingBrandSpacedLabel(value, prefix);
    return next || value;
  };

  // folderTemplate / itemTemplate / childItemTemplate name
  text = text.replace(
    /(\b(?:folderTemplate|itemTemplate|childItemTemplate)\s*:\s*\{\s*name\s*:\s*)(["'])([^"']*)\2/g,
    (_full, pfx, quote, name) => `${pfx}${quote}${rewriteQuoted(name)}${quote}`,
  );

  // datasourceLocation / content.location folder: ['…']
  text = text.replace(
    /(\bfolder\s*:\s*\[\s*)((?:["'][^"']*["']\s*,?\s*)+)(\])/g,
    (full, pfx, inner, suffix) => {
      const segs = [...inner.matchAll(/["']([^"']*)["']/g)].map((m) => m[1]);
      if (!segs.length) return full;
      const next = segs.map((s) =>
        toSpacedDataFolderSegment(stripLeadingBrandSpacedLabel(s, prefix) || s),
      );
      if (next.every((s, i) => s === segs[i])) return full;
      const quote = /'/.test(inner) && !/"/.test(inner) ? "'" : '"';
      return `${pfx}${next.map((s) => `${quote}${s}${quote}`).join(', ')}${suffix}`;
    },
  );

  // content.items[].name Path (objects with fields:) — leading brand only
  text = text.replace(
    /(\{\s*name\s*:\s*)(["'])((?:\\.|(?!\2)[^\\])*)\2(\s*,\s*)(?=(?:displayName\s*:|fields\s*:))/g,
    (full, pfx, quote, name, mid) => {
      const next = rewriteQuoted(name);
      if (next === name) return full;
      return `${pfx}${quote}${next}${quote}${mid}`;
    },
  );

  // Template field defs: { name: '…', type:
  text = text.replace(
    /(\{\s*name\s*:\s*)(["'])([^"']*)\2(\s*,\s*type\s*:)/g,
    (_full, pfx, quote, name, mid) =>
      `${pfx}${quote}${rewriteQuoted(name)}${quote}${mid}`,
  );

  return text;
}

/**
 * Normalize `datasourceLocation.folder` / `content.location.folder` segments to
 * spaced Title Case (`AdvisorSupportSplits` → `Advisor Support Splits`).
 * Preserves platform Link Lists / Icon Link Lists / Image Link Lists names.
 * @param {string} source
 */
export function ensureSpacedDataFolders(source) {
  const text = String(source || '');
  if (!text.trim()) return text;

  return text.replace(
    /(\bfolder\s*:\s*\[\s*)((?:["'][^"']*["']\s*,?\s*)+)(\])/g,
    (full, prefix, inner, suffix) => {
      const segs = [...inner.matchAll(/["']([^"']*)["']/g)].map((m) => m[1]);
      if (!segs.length) return full;
      const spaced = segs.map(toSpacedDataFolderSegment);
      if (spaced.every((s, i) => s === segs[i])) return full;
      const quote = /'/.test(inner) && !/"/.test(inner) ? "'" : '"';
      return `${prefix}${spaced.map((s) => `${quote}${s}${quote}`).join(', ')}${suffix}`;
    },
  );
}

/**
 * Strip `-{*}` / `{*}` from common TSX placeholder base-key literals so
 * AppPlaceholder names stay `base-${DynamicPlaceholderId}`.
 * @param {string} source
 */
export function ensureTsxPlaceholderKeysAreBase(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  // const baseKey = "foo-{*}"; / 'foo{*}'
  text = text.replace(
    /(\b(?:baseKey|phBase|placeholderBase)\s*=\s*)(["'])([^"']*?)-?\{\*\}\2/g,
    (_full, prefix, quote, key) => `${prefix}${quote}${toBasePlaceholderKey(key)}${quote}`,
  );
  // const phName = `foo-{*}-${dynId}` → keep base only before dyn append patterns
  text = text.replace(
    /(`)([^`$]*?)-?\{\*\}(-\$\{)/g,
    (_full, tick, key, rest) => `${tick}${toBasePlaceholderKey(key)}${rest}`,
  );
  return text;
}

/**
 * Collect kebab AppPlaceholder names passed as string literals (bare names).
 * @param {string} source
 * @returns {string[]}
 */
export function collectBareAppPlaceholderNames(source) {
  const text = String(source || '');
  /** @type {string[]} */
  const out = [];
  const re =
    /<AppPlaceholder\b[^>]*?\bname\s*=\s*(?:(["'])([^"']+)\1|\{\s*(["'])([^"']+)\3\s*\})/g;
  let m;
  while ((m = re.exec(text))) {
    const name = String(m[2] || m[4] || '').trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * camelCase ident from kebab placeholder base (header-top-band → headerTopBand).
 * @param {string} base
 */
function placeholderBaseToIdent(base) {
  return String(base || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p, i) =>
      i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
    )
    .join('')
    .replace(/[^A-Za-z0-9_$]/g, '') || 'ph';
}

/**
 * Always-on / prompt-first-safe: rewrite bare `<AppPlaceholder name="base" />`
 * to `name={phName}` with `placeholderBase` + `DynamicPlaceholderId`.
 * Multi-slot hosts get one Base+Ph per distinct literal name.
 * @param {string} source
 */
export function ensureAppPlaceholderDynamicNames(source) {
  let text = String(source || '');
  if (!text.trim() || !/<AppPlaceholder\b/.test(text)) return text;

  const bareNames = collectBareAppPlaceholderNames(text);
  if (!bareNames.length) return text;

  const single = bareNames.length === 1;
  /** @type {Map<string, { baseIdent: string, phIdent: string }>} */
  const idents = new Map();
  for (const base of bareNames) {
    const stem = placeholderBaseToIdent(base);
    idents.set(base, {
      baseIdent: single ? 'placeholderBase' : `${stem}Base`,
      phIdent: single ? 'phName' : `${stem}Ph`,
    });
  }

  // Replace bare name="…" / name={'…'} with name={phIdent}
  text = text.replace(
    /(<AppPlaceholder\b[^>]*?\bname\s*=\s*)(?:(["'])([^"']+)\2|\{\s*(["'])([^"']+)\4\s*\})/g,
    (full, prefix, _q1, n1, _q2, n2) => {
      const name = String(n1 || n2 || '').trim();
      const meta = idents.get(name);
      if (!meta) return full;
      return `${prefix}{${meta.phIdent}}`;
    },
  );

  const hasDynBinding = /\b(?:dynId|dynamicPlaceholderId|phKey)\b/.test(text);
  const dynDecl = !hasDynBinding
    ? `const dynId = props.params?.DynamicPlaceholderId ?? props.rendering?.params?.DynamicPlaceholderId;\n`
    : '';

  /** @type {string[]} */
  const declLines = [];
  if (dynDecl) declLines.push(dynDecl.trimEnd());
  for (const base of bareNames) {
    const { baseIdent, phIdent } = idents.get(base);
    // Skip if this base const already exists
    const baseAlready = new RegExp(
      `\\b(?:const|let)\\s+${baseIdent}\\s*=`,
    ).test(text);
    const phAlready = new RegExp(`\\b(?:const|let)\\s+${phIdent}\\s*=`).test(
      text,
    );
    if (!baseAlready) {
      declLines.push(`const ${baseIdent} = '${base}';`);
    }
    if (!phAlready) {
      const dynVar = /\bdynId\b/.test(text + declLines.join('\n'))
        ? 'dynId'
        : /\bdynamicPlaceholderId\b/.test(text)
          ? 'dynamicPlaceholderId'
          : /\bphKey\b/.test(text)
            ? 'phKey'
            : 'dynId';
      declLines.push(
        `const ${phIdent} = ${dynVar} ? \`\${${baseIdent}}-\${${dynVar}}\` : ${baseIdent};`,
      );
    }
  }

  if (!declLines.length) {
    fixupWarn(
      `  ⚠ Codegen fixup: AppPlaceholder bare name(s) → DynamicPlaceholderId phName (${bareNames.join(', ')})`,
    );
    return text;
  }

  const indented = declLines.map((l) => `  ${l}`).join('\n');

  // Block-body Default: inject after opening `{`
  const blockFn = text.match(
    /export\s+const\s+Default\s*=\s*(?:\([^)]*\)|[A-Za-z_][\w]*)\s*(?::\s*[^=]+)?\s*=>\s*\{/,
  );
  if (blockFn && blockFn.index != null) {
    const insertAt = blockFn.index + blockFn[0].length;
    text = `${text.slice(0, insertAt)}\n${indented}\n${text.slice(insertAt)}`;
  } else {
    // Paren-body Default: `=> (` → `=> { decls; return (` and close with `); };`
    const parenFn = text.match(
      /export\s+const\s+Default\s*=\s*((?:\([^)]*\)|[A-Za-z_][\w]*)\s*(?::\s*[^=]+)?\s*=>)\s*\(/,
    );
    if (parenFn && parenFn.index != null) {
      const openAt = parenFn.index + parenFn[0].length - 1; // points at '('
      // Find matching close before export default / end of Default assignment
      let depth = 0;
      let closeAt = -1;
      for (let i = openAt; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(') depth += 1;
        else if (ch === ')') {
          depth -= 1;
          if (depth === 0) {
            closeAt = i;
            break;
          }
        }
      }
      if (closeAt > openAt) {
        const before = text.slice(0, parenFn.index + parenFn[1].length);
        const jsx = text.slice(openAt + 1, closeAt);
        let after = text.slice(closeAt + 1);
        // Drop trailing `;` that closed the paren-arrow expression — we re-add after block
        after = after.replace(/^\s*;/, '');
        text = `${before}{\n${indented}\n  return (\n${jsx}\n  );\n};${after}`;
      }
    } else {
      const ap = text.search(/<AppPlaceholder\b/);
      if (ap >= 0) {
        text = `${text.slice(0, ap)}${indented}\n${text.slice(ap)}`;
      } else {
        text = `${indented}\n${text}`;
      }
    }
  }

  fixupWarn(
    `  ⚠ Codegen fixup: AppPlaceholder bare name(s) → DynamicPlaceholderId phName (${bareNames.join(', ')})`,
  );
  return text;
}

/**
 * Remove obsolete `content.linkLists` dual-write sidecars from definition.ts.
 * Flat link lists belong on dedicated LinkList packages under Data/Link Lists.
 * @param {string} source
 * @returns {string}
 */
export function stripContentLinkListsDualWrite(source) {
  let text = String(source || '');
  if (!/\blinkLists\s*:/.test(text)) return text;

  // Match `linkLists: [ … ],` with balanced brackets (string-aware).
  const startRe = /\blinkLists\s*:\s*\[/;
  const m = startRe.exec(text);
  if (!m || m.index == null) return text;
  const openIdx = text.indexOf('[', m.index);
  if (openIdx < 0) return text;
  let depth = 0;
  let quote = null;
  let closeIdx = -1;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) return text;
  let end = closeIdx + 1;
  const after = text.slice(end);
  const comma = after.match(/^\s*,/);
  if (comma) end += comma[0].length;
  // Also drop a leading comma on the previous token when linkLists was last prop.
  let start = m.index;
  const before = text.slice(0, start);
  const leadComma = before.match(/,\s*$/);
  if (leadComma && !/,\s*$/.test(text.slice(end).match(/^\s*/)?.[0] || '')) {
    // keep structure: prefer removing trailing comma after the block
  }
  text = `${text.slice(0, start)}${text.slice(end)}`;
  text = text.replace(/\n{3,}/g, '\n\n');
  if (/\blinkLists\s*:/.test(text)) {
    fixupWarn('stripped content.linkLists dual-write sidecar (LinkList packages own Data/Link Lists)');
  } else {
    fixupWarn('stripped content.linkLists dual-write sidecar');
  }
  return text;
}

/**
 * Strip obsolete PLATFORM_LINK_LIST imports/usages and content.platform.
 * Link Lists folder alone drives emit; AI must not reference platform-link-list.
 */
export function stripPlatformLinkListBoilerplate(source) {
  let text = String(source || '');

  // Remove import { PLATFORM_LINK_LIST, … } from "…/platform-link-list"
  text = text.replace(
    /\n?import\s*\{[^}]*\bPLATFORM_LINK_LIST\b[^}]*\}\s*from\s*["'][^"']*platform-link-list["'];?\s*/g,
    '\n',
  );
  text = text.replace(
    /\n?import\s+\*\s+as\s+\w+\s+from\s*["'][^"']*platform-link-list["'];?\s*/g,
    '\n',
  );

  // Remove top-level keys that reference PLATFORM_LINK_LIST symbols
  text = text.replace(
    /\n?\s*datasourceTemplate\s*:\s*`?\{?\$\{PLATFORM_LINK_LIST[^`\n]+`?,?\s*/g,
    '\n',
  );
  text = text.replace(
    /\n?\s*datasourceTemplate\s*:\s*\{?\s*`\$\{PLATFORM_LINK_LIST[\s\S]*?`\s*\}?,?\s*/g,
    '\n',
  );
  text = text.replace(
    /\n?\s*datasourceTemplate\s*:\s*`\{\$\{PLATFORM_LINK_LIST\.groupTemplateId\.toUpperCase\(\)\}\}`\s*,?\s*/g,
    '\n',
  );
  text = text.replace(
    /\n?\s*componentGraphQLQuery\s*:\s*PLATFORM_LINK_LIST_COMPONENT_GQL\s*,?\s*/g,
    '\n',
  );

  // Remove content.platform: "link-list" (folder detection is enough)
  text = text.replace(/\n?\s*platform\s*:\s*["']link-list["']\s*,?\s*/g, '\n');

  // Collapse extra blank lines from removals
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

/**
 * Force top-level `componentName` / `name` to match the resolved brand-prefixed
 * package (AxaSiteFooter). Sets top-level `displayName` to spaced Title Case
 * **without** the brand/site prefix (SitecoreCapabilityCarousel → "Capability Carousel").
 * @param {string} source
 * @param {{ definitionKey?: string|null, componentName?: string|null, codePrefix?: string|null }} opts
 */
export function ensureDefinitionComponentIdentity(source, opts = {}) {
  let text = String(source || '');
  const componentName = String(opts.componentName || '').trim();
  const codePrefix = String(opts.codePrefix || '').trim();
  const definitionKey =
    String(opts.definitionKey || '').trim() ||
    (componentName ? toDefinitionKey(componentName) : '');
  if (!componentName && !definitionKey) return text;

  if (componentName) {
    if (/\bcomponentName\s*:/.test(text)) {
      text = text.replace(
        /\bcomponentName\s*:\s*["'][^"']*["']/,
        `componentName: "${componentName}"`,
      );
    } else if (/\bdefinitionKey\s*:\s*["'][^"']*["']/.test(text)) {
      text = text.replace(
        /(\bdefinitionKey\s*:\s*["'][^"']*["']\s*,)/,
        `$1\n  componentName: "${componentName}",`,
      );
    }
  }
  if (definitionKey) {
    if (/\bdefinitionKey\s*:/.test(text)) {
      text = text.replace(
        /\bdefinitionKey\s*:\s*["'][^"']*["']/,
        `definitionKey: "${definitionKey}"`,
      );
    }
    // Top-level `name` immediately after definitionKey (not content.items[].name).
    text = text.replace(
      /(\bdefinitionKey\s*:\s*["'][^"']*["']\s*,\s*\r?\n\s*)name\s*:\s*["'][^"']*["']/,
      `$1name: "${definitionKey}"`,
    );
  }
  // Top-level displayName: spaced Title Case without brand/site prefix.
  if (componentName) {
    const displayName = displayNameFromComponentName(componentName, codePrefix);
    if (displayName) {
      const headEnd = (() => {
        const markers = [
          text.search(/\bmodel\s*:/),
          text.search(/\bcontent\s*:/),
          text.search(/\bplaceholders\s*:/),
          text.search(/\bvariants\s*:/),
        ].filter((i) => i >= 0);
        return markers.length ? Math.min(...markers) : text.length;
      })();
      const head = text.slice(0, headEnd);
      const tail = text.slice(headEnd);
      if (/\bdisplayName\s*:/.test(head)) {
        text =
          head.replace(
            /\bdisplayName\s*:\s*["'][^"']*["']/,
            `displayName: ${JSON.stringify(displayName)}`,
          ) + tail;
      } else if (/\bcomponentName\s*:\s*["'][^"']*["']/.test(head)) {
        text =
          head.replace(
            /(\bcomponentName\s*:\s*["'][^"']*["']\s*,)/,
            `$1\n  displayName: ${JSON.stringify(displayName)},`,
          ) + tail;
      } else if (
        /\bdefinitionKey\s*:\s*["'][^"']*["']\s*,\s*\r?\n\s*name\s*:\s*["'][^"']*["']\s*,/.test(
          head,
        )
      ) {
        text =
          head.replace(
            /(\bdefinitionKey\s*:\s*["'][^"']*["']\s*,\s*\r?\n\s*name\s*:\s*["'][^"']*["']\s*,)/,
            `$1\n  displayName: ${JSON.stringify(displayName)},`,
          ) + tail;
      }
    }
  }
  return text;
}

/**
 * Prefix `placeholders[].allowedControls` entries with the brand kebab prefix.
 * @param {string} source
 * @param {string} codePrefix
 */
export function prefixAllowedControlsInDefinition(source, codePrefix) {
  const text = String(source || '');
  const prefix = String(codePrefix || '').trim();
  if (!text || !prefix) return text;
  return text.replace(
    /\ballowedControls\s*:\s*\[([^\]]*)\]/g,
    (full, inner) => {
      const next = String(inner).replace(/["']([^"']+)["']/g, (_, key) => {
        const prefixed = ensureBrandDefinitionKeyPrefix(key, prefix);
        return `"${prefixed}"`;
      });
      return `allowedControls: [${next}]`;
    },
  );
}

/**
 * Recover a double-quoted TS string that may contain unescaped HTML attribute quotes
 * (`href="https://…"`). HTML `="…"` pairs are treated as nested, not as the TS closer.
 * @param {string} text
 * @param {number} start index of first character after the opening `"`
 * @returns {{ raw: string, end: number } | null}
 */
function recoverPossiblyBrokenQuotedString(text, start) {
  let i = start;
  let inHtmlAttr = false;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (!inHtmlAttr && c === '=') {
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j += 1;
      if (text[j] === '"') {
        inHtmlAttr = true;
        i = j + 1;
        continue;
      }
    }
    if (c === '"') {
      if (inHtmlAttr) {
        inHtmlAttr = false;
        i += 1;
        continue;
      }
      return { raw: text.slice(start, i), end: i + 1 };
    }
    i += 1;
  }
  return null;
}

function quotedStringHasUnescapedQuote(raw) {
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '\\') {
      i += 1;
      continue;
    }
    if (raw[i] === '"') return true;
  }
  return false;
}

/**
 * Rewrite field seed string literals that break TS because HTML attributes used raw `"`.
 * Only touches `Key: "…"` values (object field seeds), not the rest of the file.
 * @param {string} source
 * @returns {string}
 */
export function stringifyBrokenDefinitionFieldStrings(source) {
  const text = String(source || '');
  const re = /(\b[A-Za-z_][\w]*\s*:\s*)"/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    const recovered = recoverPossiblyBrokenQuotedString(text, m.index + m[0].length);
    if (!recovered) continue;
    if (!quotedStringHasUnescapedQuote(recovered.raw)) {
      re.lastIndex = recovered.end;
      continue;
    }
    const unescaped = recovered.raw.replace(/\\(["\\])/g, '$1');
    out += text.slice(last, m.index) + m[1] + JSON.stringify(unescaped);
    last = recovered.end;
    re.lastIndex = recovered.end;
  }
  return out + text.slice(last);
}

/**
 * Repair common AI / legacy-fixup corruptions in definition.ts:
 * - `name: "Foo },\n Link: {…}Bar"` (Link spliced into a name string)
 * - `"Open In New Win }ow"` / truncated checkbox booleans
 * @param {string} source
 */
export function repairCorruptedDefinitionLiterals(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  let repairs = 0;

  // Link object spliced into the middle of a name string
  text = text.replace(
    /\bname\s*:\s*"((?:\\.|[^"\\])*?)\}\s*,\s*\r?\n(\s*)Link\s*:\s*\{([\s\S]*?)\}(\s*(?:\\.|[^"\\])*)"/g,
    (_full, pre, indent, linkInner, post) => {
      repairs += 1;
      const preRaw = String(pre);
      const postRaw = String(post);
      const preT = preRaw.replace(/\s+$/, '');
      const postT = postRaw.replace(/^\s+/, '');
      // If post still had leading whitespace after `}`, keep a word boundary; otherwise
      // the splice ate a letter mid-word (Ready → R + ady) and must not insert a space.
      const needSpace =
        /\w$/.test(preT) && /^\w/.test(postT) && /^\s/.test(postRaw);
      const name = `${preT}${needSpace ? ' ' : ''}${postT}`.trim();
      return `name: ${JSON.stringify(name)},\n${indent}Link: {${linkInner}}`;
    },
  );

  const beforeKeys = text;
  text = text
    .replace(/"Open In New Win\s*\}\s*ow"/g, '"Open In New Window"')
    .replace(/"Open In New Wind\s*\}\s*w"/g, '"Open In New Window"')
    .replace(/:\s*tru\s*\}/g, ': true')
    .replace(/:\s*fals\s*\}/g, ': false');
  if (text !== beforeKeys) repairs += 1;

  // Stray `}` inside double-quoted strings between word chars (Relea}e → Release)
  text = text.replace(/"((?:\\.|[^"\\])*)"/g, (full, inner) => {
    if (!/\w\}\w/.test(inner)) return full;
    repairs += 1;
    return JSON.stringify(inner.replace(/(\w)\}(\w)/g, '$1$2'));
  });

  if (repairs > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: repaired ${repairs} corrupted definition string/brace fragment(s)`,
    );
  }
  return text;
}

/**
 * Find matching `}` for an object body starting at `start` (index of first char
 * after the opening `{`). Returns exclusive end index, or -1.
 * @param {string} text
 * @param {number} start
 * @returns {number}
 */
function findMatchingBraceEnd(text, start) {
  let depth = 1;
  let inStr = null;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * True when `content: { … }` has a top-level `fields` key and no `items` key
 * (GraphQL/layout seed shape — not ComponentContentSeed).
 * @param {string} source
 * @returns {boolean}
 */
export function definitionTsHasContentFieldsWithoutItems(source) {
  const text = String(source || '');
  const re = /\bcontent\s*:\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const bodyStart = m.index + m[0].length;
    const bodyEnd = findMatchingBraceEnd(text, bodyStart);
    if (bodyEnd < 0) continue;
    const body = text.slice(bodyStart, bodyEnd);
    let depth = 0;
    let inStr = null;
    let escape = false;
    let hasItems = false;
    let hasFields = false;
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i];
      if (inStr) {
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\') {
          escape = true;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth !== 0) continue;
      if (body.slice(i).match(/^items\s*:/)) {
        hasItems = true;
        i += 'items'.length;
        continue;
      }
      if (body.slice(i).match(/^fields\s*:/)) {
        hasFields = true;
        i += 'fields'.length;
      }
    }
    if (hasFields && !hasItems) return true;
  }
  return false;
}

/**
 * True when nested seed rows use GraphQL `children: { results: … }` instead of
 * `children: [ … ]`.
 * @param {string} source
 * @returns {boolean}
 */
export function definitionTsHasGraphqlChildrenResults(source) {
  return /children\s*:\s*\{\s*results\s*:/.test(String(source || ''));
}

/**
 * True when content seeds use runtime Field wrappers (`{ value: … }`).
 * Definition seeds must be plain strings / `{ url, alt }` / `{ text, url }`.
 * @param {string} source
 * @returns {boolean}
 */
export function definitionTsHasRuntimeValueSeedWrappers(source) {
  // Field: { value: '…' } | Field: { value: { … } }
  return /:\s*\{\s*value\s*:\s*(?:\{|['"`])/.test(String(source || ''));
}

/**
 * True when Image seeds use `src` instead of definition `url`.
 * @param {string} source
 * @returns {boolean}
 */
export function definitionTsHasImageSrcSeeds(source) {
  return /:\s*\{\s*src\s*:/.test(String(source || ''));
}

const DEFINITION_SEED_BARE_IDENT_OK = new Set(['true', 'false', 'null', 'undefined']);

/**
 * True when a `fields: { … }` body has a property whose RHS is a bare identifier
 * (e.g. `'Context Links': contextLinks`, `svgMarkup: fooSvg`). Literals,
 * object/array literals, and `JSON.stringify(…)` are allowed.
 * @param {string} body
 * @returns {boolean}
 */
function fieldsObjectHasBareIdentifierValues(body) {
  let i = 0;
  let inStr = null;
  let escape = false;
  while (i < body.length) {
    const ch = body[i];
    if (inStr) {
      if (escape) {
        escape = false;
        i += 1;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        i += 1;
        continue;
      }
      if (ch === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      i += 1;
      continue;
    }
    if (ch === ':') {
      let j = i + 1;
      while (j < body.length && /\s/.test(body[j])) j += 1;
      const idMatch = /^[A-Za-z_$][\w$]*/.exec(body.slice(j));
      if (idMatch) {
        const id = idMatch[0];
        let k = j + id.length;
        while (k < body.length && /\s/.test(body[k])) k += 1;
        const next = body[k];
        // Bare property value ends at `,` / `}` — not `.` (JSON.stringify) or `(` (call).
        if (
          (next === ',' || next === '}' || next === undefined) &&
          !DEFINITION_SEED_BARE_IDENT_OK.has(id)
        ) {
          return true;
        }
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return false;
}

/**
 * True when content field seeds use bare identifiers as values
 * (`'Context Links': contextLinks`) — causes ReferenceError at definitions:generate.
 * @param {string} source
 * @returns {boolean}
 */
export function definitionTsHasBareIdentifierFieldSeeds(source) {
  const text = String(source || '');
  const re = /\bfields\s*:\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const bodyStart = m.index + m[0].length;
    const bodyEnd = findMatchingBraceEnd(text, bodyStart);
    if (bodyEnd < 0) continue;
    if (fieldsObjectHasBareIdentifierValues(text.slice(bodyStart, bodyEnd))) {
      return true;
    }
  }
  return false;
}

/**
 * Whether `itemTemplate` / `folderTemplate` declare a depth-1 `name` property.
 * @param {string} source
 * @param {'itemTemplate'|'folderTemplate'} key
 * @returns {boolean}
 */
export function definitionTsHasNamedTemplate(source, key) {
  const text = String(source || '');
  const re = new RegExp(`\\b${key}\\s*:\\s*\\{`);
  const m = re.exec(text);
  if (!m) return false;
  const open = text.indexOf('{', m.index);
  if (open < 0) return false;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
      continue;
    }
    // Only count `name:` at the template object root (not nested section names).
    if (
      depth === 1 &&
      text.startsWith('name', i) &&
      (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1])) &&
      /^\s*:/.test(text.slice(i + 4))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Reject GraphQL-shaped / runtime-shaped content seeds (reject/retry — do not rewrite).
 * @param {string} source
 * @param {string} [label]
 */
export function assertDefinitionTsSeedShape(source, label = 'definition.ts') {
  const text = String(source || '');
  const problems = [];
  if (definitionTsHasGraphqlChildrenResults(text)) {
    problems.push(
      'found children: { results: … } — use children: [ { name, fields }, … ]',
    );
  }
  if (definitionTsHasContentFieldsWithoutItems(text)) {
    problems.push(
      'found content.fields without content.items — use content: { location, culture, items: […] }',
    );
  }
  if (definitionTsHasRuntimeValueSeedWrappers(text)) {
    problems.push(
      'found runtime Field wrappers `{ value: … }` in seeds — use plain strings, Image `{ url, alt }`, Link `{ text, url }`',
    );
  }
  if (definitionTsHasImageSrcSeeds(text)) {
    problems.push(
      'found Image seed with `src` — use `{ url: "https://…", alt: "…" }` (not src, not { value: { src } })',
    );
  }
  if (definitionTsHasBareIdentifierFieldSeeds(text)) {
    problems.push(
      "found bare identifier field seed(s) — every content.items[].fields value must be a literal, object literal, or JSON.stringify([…]); never 'Context Links': contextLinks / svgMarkup: fooSvg (ReferenceError at generate)",
    );
  }
  if (!definitionTsHasNamedTemplate(text, 'folderTemplate')) {
    problems.push(
      'missing model.folderTemplate.name (spaced Title Case from displayName)',
    );
  }
  if (!definitionTsHasNamedTemplate(text, 'itemTemplate')) {
    problems.push(
      'missing model.itemTemplate.name (spaced Title Case from displayName)',
    );
  }
  if (!/\bcontent\s*:\s*\{[\s\S]*?\blocation\s*:\s*\{/.test(text)) {
    problems.push(
      'missing content.location ({ root: "data", folder: […] } — required on ComponentContentSeed)',
    );
  }
  // Top-level name: (not nested under model/itemTemplate). Rough: appears before model: or content:
  if (!/(?:^|[,\n])\s*name\s*:\s*['"`][^'"`]+['"`]/.test(text.split(/\bmodel\s*:/)[0] || '')) {
    problems.push(
      'missing top-level name (same kebab string as definitionKey)',
    );
  }
  if (problems.length) {
    throw new Error(
      `[codegen] ${label} has invalid definition seed shape — refusing to write broken definition (DEFINITION SEED SHAPE).\n${problems.join('\n')}`,
    );
  }
  return text;
}

/**
 * Count top-level content.items entries in a definition.ts source.
 * @param {string} source
 * @returns {number}
 */
export function countContentItemsInDefinitionTs(source) {
  const text = String(source || '');
  const itemsIdx = text.search(/\bitems\s*:\s*\[/);
  if (itemsIdx < 0) return 0;
  const start = text.indexOf('[', itemsIdx);
  if (start < 0) return 0;
  let depth = 0;
  let end = start;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = text.slice(start + 1, end);
  // Top-level objects in the items array (brace depth 0 → 1)
  let count = 0;
  let brace = 0;
  for (let i = 0; i < block.length; i += 1) {
    const ch = block[i];
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
 * Refuse child definitions whose content.items length disagrees with plan repeatHint.
 * @param {string} source
 * @param {number|null|undefined} repeatHint
 * @param {string} [label]
 */
export function assertDefinitionTsRepeatHint(
  source,
  repeatHint,
  label = 'definition.ts',
) {
  const hint = Number(repeatHint);
  if (!Number.isFinite(hint) || hint < 1) return source;
  const count = countContentItemsInDefinitionTs(source);
  if (hint === 1) {
    if (count !== 1) {
      throw new Error(
        `[codegen] ${label} DEFINITION REPEAT HINT: expected content.items.length === 1 (repeatHint=1), got ${count}. ` +
          `Seed only this child band — never sibling inventories.`,
      );
    }
    return source;
  }
  // For hint ≥ 2: allow exact match, or slightly under (dedupe), never massively over
  if (count > hint * 2 || count < Math.max(1, Math.floor(hint * 0.5))) {
    throw new Error(
      `[codegen] ${label} DEFINITION REPEAT HINT: expected ~${hint} content.items (repeatHint=${hint}), got ${count}. ` +
        `Seed this child band only.`,
    );
  }
  return source;
}

/**
 * Ensure definition.ts parses as TypeScript (same gate definitions:generate uses).
 * @param {string} source
 * @param {string} [label]
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   childFolder?: string,
 *   componentName?: string,
 *   definitionKey?: string,
 * }|null} [dumpOpts] — when set, write post-lean source under ai-debug on parse failure
 */
export function assertDefinitionTsParseable(
  source,
  label = 'definition.ts',
  dumpOpts = null,
) {
  const text = String(source || '');
  try {
    esbuild.transformSync(text, {
      loader: 'ts',
      format: 'esm',
      target: 'esnext',
    });
  } catch (err) {
    if (dumpOpts && typeof dumpOpts === 'object') {
      writeDefinitionAfterFixupsDump({
        ...dumpOpts,
        source: text,
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    const braceHint =
      /Expected identifier but found\s+"?\{"?/i.test(msg) ||
      /Expected "}" but found/i.test(msg)
        ? '\nHint: likely missing `}` after content.items[].fields before the next `{ name` (close fields then item).'
        : '';
    throw new Error(
      `[codegen] ${label} is not valid TypeScript after fixups — refusing to write broken definition.\n${msg}${braceHint}`,
    );
  }
  assertDefinitionTsSeedShape(text, label);
  return text;
}

/**
 * Overlay-track sections were visible at detection time. Capture may hide them
 * (display:none / data-screenshot-hidden) before HTML export — do not let that
 * poison Visible/Open Checkbox seeds or defaults.
 * @param {string} source
 * @param {object|null|undefined} sectionInfo
 */
export function forceOverlayVisibilitySeeds(source, sectionInfo) {
  let text = String(source || '');
  const info = sectionInfo && typeof sectionInfo === 'object' ? sectionInfo : null;
  if (!text.trim() || !info) return text;

  const track = String(info.track || '').toLowerCase();
  // Sticky header stacks are not float overlays — skip overlay-only seed fixups.
  if (track === 'header' || String(info.chromeKind || '').toLowerCase() === 'header-stack') {
    return text;
  }
  const isOverlay = track === 'overlay' || info.isOverlay === true;
  if (!isOverlay) return text;

  const rect = info.rect || {};
  const hasRect =
    Number.isFinite(Number(rect.x0)) &&
    Number.isFinite(Number(rect.y0)) &&
    Number.isFinite(Number(rect.x1)) &&
    Number.isFinite(Number(rect.y1)) &&
    Number(rect.x1) > Number(rect.x0) &&
    Number(rect.y1) > Number(rect.y0);
  const detectedVisible =
    info.detectedVisible === true ||
    (info.detectedVisible !== false &&
      (hasRect || Boolean(info.heading) || Boolean(String(info.selector || '').trim())));
  if (!detectedVisible) return text;

  const showTrue = /^(Visible|Is Visible|Open|Show|Is Open|Is Shown)$/i;
  const showFalse = /^(Dismissed|Closed|Is Dismissed|Is Closed|Hidden)$/i;
  let patched = 0;

  // Model Checkbox defaults: Visible/Open → true; Dismissed/Closed → false
  text = text.replace(
    /\{\s*name:\s*(["'])([^"']+)\1\s*,\s*type:\s*(["'])Checkbox\3\s*(?:,\s*default:\s*(true|false)\s*)?\}/g,
    (full, q1, name, q3, _def) => {
      if (showTrue.test(name)) {
        patched += 1;
        return `{ name: ${q1}${name}${q1}, type: ${q3}Checkbox${q3}, default: true }`;
      }
      if (showFalse.test(name)) {
        patched += 1;
        return `{ name: ${q1}${name}${q1}, type: ${q3}Checkbox${q3}, default: false }`;
      }
      return full;
    },
  );

  // content.items[].fields seeds
  text = text.replace(
    /(["']?)([A-Za-z][A-Za-z0-9 ]*)\1\s*:\s*(true|false)\b/g,
    (full, q, name, val) => {
      const key = String(name || '').trim();
      if (showTrue.test(key) && val === 'false') {
        patched += 1;
        return `${q || ''}${name}${q || ''}: true`;
      }
      if (showFalse.test(key) && val === 'true') {
        patched += 1;
        return `${q || ''}${name}${q || ''}: false`;
      }
      return full;
    },
  );

  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: overlay detectedVisible — forced show/open Checkbox seeds (${patched})`,
    );
  }
  return text;
}

/**
 * Lean / identity-only normalize (no mutating seed salvage). Used for
 * prompt-first mode and parse-preserving fallback when fixups break parse.
 * @param {string} source
 * @param {object} options
 */
function normalizeDefinitionTsLean(source, options = {}) {
  const {
    definitionKey = null,
    componentName = null,
    codePrefix = null,
    skipParseAssert = false,
    skipIntegrityAssert = false,
    parseDumpOpts = null,
  } = options;
  let text = sanitizeDefinitionStringSeeds(
    stringifyBrokenDefinitionFieldStrings(
      dedupeDefinitionSingletonKeys(normalizeAiSource(source)),
    ),
  );
  {
    const repaired = repairDefinitionContentItems(text);
    text = repaired.text;
    if (
      repaired.inserted > 0 ||
      repaired.collapsedStringify > 0 ||
      repaired.rootClosed > 0
    ) {
      fixupWarn(
        `content.items brace repair: inserted=${repaired.inserted} doubleStringify=${repaired.collapsedStringify} rootClosed=${repaired.rootClosed}`,
      );
    }
  }
  text = unwrapJsonStringifyOnPathNames(text);
  if (definitionKey) {
    text = keepExpectedComponentDefinitionExport(text, { definitionKey });
  }
  text = ensureDefinitionComponentIdentity(text, {
    definitionKey,
    componentName,
    codePrefix,
  });
  if (codePrefix) {
    text = prefixAllowedControlsInDefinition(text, codePrefix);
  }
  {
    const label = definitionKey
      ? `${definitionKey}.definition.ts`
      : 'definition.ts';
    assertAllowedSitecoreFieldTypesInDefinition(text, label);
  }
  if (!skipParseAssert) {
    const label = definitionKey
      ? `${definitionKey}.definition.ts`
      : 'definition.ts';
    assertDefinitionTsParseable(text, label, parseDumpOpts);
    if (!skipIntegrityAssert) {
      assertDefinitionSeedIntegrity(text, label);
    }
  }
  return text;
}

export function normalizeDefinitionTs(source, options = {}) {
  // v1: full definition fixups always run (--skip-fixups only skips TSX/client).
  // v2 prompt-first: identity + parse gates only unless BQ_CODEGEN_V2_FIXUPS=1.
  const {
    imageInventory = null,
    sectionInfo = null,
    sectionHtml = null,
    sitecoreIcon = null,
    definitionKey = null,
    componentName = null,
    codePrefix = null,
    tsxSource = null,
    skipParseAssert = false,
    skipIntegrityAssert = false,
    aiDebugRoot = null,
    pageSectionDir = null,
    childFolder = null,
  } = options;
  const parseDumpOpts =
    aiDebugRoot || pageSectionDir
      ? {
          aiDebugRoot: aiDebugRoot || undefined,
          pageSectionDir: pageSectionDir || undefined,
          childFolder: childFolder || undefined,
          componentName: componentName || undefined,
          definitionKey: definitionKey || undefined,
        }
      : null;
  // Deterministic seed sanitize first (C0 / CSS bleed / broken quotes).
  const preSanitize = stringifyBrokenDefinitionFieldStrings(
    dedupeDefinitionSingletonKeys(normalizeAiSource(source)),
  );
  const sanitizeDetail = sanitizeDefinitionStringSeedsDetailed(preSanitize);
  let text = sanitizeDetail.text;
  // Late / finalize-only path: dump when sanitize still found work (idempotent
  // after sitecoreize — usually a no-op; uses definition-sanitize-* stem).
  if (sanitizeDetail.changed > 0 && parseDumpOpts) {
    writeDefinitionSanitizeDump({
      ...parseDumpOpts,
      purpose: 'definition-sanitize',
      componentName:
        componentName || definitionKey || parseDumpOpts.componentName || '',
      changed: sanitizeDetail.changed,
      changes: sanitizeDetail.changes,
      beforeSource: preSanitize,
      afterSource: text,
    });
  }
  {
    const repaired = repairDefinitionContentItems(text);
    text = repaired.text;
    if (
      repaired.inserted > 0 ||
      repaired.collapsedStringify > 0 ||
      repaired.rootClosed > 0
    ) {
      fixupWarn(
        `content.items brace repair: inserted=${repaired.inserted} doubleStringify=${repaired.collapsedStringify} rootClosed=${repaired.rootClosed}`,
      );
    }
  }
  text = unwrapJsonStringifyOnPathNames(text);
  const inputWasParseable = tryParseDefinitionTs(text).ok;
  const label = definitionKey
    ? `${definitionKey}.definition.ts`
    : 'definition.ts';

  const leanDefinition = shouldSkipMutatingDefinitionFixups();
  if (leanDefinition) {
    logV2PromptFirstOnce();
    return normalizeDefinitionTsLean(text, {
      definitionKey,
      componentName,
      codePrefix,
      skipParseAssert,
      skipIntegrityAssert,
      parseDumpOpts,
    });
  }

  const preMutating = text;
  text = repairCorruptedDefinitionLiterals(text);
  text = liftStrayContentItemFieldSeeds(text);
  text = dedupeContentItemFieldKeys(text);
  if (definitionKey) {
    text = keepExpectedComponentDefinitionExport(text, { definitionKey });
  }
  text = ensureDefinitionComponentIdentity(text, {
    definitionKey,
    componentName,
    codePrefix,
  });
  if (codePrefix) {
    text = prefixAllowedControlsInDefinition(text, codePrefix);
  }
  text = ensureDatasourceLocationScope(text);
  text = stripPlatformLinkListBoilerplate(text);
  // Strip obsolete dual-write sidecars — flat lists use LinkList packages only.
  text = stripContentLinkListsDualWrite(text);
  text = ensurePlaceholderKeysAreBase(text);
  text = stripPlaceholdersWhenSingleMode(text, {
    ...options,
    planMode: options.planMode || options.plan?.mode,
    tsxSource: options.tsxSource,
  });
  // Platform Link/Icon/Image Link Lists are leaves — never keep parent PH maps.
  text = forceEmptyPlaceholdersForPlatformLinkLists(text);
  text = ensureSpacedTemplateNames(text, codePrefix);
  text = ensureSpacedDataFolders(text);
  if (codePrefix) {
    text = stripBrandFromSitecoreStructuralNames(text, codePrefix);
  }
  // Content/seed salvage: off during validate loop + validate-clean writes.
  // Detect-only CONTRACTs feed AI retries instead of silent rewrites.
  const allowSeedSalvage = options.allowSeedSalvage === true;
  if (allowSeedSalvage) {
    text = remapContentFromSuggestedFields(text, sectionInfo, sectionHtml);
    text = injectMissingContentSeedsFromSuggestedFields(
      text,
      sectionInfo,
      sectionHtml,
    );
    text = injectGroupTitlesFromRepeats(text, sectionInfo);
    text = rewriteSeedTitlesMatchingParentHeading(text, sectionInfo);
    text = rewriteLiteralTitleSeedsFromItemName(text, sectionInfo);
    text = rewriteParentCopiedChildSeeds(text, sectionInfo);
  }
  if (options.allowSelfNestedFixup !== false) {
    const planKids = Array.isArray(options.plan?.children)
      ? options.plan.children
      : [];
    const preferredChild = planKids[0]
      ? toDefinitionKey(planKids[0].componentName || '')
      : '';
    text = forbidSelfNestedAllowedControls(text, {
      preferredChildDefinitionKey:
        preferredChild && preferredChild !== definitionKey
          ? preferredChild
          : undefined,
    });
  }
  text = ensureCompositeParentContentSeed(text, {
    sectionInfo,
    sectionHtml,
    planMode: options.planMode || options.plan?.mode,
  });
  text = ensureSpacedFieldNamesInDefinition(text);
  text = remapViewportImageUrls(text, imageInventory);
  const icon =
    String(sitecoreIcon || sectionInfo?.sitecoreIcon || "").trim() || null;
  if (icon) {
    text = applyDefinitionIcon(text, icon);
  }
  warnHashLinkListUrls(text);
  // Strip nested Image/Icon Link|CTA before inject so nested junk is not treated as present.
  text = stripNestedLinkPropsFromImageSeeds(text);
  if (allowSeedSalvage) {
    text = injectMissingLinkSeeds(text, sectionInfo, sectionHtml);
    text = fillLinkUrlsFromSectionHtml(text, sectionHtml);
    text = ensureLinkSeedsHaveUrl(text);
  } else if (sectionHtml) {
    // Always-on: replace placeholder url:"/" with real capture hrefs — never invent "/".
    // Build-gate AI rewrites TSX only, so definition slash seeds must clear mechanically.
    text = fillLinkUrlsFromSectionHtml(text, sectionHtml);
  }
  text = normalizeIconLinkListIconSeeds(text);
  text = collapseEmptyMetricUnitFields(text);
  text = omitEmptyStringContentFieldSeeds(text);
  text = stripContentPresentationFromDefinition(text);
  text = renameReservedSitecoreFieldNames(text);
  // Second pass: inject/fill can re-nest; strip again then repair stray lifts.
  text = stripNestedLinkPropsFromImageSeeds(text);
  // stripNested can historically mis-lift CTA out of fields — repair again.
  text = liftStrayContentItemFieldSeeds(text);
  text = stripVacuousDescriptionFromDefinition(text);
  text = ensureHeadlessVariantsForVisualModes(text);
  text = stripShowDownArrowLayoutFlag(text);
  text = stripItemTemplateDisplayName(text);
  text = ensureContentItemDisplayNames(text);
  text = injectRenderingIdentifiersFromSectionHtml(text, sectionHtml);
  // Inject/remap steps can re-introduce duplicate field keys (CTA/Link) — collapse again.
  text = dedupeContentItemFieldKeys(text);
  // Definition-only: drop variants not exported in sibling TSX (never patch TSX).
  text = stripOrphanVariantsNotInTsx(text, tsxSource);
  // Rewrite illegal itemTemplate.children → childItemTemplate, then hoist to model
  text = rewriteItemTemplateChildrenToChildItemTemplate(text);
  // Hoist misplaced childItemTemplate nested under itemTemplate → model.childItemTemplate
  text = hoistNestedChildItemTemplate(text);
  // Composite placeholders → child packages own fields; drop redundant childItemTemplate first
  // so orphan-seed strip does not treat child-template names as valid parent keys.
  text = stripCompositeChildItemTemplate(text);
  text = stripOrphanContentFieldSeeds(text);
  // Std-values defaults from tokens / content.items (after seeds are final).
  text = ensureFieldDefaultsFromContentItems(text);
  // Overlay visibility after field defaults (defaults may re-copy false Visible).
  text = forceOverlayVisibilitySeeds(text, sectionInfo);
  // Reject invented Sitecore field types (e.g. Array) before write / emit.
  assertAllowedSitecoreFieldTypesInDefinition(text, label);

  // Final safety: never emit unparseable definition.ts (esbuild / definitions:generate).
  // Parse-preserving: if input parsed and mutating fixups broke it, dump + lean fallback.
  if (!skipParseAssert) {
    const outParse = tryParseDefinitionTs(text);
    if (!outParse.ok && inputWasParseable) {
      fixupWarn(
        `  ⚠ Definition fixups broke parse for ${label} — falling back to lean/safe normalize`,
      );
      if (parseDumpOpts) {
        writeDefinitionAfterFixupsDump({
          ...parseDumpOpts,
          source: text,
        });
      }
      return normalizeDefinitionTsLean(preMutating, {
        definitionKey,
        componentName,
        codePrefix,
        skipParseAssert: false,
        skipIntegrityAssert,
        parseDumpOpts,
      });
    }
    if (!outParse.ok) {
      // Still try one more sanitize pass before refuse
      text = sanitizeDefinitionStringSeeds(text);
    }
    assertDefinitionTsParseable(text, label, parseDumpOpts);
    if (!skipIntegrityAssert) {
      assertDefinitionSeedIntegrity(text, label);
    }
  }
  return text;
}

/** Exact `model…fields[].type` strings AI codegen may emit (BQ content emit supports these). */
export const ALLOWED_SITECORE_FIELD_TYPES = Object.freeze([
  'Single-Line Text',
  'Multi-Line Text',
  'Rich Text',
  'Image',
  'General Link',
  'Checkbox',
]);

const ALLOWED_SITECORE_FIELD_TYPE_SET = new Set(
  ALLOWED_SITECORE_FIELD_TYPES.map((t) => t.toLowerCase()),
);

/**
 * Fail fast when definition.ts invents non-Sitecore / unsupported field types
 * (e.g. `type: "Array"` for FAQ Questions).
 * @param {string} source
 * @param {string} [label]
 */
export function assertAllowedSitecoreFieldTypesInDefinition(source, label = 'definition.ts') {
  const text = String(source || '');
  if (!text.trim()) return;
  /** @type {string[]} */
  const bad = [];
  const re = /\btype\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    // Skip non-field `type` keys if any appear (none expected in our defs).
    if (ALLOWED_SITECORE_FIELD_TYPE_SET.has(raw.toLowerCase())) continue;
    bad.push(raw);
  }
  if (!bad.length) return;
  const unique = [...new Set(bad)];
  throw new Error(
    `${label}: unsupported Sitecore field type(s): ${unique.map((t) => JSON.stringify(t)).join(', ')}. ` +
      `Allowed (exact): ${ALLOWED_SITECORE_FIELD_TYPES.join(', ')}. ` +
      `Repeating FAQ/card/link rows must be content children / childItemTemplate — never type "Array" / JSON.`,
  );
}

/**
 * When section / repeating-block roots have an HTML `id`, copy it onto
 * content.items[].renderingIdentifier (presentation wiring reads this).
 * Never uses nested descendant ids.
 * @param {string} source
 * @param {string|null|undefined} sectionHtml
 */
export function injectRenderingIdentifiersFromSectionHtml(source, sectionHtml) {
  let text = String(source || '');
  const html = String(sectionHtml || '');
  if (!text.trim() || !html.trim()) return text;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;
  const contentOpen = text.indexOf('{', contentMatch.index);
  if (contentOpen < 0) return text;
  const itemsMatch = text.slice(contentOpen).match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return text;
  const itemsAbs = contentOpen + itemsMatch.index;
  const itemsBracket = text.indexOf('[', itemsAbs);
  if (itemsBracket < 0) return text;

  // Walk top-level `{ name: "…" … }` objects in items array
  /** @type {Array<{ name: string, start: number, nameEnd: number, hasId: boolean }>} */
  const items = [];
  let depth = 0;
  let i = itemsBracket;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) break;
    } else if (ch === '{' && depth === 1) {
      const nameMatch = text
        .slice(i)
        .match(/^\{\s*name\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      if (nameMatch) {
        const nameEnd = i + nameMatch[0].length;
        // Find end of this object
        let od = 0;
        let j = i;
        for (; j < text.length; j++) {
          if (text[j] === '{') od += 1;
          else if (text[j] === '}') {
            od -= 1;
            if (od === 0) {
              j += 1;
              break;
            }
          }
        }
        const body = text.slice(i, j);
        const hasId = /\brenderingIdentifier\s*:/.test(body);
        items.push({
          name: nameMatch[2],
          start: i,
          nameEnd,
          hasId,
          end: j,
        });
        i = j;
        continue;
      }
    }
    i += 1;
  }

  if (!items.length) return text;

  const sectionRootId = extractSectionRootId(html);
  const cardIds = [
    ...extractRepeatingBlockRootIds(html, { itemClass: 'imgcard' }),
    ...extractRepeatingBlockRootIds(html, { itemClass: 'card' }),
  ].filter(Boolean);
  // Unique preserve order
  const seen = new Set();
  const repeatIds = [];
  for (const id of cardIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    repeatIds.push(id);
  }

  /** @type {Array<{ index: number, id: string }>} */
  const assignments = [];
  if (items.length === 1 && sectionRootId && !items[0].hasId) {
    assignments.push({ index: 0, id: sectionRootId });
  } else if (repeatIds.length) {
    for (let idx = 0; idx < items.length && idx < repeatIds.length; idx++) {
      if (items[idx].hasId) continue;
      if (!repeatIds[idx]) continue;
      assignments.push({ index: idx, id: repeatIds[idx] });
    }
  }

  // Also match data-role=anchor-target open tags the same way (standalone id only)
  const anchorTargetRe =
    /<([a-z0-9]+)([^>]*\bdata-role\s*=\s*["']anchor-target["'][^>]*)>/gi;
  let am;
  while ((am = anchorTargetRe.exec(html))) {
    const tid = readIdFromOpenTagAttrs(am[2] || '');
    if (!tid) continue;
    if (items.length === 1 && !items[0].hasId && sectionRootId === tid) {
      if (!assignments.some((a) => a.index === 0)) {
        assignments.push({ index: 0, id: tid });
      }
    }
  }

  if (!assignments.length) return text;

  // Apply from end so offsets stay valid
  assignments.sort((a, b) => b.index - a.index);
  for (const { index, id } of assignments) {
    const item = items[index];
    if (!item || item.hasId) continue;
    const afterName = text.slice(item.nameEnd);
    const commaMatch = afterName.match(/^\s*,/);
    let insertAt = item.nameEnd;
    let insert;
    if (commaMatch) {
      // name: "…" ,  → insert after the comma
      insertAt = item.nameEnd + commaMatch[0].length;
      insert = `\n        renderingIdentifier: ${JSON.stringify(id)},`;
    } else {
      // name: "…"  (no comma) → add comma then property
      insert = `,\n        renderingIdentifier: ${JSON.stringify(id)},`;
    }
    text = text.slice(0, insertAt) + insert + text.slice(insertAt);
  }
  return text;
}

/**
 * `DataItemTemplateDef` only allows `name` + `sections` — strip illegal
 * `displayName` on itemTemplate (folderTemplate.displayName is allowed).
 * @param {string} source
 */
export function stripItemTemplateDisplayName(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  let stripped = 0;
  // itemTemplate: { name: "...", displayName: "...", ... } → drop displayName
  text = text.replace(
    /(itemTemplate\s*:\s*\{\s*name\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2\s*,)\s*displayName\s*:\s*(["'])(?:\\.|(?!\3)[^\\])*\3\s*,?/g,
    (full, head) => {
      stripped += 1;
      return head;
    },
  );
  if (stripped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: stripped displayName from ${stripped} itemTemplate(s) (not in DataItemTemplateDef)`,
    );
  }
  return text;
}

/**
 * Ensure each content item has exactly one displayName (marketer label).
 * Prefer Title / Heading / Link.text from the **same** item; else spaced item name.
 * Also collapses duplicate displayName keys from prior buggy fixups.
 * @param {string} source
 */
export function ensureContentItemDisplayNames(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;

  const contentStart = contentMatch.index;
  const before = text.slice(0, contentStart);
  let contentPart = text.slice(contentStart);

  const pickLastDisplayName = (full) => {
    const matches = [
      ...full.matchAll(/displayName\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g),
    ];
    const raw = matches.length ? matches[matches.length - 1][2] : '';
    return toPlainDisplayName(raw.replace(/\\(.)/g, '$1'));
  };

  let collapsed = 0;

  // Collapse ", displayName: A, displayName: B" → one prop (requires leading commas)
  contentPart = contentPart.replace(
    /(?:\s*,\s*displayName\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1){2,}/g,
    (full) => {
      const n = (full.match(/displayName\s*:/g) || []).length;
      collapsed += Math.max(0, n - 1);
      return `, displayName: ${JSON.stringify(pickLastDisplayName(full))}`;
    },
  );

  // Collapse newline-first then more: "\n  displayName: A, displayName: B"
  contentPart = contentPart.replace(
    /(\n\s*)displayName\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2(?:\s*,\s*displayName\s*:\s*(["'])(?:\\.|(?!\3)[^\\])*\3)+/g,
    (full, indent) => {
      const n = (full.match(/displayName\s*:/g) || []).length;
      collapsed += Math.max(0, n - 1);
      return `${indent}displayName: ${JSON.stringify(pickLastDisplayName(full))},`;
    },
  );

  let added = 0;
  contentPart = contentPart.replace(
    /\{\s*name\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1(\s*,\s*)/g,
    (full, q, name, comma, offset, whole) => {
      const after = String(whole).slice(
        offset + full.length,
        offset + full.length + 160,
      );
      // Skip if displayName already present (allow stray commas/whitespace)
      if (/^[\s,]*displayName\s*:/.test(after)) return full;
      if (
        !/\bfields\s*:/.test(
          String(whole).slice(offset, offset + full.length + 400),
        )
      ) {
        return full;
      }
      added += 1;
      const spaced = toPlainDisplayName(
        String(name)
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[-_]+/g, ' ')
          .trim(),
      );
      return `{ name: ${q}${name}${q}${comma}displayName: ${JSON.stringify(spaced)}, `;
    },
  );

  // Prefer same-item Title / Heading / Link.text (never cross sibling items)
  contentPart = contentPart.replace(
    /(\{\s*name\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2\s*,\s*displayName\s*:\s*)(["'])(?:\\.|(?!\3)[^\\])*\3(\s*,\s*fields\s*:\s*\{)/g,
    (full, head, _qName, _qDn, fieldsOpen, offset, whole) => {
      const afterFields = String(whole).slice(offset + full.length);
      let depth = 1;
      let fieldsBody = '';
      for (let i = 0; i < afterFields.length && depth > 0; i += 1) {
        const ch = afterFields[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        if (depth > 0) fieldsBody += ch;
      }
      const titleRaw =
        fieldsBody.match(
          /\b(?:Title|Heading)\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/,
        )?.[2] ||
        fieldsBody.match(
          /\b(?:Link|CTA)\s*:\s*\{[\s\S]*?\btext\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/,
        )?.[2] ||
        '';
      const title = toPlainDisplayName(titleRaw.replace(/\\(.)/g, '$1'));
      if (!title || isUrlLikeTextValue(title)) return full;
      return `${head}${JSON.stringify(title)}${fieldsOpen}`;
    },
  );

  // Final safety pass for any remaining back-to-back displayNames
  contentPart = contentPart.replace(
    /(?:\s*,\s*displayName\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1){2,}/g,
    (full) => {
      const n = (full.match(/displayName\s*:/g) || []).length;
      collapsed += Math.max(0, n - 1);
      return `, displayName: ${JSON.stringify(pickLastDisplayName(full))}`;
    },
  );

  if (collapsed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: collapsed ${collapsed} duplicate displayName prop(s)`,
    );
  }
  if (added > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: ensured displayName on ${added} content item(s)`,
    );
  }
  return before + contentPart;
}

/**
 * Rewrite invalid JSX quote escapes in className / Tailwind arbitrary values.
 * JSX attributes are not JS strings — `\"` / `\'` break the parser.
 * Prefer `className="…"` with single quotes inside for values that need quoting
 * (`font-['Name']`, `font-['Name',sans-serif]`).
 *
 * Also flips `className='…font-[\'Name\']…'` → `className="…font-['Name']…"`.
 * Does not touch bare `fields["Title"]` / `props["x"]` (no backslash).
 * @param {string} source
 */
export function fixJsxClassNameEscapedQuotes(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;

  // Flip single-quoted className/class that contain backslash-escaped quotes.
  text = text.replace(
    /\b((?:className|class)\s*=\s*)'((?:\\.|[^'\\])*)'/g,
    (full, prefix, body) => {
      if (!/\\['"]/.test(body)) return full;
      // Unescape to single quotes — safe inside the new double-quoted attr.
      const inner = body.replace(/\\'/g, "'").replace(/\\"/g, "'");
      return `${prefix}"${inner}"`;
    },
  );

  // Remaining \" / \\\" → ' (e.g. font-[\"Name\",sans-serif] → font-['Name',sans-serif]).
  text = text.replace(/\\+"/g, "'");

  if (text !== before) {
    fixupWarn(
      "  ⚠ Codegen fixup: rewrote invalid escapes in className/Tailwind quotes (use className=\"…\" with font-['Name'])",
    );
  }
  return text;
}

/**
 * Post-write pass for map-entry `*.tsx`.
 * Normalizes fences via {@link normalizeAiSource}, applies safety-net strips
 * (e.g. {@link stripTextOnLinkField}),
 * and emits contract warnings via {@link warnTsxEmitContract}.
 * Does **not** rewrite `showLinkTextWithChildrenPresent` — AI must omit it; validators warn only.
 * Other mutating helpers remain exported for tests / optional tooling; emit rules live in
 * `prompts/system-codegen-sitecoreize.md`.
 *
 * @param {string} source
 * @param {{ layoutMode?: 'carousel'|'media-tabs'|'metric'|'columns'|'none'|'auto'|null }} [options]
 */
/**
 * Detect dark section / band backgrounds in TSX (navy, near-black, slate-900, …).
 * @param {string} source
 * @returns {boolean}
 */
export function hasDarkSurfaceTokens(source) {
  const s = String(source || '');
  if (
    /bg-\[#0[0-9a-fA-F]{5}\]/.test(s) ||
    /bg-\[#1[0-3][0-9a-fA-F]{4}\]/.test(s) ||
    /bg-(?:slate|gray|zinc|neutral|stone)-9(?:00|50)\b/.test(s) ||
    /bg-black\b/.test(s) ||
    /bg-navy\b/.test(s) ||
    /background(?:Color|):\s*['"]?#0[0-3][0-9a-fA-F]{4}/i.test(s) ||
    /#0[0-2][0-9a-fA-F]{4}/.test(s)
  ) {
    return true;
  }
  // Child bands (e.g. branding-social) often inherit dark parent bg but only set text-white.
  if (/\btext-white\b/.test(s) && /Icon|social|branding/i.test(s) && /<Image\b/.test(s)) {
    return true;
  }
  return false;
}

/**
 * Rewrite forbidden FaIcon prop aliases to `name=` (FaIcon only resolves `name`).
 * Forbidden: `faIcon`, `iconName`, `icon` (when used instead of `name`).
 * @param {string} source
 * @returns {string}
 */
export function rewriteFaIconPropAliases(source) {
  let text = String(source || '');
  if (!/<FaIcon\b/.test(text)) return text;
  let patched = 0;

  /** @param {string} attrs */
  const rewriteAttrs = (attrs) => {
    let a = attrs;
    const propValue =
      String.raw`(?:\{[^}]*\}|["'\`][^"'\`]*["'\`])`;
    const hasName = /\bname\s*=/.test(a);
    if (hasName) {
      const before = a;
      a = a.replace(
        new RegExp(String.raw`\s*\b(?:faIcon|iconName|icon)\s*=\s*${propValue}`, 'g'),
        '',
      );
      if (a !== before) patched += 1;
      return a;
    }
    if (/\bfaIcon\s*=/.test(a)) {
      a = a.replace(/\bfaIcon\s*=/, 'name=');
      patched += 1;
      a = a.replace(
        new RegExp(String.raw`\s*\b(?:iconName|icon)\s*=\s*${propValue}`, 'g'),
        '',
      );
      return a;
    }
    if (/\biconName\s*=/.test(a)) {
      a = a.replace(/\biconName\s*=/, 'name=');
      patched += 1;
      a = a.replace(
        new RegExp(String.raw`\s*\bicon\s*=\s*${propValue}`, 'g'),
        '',
      );
      return a;
    }
    if (/\bicon\s*=/.test(a)) {
      a = a.replace(/\bicon\s*=/, 'name=');
      patched += 1;
      return a;
    }
    return a;
  };

  text = text.replace(/(<FaIcon\b)([^>]*?)(\/>|>)/g, (full, open, attrs, close) => {
    const next = rewriteAttrs(attrs);
    return next === attrs ? full : `${open}${next}${close}`;
  });

  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: FaIcon prop aliases → name= (${patched} tag(s); forbid faIcon/iconName/icon)`,
    );
  }
  return text;
}

/**
 * On dark surfaces, ensure Image icon chrome inverts and FaIcon is white.
 * @param {string} source
 * @returns {string}
 */
export function ensureDarkSurfaceIconContrast(source) {
  let text = String(source || '');
  if (!text.trim() || !hasDarkSurfaceTokens(text)) return text;
  let patched = 0;

  text = text.replace(
    /(<Image\b)([^>]*?)(\/>|>)/g,
    (full, open, attrs, close) => {
      if (/brightness-0|invert/.test(attrs)) return full;
      // Only icon-sized chrome (social glyphs), not logos / hero / full-bleed media.
      const isIconSized =
        /\b(?:h|w)-[345678]\b/.test(attrs) ||
        /\b(?:h|w)-\[(?:1[6-9]|2\d|3[0-2])px\]/.test(attrs) ||
        (/\b(width|height)\s*=\s*\{?\s*(?:1[6-9]|2\d|3[0-2])\s*\}?/.test(attrs) &&
          /Icon|social/i.test(attrs + open));
      if (!isIconSized) return full;
      if (/\bclassName\s*=\s*(["'`])/.test(attrs)) {
        const next = attrs.replace(
          /\bclassName\s*=\s*(["'`])([^"'`]*)\1/,
          (m, q, cls) => {
            patched += 1;
            return `className=${q}${cls} brightness-0 invert${q}`;
          },
        );
        return `${open}${next}${close}`;
      }
      patched += 1;
      return `${open}${attrs} className="brightness-0 invert"${close}`;
    },
  );

  text = text.replace(
    /(<FaIcon\b)([^>]*?)(\/>|>)/g,
    (full, open, attrs, close) => {
      if (/text-white|text-\[#fff|brightness-0|invert/.test(attrs)) return full;
      if (/\bclassName\s*=\s*(["'`])/.test(attrs)) {
        const next = attrs.replace(
          /\bclassName\s*=\s*(["'`])([^"'`]*)\1/,
          (m, q, cls) => {
            patched += 1;
            return `className=${q}${cls} text-white${q}`;
          },
        );
        return `${open}${next}${close}`;
      }
      patched += 1;
      return `${open}${attrs} className="text-white"${close}`;
    },
  );

  if (patched > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: applied dark-surface icon contrast (${patched} Image/FaIcon)`,
    );
  }
  return text;
}

/**
 * Extract a JS expression for media-tab title from buried tab chrome inner JSX.
 * @param {string} inner
 * @returns {string}
 */
function extractStoryTitleExprFromInner(inner) {
  const src = String(inner || '');
  const fieldMatch = src.match(
    /field=\{(fields\.[A-Za-z_][\w]*|fields\[["'][^"']+["']\])\}/,
  );
  if (fieldMatch) {
    return `String(${fieldMatch[1]}?.value ?? '')`;
  }
  const plain = src.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (plain) return JSON.stringify(plain.slice(0, 200));
  return `''`;
}

/**
 * Media-tabs children must not bury desktop tab chrome
 * (`data-media-tab-tab` | `data-story-tab` + `hidden lg:flex`) inside each article —
 * parent client owns tablists. Promote title onto preferred/legacy title attr and remove
 * the buried tab UI. Leaves panel / logo / corner badge alone.
 * @param {string} source
 * @returns {string}
 */
export function stripMediaTabsBuriedChildTabChrome(source) {
  let text = String(source || '');
  const tabRe = mediaTabsAttrRe('tab');
  if (!tabRe.test(text)) return text;
  if (!/hidden\s+(?:lg:|md:)?(?:flex|block)/.test(text)) return text;

  /** @type {{ start: number, end: number }[]} */
  const removals = [];
  /** @type {string|null} */
  let titleExpr = null;

  const openTagRe = /<([A-Za-z][\w.]*)(\s[^>]*?)(\/?)>/g;
  let m;
  while ((m = openTagRe.exec(text)) !== null) {
    const tag = m[1];
    const attrs = m[2] || '';
    const selfClose = Boolean(m[3]);
    if (!tabRe.test(attrs)) continue;
    if (!/hidden\s+(?:lg:|md:)?(?:flex|block)/.test(attrs)) continue;

    const start = m.index;
    if (selfClose) {
      removals.push({ start, end: start + m[0].length });
      continue;
    }
    const afterOpen = start + m[0].length;
    const closeRe = new RegExp(
      `</${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*>`,
      'i',
    );
    const closeMatch = closeRe.exec(text.slice(afterOpen));
    if (!closeMatch) continue;
    const innerEnd = afterOpen + closeMatch.index;
    const end = innerEnd + closeMatch[0].length;
    const inner = text.slice(afterOpen, innerEnd);
    if (!titleExpr) titleExpr = extractStoryTitleExprFromInner(inner);
    removals.push({ start, end });
  }

  if (!removals.length) return text;

  for (let i = removals.length - 1; i >= 0; i--) {
    const { start, end } = removals[i];
    text = `${text.slice(0, start)}${text.slice(end)}`;
  }

  // Collapse leftover blank lines from removals (keep single newline)
  text = text.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n');

  const titleAssignRe = mediaTabsTitleAssignRe();
  if (titleExpr && !titleAssignRe.test(text)) {
    const titleAttr = preferredTitleAttrForSource(text);
    text = text.replace(mediaTabsItemOpenTagRe(), (full, tag, mid, rest) => {
      if (titleAssignRe.test(full)) return full;
      return `<${tag}${mid} ${titleAttr}={${titleExpr}}${rest}>`;
    });
  }

  return text;
}

export function normalizeComponentTsx(source, options = {}) {
  if (shouldSkipMutatingTsxFixups()) {
    if (shouldSkipAiSourceFixups()) logSkipAiSourceFixupsOnce();
    else logV2PromptFirstOnce();
    return normalizeAiSource(source);
  }
  let text = normalizeAiSource(source);
  if (!text.trim()) return text;
  text = fixGluedJsxTagAttributes(text);
  text = fixJsxClassNameEscapedQuotes(text);
  text = rewriteCheckboxFieldType(text);
  text = rewriteGetDatasourceImportPath(text);
  text = renameReservedSitecoreFieldNamesInTsx(text);
  // Narrow optional Link/Image call sites while `?:` is still on Fields, then strip `?:`.
  text = ensureNarrowedLinkFields(text);
  text = coerceLooseFieldValueStringAttrs(text);
  text = ensureRequiredFieldsProperties(text);
  text = ensureOptionalFieldValueAccess(text);
  // Safety net: <Text field={LinkField}> is invalid — strip under <Link>, else value.text.
  text = rewriteTextOnLinkField(text);
  // showLinkTextWithChildrenPresent: warn-only via emit contract — never rewrite after AI.
  text = ensureSuppressHydrationWarningOnLinks(text);
  text = ensureSuppressHydrationWarningOnVariantRoots(text);
  text = ensureSpacedFieldNamesInTsx(text);
  text = fixSpacedFieldAccess(text);
  text = quoteBareMultiWordFieldsKeys(text);
  text = stripDebugOutlineClasses(text);
  text = rewriteCompanionClientImport(text, options.kebab);
  text = remapOrphanChromeJsxToCompanionImport(text);
  if (options.clientTsx) {
    text = stripUnknownChromeProps(text, options.clientTsx);
  }
  text = warnSingleModeAppPlaceholder(text, options);
  text = dedupeAppPlaceholderByName(text);
  text = ensureMobileNavToggleAttrs(text);
  text = ensureCarouselChromeWrapsPlaceholder(text, options);
  {
    const mode = String(options.layoutMode || 'auto').toLowerCase() || 'auto';
    if (mode === 'media-tabs') {
      text = stripMediaTabsBuriedChildTabChrome(text);
    }
    if (mode === 'carousel') {
      text = unwrapNestedPlaceholderCarousel(text);
      text = unwrapNestedTrackInsideCarouselChrome(text);
    }
  }
  text = rewriteFaIconPropAliases(text);
  text = ensureDarkSurfaceIconContrast(text);
  warnClientJsxArrayProps(text);
  warnConditionalFieldGuards(text);
  warnAccordionHiddenWithoutEditing(text);
  warnClientPlaceholderWithoutMap(text);
  warnLooseFieldValueStringAttrs(text);
  warnTsxEmitContract(text, options);
  return text;
}

/**
 * Normalize PascalCase compound Fields keys to spaced Title Case + quoted access.
 * e.g. `IntroHeadline: TextField` → `"Intro Headline": TextField`
 * @param {string} source
 */
export function ensureSpacedFieldNamesInTsx(source) {
  let text = String(source || '');
  if (!/\binterface\s+Fields\b/.test(text) && !/\btype\s+Fields\b/.test(text)) {
    return text;
  }
  const before = text;
  // Interface / type property: IntroHeadline: TextField → "Intro Headline": TextField
  text = text.replace(
    /(\n\s*)([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]+)+)(\s*[?]?\s*:\s*(?:TextField|RichTextField|ImageField|LinkField|Field)\b)/g,
    (full, indent, name, rest) => {
      const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
      if (spaced === name) return full;
      return `${indent}"${spaced}"${rest}`;
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: normalized PascalCase Fields keys to spaced Title Case',
    );
  }
  return text;
}

/**
 * When layoutMode=carousel and AppPlaceholder is not passed into client chrome, warn + soft wrap.
 * @param {string} source
 * @param {{ layoutMode?: string|null }} [options]
 */
export function ensureCarouselChromeWrapsPlaceholder(source, options = {}) {
  let text = String(source || '');
  if (String(options.layoutMode || '').toLowerCase() !== 'carousel') return text;
  if (!/<AppPlaceholder\b/.test(text)) return text;
  // Already wrapped: <SomeChrome …>{…AppPlaceholder…}</SomeChrome> or children={…}
  if (
    /<[A-Za-z][\w]*Chrome\b[\s\S]{0,800}<AppPlaceholder\b/.test(text) ||
    /from\s+['"]\.\/[^'"]+\.client['"]/.test(text) &&
      /<[A-Za-z][\w]*\b[^>]*>[\s\S]{0,400}<AppPlaceholder\b/.test(text)
  ) {
    return text;
  }
  fixupWarn(
    '  ⚠ TSX emit: carousel AppPlaceholder is not wrapped in client chrome — emit *.client.tsx and pass AppPlaceholder as children when the crop has arrows/dots',
  );
  return text;
}

/**
 * Soft checks for rules that used to be silent TSX rewrites — AI must emit these correctly.
 * @param {string} source
 */
const ALLOWED_TSX_PREAMBLE =
  /^(?:\s*['"]use client['"];?\s*)?(?:import\s|export\s|interface\s|type\s|const\s|function\s)/;

/**
 * True when a carousel AppPlaceholder already has a horizontal track:
 * snap-x / overflow-x in the server file, or PH under imported *.client chrome
 * (tag may be `Chrome`, `FooChrome`, etc. — not only *Chrome names).
 *
 * @param {string} source server map-entry TSX
 * @param {string|null|undefined} [clientTsx]
 * @returns {boolean} true = OK (no CONTRACT); false = missing track
 */
export function carouselAppPlaceholderHasTrack(source, clientTsx) {
  const text = String(source || '');
  if (!/\bAppPlaceholder\b/.test(text)) return true;
  if (/\bsnap-x\b/.test(text) || /\boverflow-x-(?:auto|scroll)\b/.test(text)) {
    return true;
  }

  const client = String(clientTsx || '');
  const clientHasTrack =
    Boolean(client.trim()) &&
    (/\bsnap-x\b/.test(client) ||
      /\boverflow-x-(?:auto|scroll)\b/.test(client));

  const re = /<AppPlaceholder\b[\s\S]*?\/>/g;
  let m;
  let allUnderClientChrome = true;
  let sawPh = false;
  while ((m = re.exec(text))) {
    sawPh = true;
    const parent = findImmediateParentOpenTag(text, m.index);
    const tag = String(parent?.tag || '');
    const underChrome =
      isCustomChromeJsxTag(tag) &&
      (parentIsImportedClientChrome(text, tag) ||
        /from\s+['"]\.\/[^'"]+\.client['"]/.test(text));
    if (!underChrome) {
      allUnderClientChrome = false;
      break;
    }
  }
  if (!sawPh) return true;
  // PH inside *.client chrome owns the track (snap-x may live only in clientTsx).
  if (allUnderClientChrome) return true;
  // Belt when caller passes clientTsx with a track and chrome wraps PH.
  if (clientHasTrack && allUnderClientChrome) return true;
  return false;
}

/**
 * True when source reads `props.page` (or AppPlaceholder page=) but props typing
 * is bare ComponentProps without ComponentWithContextProps (TS2339).
 * @param {string} source
 * @returns {boolean}
 */
export function usesPropsPageWithoutContextProps(source) {
  const text = String(source || '');
  if (!text.trim()) return false;
  if (/\bComponentWithContextProps\b/.test(text)) return false;
  const usesPage =
    /\bprops\.page\b/.test(text) ||
    /\bpage=\{props\.page\}/.test(text) ||
    /Boolean\(\s*props\.page/.test(text);
  if (!usesPage) return false;
  // Props alias intersects ComponentProps (value or type import) without WithContext
  return (
    /\bComponentProps\b/.test(text) ||
    /type\s+\w+\s*=\s*ComponentProps\s*&/.test(text)
  );
}

/**
 * @param {string} source
 * @returns {boolean}
 */
export function hasValidTsxPreamble(source) {
  const text = String(source || '').trimStart();
  if (!text) return true;
  return ALLOWED_TSX_PREAMBLE.test(text);
}

/**
 * True when a Tailwind className string contains an exact token (not a substring).
 * `no-underline` must not match token `underline`.
 * @param {string} classStr
 * @param {string} token
 * @returns {boolean}
 */
export function classNameHasExactToken(classStr, token) {
  const want = String(token || '').trim();
  if (!want) return false;
  for (const raw of String(classStr || '').split(/\s+/)) {
    const t = raw.trim();
    if (!t) continue;
    // Responsive / state variants: md:underline, hover:no-underline
    const base = t.includes(':') ? t.slice(t.lastIndexOf(':') + 1) : t;
    if (base === want) return true;
  }
  return false;
}

/**
 * Extract className string from a JSX opening-tag attribute blob.
 * @param {string} attrs
 * @returns {string}
 */
function extractClassNameFromAttrs(attrs) {
  const m = String(attrs || '').match(
    /className\s*=\s*(?:\{\s*`([^`]*)`\s*\}|"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/,
  );
  return m?.[1] ?? m?.[2] ?? m?.[3] ?? m?.[4] ?? m?.[5] ?? '';
}

/**
 * Link with exact `underline` token whose body contains a descendant with exact `no-underline`.
 * Card-shell Links with only `no-underline` do not match.
 * @param {string} text
 * @returns {boolean}
 */
export function hasLinkUnderlineWithChildNoUnderline(text) {
  const src = String(text || '');
  const linkOpenRe = /<Link\b([^>]*)>/gi;
  let m;
  while ((m = linkOpenRe.exec(src))) {
    const attrs = m[1] || '';
    if (/\/>\s*$/.test(attrs)) continue; // self-closing in attrs (unusual)
    const classStr = extractClassNameFromAttrs(attrs);
    if (!classNameHasExactToken(classStr, 'underline')) continue;
    const start = m.index + m[0].length;
    const close = src.indexOf('</Link>', start);
    if (close < 0) continue;
    const body = src.slice(start, close);
    // Any descendant className with exact no-underline
    const childClassRe =
      /className\s*=\s*(?:\{\s*`([^`]*)`\s*\}|"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;
    let cm;
    while ((cm = childClassRe.exec(body))) {
      const childCn = cm[1] ?? cm[2] ?? cm[3] ?? cm[4] ?? cm[5] ?? '';
      if (classNameHasExactToken(childCn, 'no-underline')) return true;
    }
  }
  return false;
}

/**
 * Detect-only TSX emit contract checks (no rewrite). Prefixed `CONTRACT: ` for AI validate loop.
 * @param {string} source
 * @param {{ layoutMode?: string, clientTsx?: string|null, sectionInfo?: object|null, definitionTs?: string|null, equalHeightChildren?: boolean }} [options]
 * @returns {string[]}
 */
export function collectTsxEmitContractDiagnostics(source, options = {}) {
  const text = String(source || '');
  /** @type {string[]} */
  const out = [];
  if (!text.trim()) return out;
  const push = (msg) => out.push(`CONTRACT: ${msg}`);

  if (!hasValidTsxPreamble(text)) {
    const head = text.trimStart().slice(0, 48).replace(/\s+/g, ' ');
    push(
      `invalid file preamble (must start with 'use client', import, export, interface, type, const, or function) — got: "${head}…"`,
    );
  }
  if (
    String(options.layoutMode || '').toLowerCase() === 'carousel' &&
    /\bAppPlaceholder\b/.test(text) &&
    !carouselAppPlaceholderHasTrack(text, options.clientTsx)
  ) {
    push(
      'layoutMode=carousel but AppPlaceholder has no snap-x / overflow-x track — placeholder children will stack vertically',
    );
  }
  // Peer-card / card-carousel only — not logo-marquee / ContinuousMarquee / header
  // rails (items-center + fixed heights, not stretch fill). Prefer layoutWants…
  // so capture false-positive equalHeightChildren flags are ignored.
  const equalHeight =
    typeof options.sectionInfo === 'object' && options.sectionInfo
      ? layoutWantsEqualHeightChildren(options.sectionInfo)
      : options.equalHeightChildren === true;
  if (equalHeight && /\bAppPlaceholder\b/.test(text)) {
    const parentBlob = `${text}\n${String(options.clientTsx || '')}`;
    const hasStretch = /\bitems-stretch\b/.test(parentBlob);
    const hasFill =
      /\[&>\*\]:h-full|\bself-stretch\b/.test(parentBlob) ||
      /grid[\s\S]{0,160}items-stretch/.test(parentBlob);
    if (!hasStretch || !hasFill) {
      push(
        'equal-height peer cards require parent track items-stretch AND [&>*]:h-full (or stretch grid) around AppPlaceholder — both required',
      );
    }
  }

  // classList.toggle/add/remove must receive a single token (no spaces) — DOMException otherwise.
  const classListMultiToken =
    /\.classList\.(toggle|add|remove|contains|replace)\(\s*(['"`])([^'"`]*\s[^'"`]*)\2/;
  const classListMatch = classListMultiToken.exec(text);
  if (classListMatch) {
    const token = classListMatch[3].slice(0, 80);
    push(
      `classList.${classListMatch[1]} must use one CSS token (no spaces) — got "${token}${classListMatch[3].length > 80 ? '…' : ''}"`,
    );
  }

  // Broken CTA arrow: sized after:bg box without mask utility paints a solid square.
  const hasSizedAfterBox =
    (/after:h-\[22px\]/.test(text) && /after:w-\[22px\]/.test(text)) ||
    /after:size-\[22px\]/.test(text);
  const hasAfterBg = /after:bg-/.test(text);
  const hasContentArrow =
    /after:content-\['→'\]|after:content-\["→"\]/.test(text);
  const hasScCtaArrow = /\bsc-cta-after-arrow\b/.test(text);
  const hasMaskImage =
    /mask-image:|\[mask-image:|\[-webkit-mask-image:/.test(text);
  if (hasSizedAfterBox && hasAfterBg && hasContentArrow) {
    push(
      "CTA ::after arrows: do not combine after:h-[22px] after:w-[22px] after:bg-* with after:content-['→'] (solid square) — use sc-cta-after-arrow or text-only after:content-['→']",
    );
  } else if (
    hasSizedAfterBox &&
    hasAfterBg &&
    !hasScCtaArrow &&
    !hasMaskImage
  ) {
    push(
      'CTA ::after arrows: sized after:h/w-[22px] + after:bg-* without sc-cta-after-arrow (or mask-image) paints a solid square — use sc-cta-after-arrow + after:bg-* only, or text-only after:content-[\'→\'] with no fixed h/w+bg',
    );
  }
  if (
    /\bgetDatasource\s*[<(]/.test(text) &&
    /children\s*\?\.\s*results|children\.results/.test(text)
  ) {
    const def = String(options.definitionTs || '');
    const hasChildTpl = /\bchildItemTemplate\s*:/.test(def);
    const isLinkList =
      /Link Lists|Icon Link Lists|Image Link Lists/.test(def) ||
      /folder\s*:\s*\[[^\]]*(?:Link Lists|Icon Link Lists|Image Link Lists)/.test(
        def,
      );
    const isCompositeLinkListParent =
      isLinkListAsCompositeEnabled() &&
      /placeholders\s*:\s*\[[\s\S]*allowedControls\s*:/.test(def);
    if (
      def.trim() &&
      !hasChildTpl &&
      !isLinkList &&
      !isCompositeLinkListParent
    ) {
      push(
        'TSX reads getDatasource + children.results but definition has neither childItemTemplate nor Link List folder — emit will not inject ComponentQuery',
      );
    }
  }
  if (
    String(options.layoutMode || '').toLowerCase() === 'media-tabs' &&
    /\bAppPlaceholder\b/.test(text)
  ) {
    if (/\bsnap-x\b/.test(text) || /\[&>\*\]:w-\[min\(90%,350px\)\]/.test(text)) {
      push(
        'layoutMode=media-tabs must NOT use snap-x card carousel — use client chrome with text tabs + one media panel',
      );
    }
    if (
      !/\.client['"]/.test(text) &&
      !/\bChrome\b/.test(text) &&
      !/data-media-tab-title|data-media-tab-desktop-nav|data-story-title|data-story-selector|role=["']tablist["']|data-story-desktop-navigation/.test(
        text,
      )
    ) {
      push(
        'layoutMode=media-tabs needs client chrome that owns tablists + child data-media-tab-panel/title/logo (legacy data-story-* OK) — bare AppPlaceholder stacks PH children',
      );
    }
  }
  if (
    /\bsnap-x\b/.test(text) &&
    /\bmd:grid\b/.test(text) &&
    !/\blg:grid\b/.test(text)
  ) {
    push(
      'carousel wraps to grid at md: — use lg:grid (≥1024) so tablet keeps the slider',
    );
  }
  if (/\bmd:grid-cols-[2-9]\b/.test(text) && !/\blg:grid-cols-/.test(text)) {
    push(
      'multi-column grid at md: without lg: — desktop composition must unlock at lg: (≥1024)',
    );
  }
  // Sticky chrome API — detect-only (AI must emit correct call shape).
  if (
    /useStickyChromeInset\s*\(\s*['"](?:top|bottom)['"]\s*,\s*\{/.test(text)
  ) {
    push(
      'useStickyChromeInset(edge, fallbackInsetPx?: number) — second arg is a number, not an options object (e.g. useStickyChromeInset(\'top\', 64))',
    );
  }
  if (
    /\buseStickyChrome(?:Inset|Layer)\b/.test(text) &&
    /\bfallbackPx\b/.test(text)
  ) {
    push(
      'sticky chrome option key is fallbackInsetPx (never fallbackPx) — useStickyChromeInset(edge, n) or useStickyChromeLayer({ edge, fallbackInsetPx: n })',
    );
  }
  if (/showLinkTextWithChildrenPresent/.test(text)) {
    push(
      'never emit showLinkTextWithChildrenPresent on any <Link> (bare / ={true} / ={false}, including mid-tag `/ showLinkText…>`) — childless Links paint field text; Links with children use children as the sole visible UI',
    );
  }
  {
    const faIconTagRe = /<FaIcon\b([^>]*?)(?:\/>|>)/g;
    let faMatch;
    while ((faMatch = faIconTagRe.exec(text))) {
      const attrs = faMatch[1] || '';
      if (/\b(?:faIcon|iconName)\s*=/.test(attrs)) {
        push(
          'FaIcon must use name= + optional faStyle (forbidden props: faIcon, iconName, icon) — without name the glyph renders nothing',
        );
        break;
      }
      if (/\bicon\s*=/.test(attrs) && !/\bname\s*=/.test(attrs)) {
        push(
          'FaIcon must use name= + optional faStyle (forbidden props: faIcon, iconName, icon) — without name the glyph renders nothing',
        );
        break;
      }
      if (!/\bname\s*=/.test(attrs)) {
        push(
          'FaIcon requires name= prop (optional faStyle/className) — FaIcon only resolves name; missing name paints nothing',
        );
        break;
      }
    }
  }
  for (const name of collectRichTextFieldsRenderedAsText(text, options.definitionTs)) {
    push(
      `definition Rich Text field "${name}" must use <RichText field={…} /> — never <Text> (HTML seeds cause hydration mismatches)`,
    );
  }
  if (
    /<Link\b[^>]*\bunderline\b(?!\s*=)/.test(text) &&
    !/<Link\b[^>]*className=/.test(text)
  ) {
    push(
      'boolean underline on Link is invalid — use className="… underline …"',
    );
  }
  if (usesPropsPageWithoutContextProps(text)) {
    push(
      'props.page requires ComponentWithContextProps — type Props = ComponentWithContextProps & { fields: Fields }; never bare ComponentProps',
    );
  }
  if (/\bCheckboxField\b/.test(text)) {
    push(
      'CheckboxField is not an SDK type — use Field<boolean> (import type { Field }) for Checkbox fields',
    );
  }
  {
    // Brace-aware: non-greedy `\{([\s\S]*?)\}` stops at nested `{ value?: string }`.
    const declared = new Set();
    for (const body of extractFieldsTypeBodies(text)) {
      for (const m of body.matchAll(
        /(?:["']([^"']+)["']|([A-Za-z_][A-Za-z0-9_]*))\s*:/g,
      )) {
        declared.add(m[1] || m[2]);
      }
    }
    if (declared.size) {
      const missing = [];
      for (const m of text.matchAll(/\bfields\s*\[\s*["']([^"']+)["']\s*\]/g)) {
        if (!declared.has(m[1]) && !missing.includes(m[1])) missing.push(m[1]);
      }
      if (missing.length) {
        push(
          `fields[${missing.map((k) => `"${k}"`).join(', ')}] not on Fields interface — declare on Fields + model (do not invent orphan keys)`,
        );
      }
    }
  }
  if (
    /\bgetDatasource\s*[<(]/.test(text) &&
    /fields\s*:\s*[^=;{]*Fields\b/.test(text) &&
    /\|\s*[A-Za-z0-9_]*Fields\b|\b[A-Za-z0-9_]*Fields\s*\|/.test(text)
  ) {
    push(
      'getDatasource fields union includes flat *Fields — type fields as GraphQL datasource only',
    );
  }
  if (/\bprops\.id\b/.test(text)) {
    push(
      'props.id is invalid on ComponentProps — use params.RenderingIdentifier || params.id (after const params = props.params ?? …)',
    );
  }
  if (hasLinkUnderlineWithChildNoUnderline(text)) {
    push(
      'Link className has underline AND a child has no-underline — remove no-underline from the arrow/child (continuous underline is default) OR remove underline from Link if the crop has no stroke under the arrow. Card-shell Links with only no-underline are OK',
    );
  }
  if (/<Link\b/.test(text) && /\{[^}]*\.value\?\.text\}/.test(text)) {
    push(
      'Link duplicates label — with React children, visible copy comes from children only (never {fields.*.value?.text}; never emit showLinkTextWithChildrenPresent)',
    );
  }
  if (
    /<li\b(?![^>]*\blist-none\b)[^>]*>/.test(text) &&
    !/<ul\b[^>]*\blist-none\b/.test(text)
  ) {
    push(
      '<li> without list-none — screenshots without bullets need list-none or div roots under flex/grid',
    );
  }
  if (/\bsnap-x\b/.test(text) && (/footer/i.test(text) || /Footer/.test(text))) {
    push(
      'snap-x carousel on a footer component — use flex-col lg:flex-row for footer columns (carousel hides links)',
    );
  }
  if (
    /(?<!=)\{(?:props\.)?fields(?:\.\w+|\["[^"]+"\]|\['[^']+'\])\}/.test(
      text,
    )
  ) {
    push(
      'do not interpolate Field objects as JSX children ({fields.X}) — use <Text field={…} />, <RichText>, <Image>, or <Link>',
    );
  }
  const usesFlatFieldsAccess =
    /\bfields\s*\./.test(text) ||
    /\bfields\s*\[/.test(text) ||
    /field=\{fields\b/.test(text);
  const hasFieldsBind =
    /\bconst\s*\{\s*fields\b/.test(text) ||
    /\(\s*\{\s*[^)]*\bfields\b/.test(text) ||
    /\bprops\.fields\b/.test(text) ||
    /\bgetDatasource\s*[<(]/.test(text);
  if (usesFlatFieldsAccess && !hasFieldsBind) {
    push(
      'uses fields.* / fields["…"] without binding — add `const { fields } = props;` (or props.fields / getDatasource)',
    );
  }
  if (/<\s*script\b/i.test(text) || /<\s*\/\s*script\s*>/i.test(text)) {
    push(
      '<script> in component TSX — forbidden; use Content SDK fields + Tailwind only (no analytics/GTM/JSON-LD)',
    );
  }
  if (
    /\bnext\/script\b/.test(text) ||
    /from\s*['"]next\/script['"]/.test(text)
  ) {
    push(
      'next/script in section component — forbidden; do not load third-party scripts from codegen',
    );
  }
  if (/\bdangerouslySetInnerHTML\b/.test(text)) {
    push(
      'dangerouslySetInnerHTML — forbidden; use RichText/Text/Image/Link field components',
    );
  }
  if (
    /(?<!=)\{\s*fields(?:\.[A-Za-z_][\w]*|\[\s*["'][^"']+["']\s*\])\s*\}/.test(
      text,
    )
  ) {
    push(
      'bare {fields.…} as JSX children — use <Text|Image|Link|RichText field={fields.…} />; never render field objects or metadata',
    );
  }
  if (
    /\bJSON\.stringify\s*\(\s*fields\b/.test(text) ||
    /\bJSON\.stringify\s*\(\s*props\.fields\b/.test(text)
  ) {
    push(
      'JSON.stringify(fields) — never dump field/metadata objects into the DOM',
    );
  }
  for (const d of detectCompanionClientPropsSpread(text)) {
    out.push(d);
  }
  return out;
}

/**
 * Detect `<Chrome {...props} />` into a companion `.client` import.
 * Spreading map-entry props passes `componentMap` ({ Default: fn }) into a Client
 * Component and crashes RSC (`Functions cannot be passed directly to Client Components`).
 * @param {string} source
 * @returns {string[]}
 */
export function detectCompanionClientPropsSpread(source) {
  const text = String(source || '');
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return [];
  const spreadRe = new RegExp(
    `<${alias}\\b[^>]*\\{\\.\\.\\.props\\}`,
  );
  if (!spreadRe.test(text)) return [];
  return [
    `CONTRACT: do not spread {...props} into <${alias}> (.client companion) — that passes componentMap functions across the React Server Components (RSC) boundary; pass fields={props.fields} (and serializable props / ReactNode children) only`,
  ];
}

/**
 * Strip `{...props}` from companion chrome tags (RSC boundary) and keep fields=.
 * @param {string} source
 * @returns {string}
 */
export function rewriteCompanionPropsSpread(source) {
  let text = String(source || '');
  if (!text.trim() || !/\{\.\.\.props\}/.test(text)) return text;
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return text;
  const before = text;
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(
    new RegExp(`(<${esc}\\b[^>]*?)\\s*\\{\\.\\.\\.props\\}`, 'g'),
    '$1',
  );
  if (text !== before) {
    fixupWarn(
      `  ⚠ Codegen fixup: stripped {...props} from <${alias}> (pass fields only)`,
    );
  }
  return text;
}

export function warnTsxEmitContract(source, options = {}) {
  // Validation-only — do not noteFixup (no source rewrite).
  for (const d of collectTsxEmitContractDiagnostics(source, options)) {
    const body = d.replace(/^CONTRACT:\s*/, '');
    warnVerbose(`  ⚠ TSX emit: ${body}`);
  }
}

/**
 * Detect orphan `*Chrome` JSX tags that are not the companion import alias (no rewrite).
 * @param {string} source
 * @returns {string[]}
 */
export function detectOrphanChromeJsx(source) {
  const text = String(source || '');
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return [];
  /** @type {string[]} */
  const orphans = [];
  const chromeTags = new Set();
  const tagRe = /<\/?([A-Za-z][\w]*Chrome)\b/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    chromeTags.add(m[1]);
  }
  for (const tag of chromeTags) {
    if (tag === alias) continue;
    if (isIdentifierDeclaredInSource(text, tag)) continue;
    orphans.push(tag);
  }
  if (!orphans.length) return [];
  return [
    `CONTRACT: orphan Chrome JSX tag(s) ${orphans.join(', ')} — use imported companion alias <${alias}> (from ./${alias}…client)`,
  ];
}

/**
 * Detect duplicate `'use client'` directives (no rewrite).
 * @param {string} source
 * @returns {string[]}
 */
export function detectDuplicateUseClient(source) {
  const text = String(source || '');
  const matches = text.match(/^[ \t]*['"]use client['"];?[ \t]*\r?\n/gm);
  if (!matches || matches.length <= 1) return [];
  return [
    `CONTRACT: duplicate 'use client' directive (${matches.length}×) — keep a single leading directive`,
  ];
}

/**
 * Detect unknown props on imported Chrome vs companion (no rewrite).
 * @param {string} tsx
 * @param {string|null|undefined} clientTsx
 * @returns {string[]}
 */
export function detectUnknownChromeProps(tsx, clientTsx) {
  const text = String(tsx || '');
  const alias = parseCompanionClientImportAlias(text);
  if (!alias || !String(clientTsx || '').trim()) return [];
  const allowed = collectClientChromePropNames(clientTsx);
  const openRe = new RegExp(
    `<${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'g',
  );
  /** @type {string[]} */
  const unknown = [];
  let match;
  while ((match = openRe.exec(text)) !== null) {
    const parsed = parseJsxOpeningTag(text, match.index);
    if (!parsed) continue;
    const { stripped } = filterJsxAttributeString(parsed.attrs, allowed);
    for (const name of stripped) {
      if (!unknown.includes(name)) unknown.push(name);
    }
  }
  if (!unknown.length) return [];
  return [
    `CONTRACT: unknown Chrome prop(s) on <${alias}> (not declared on companion): ${unknown.join(', ')}`,
  ];
}

/**
 * Formerly remapped `xl:` → `lg:`. With five viewport crops, breakpoints follow
 * section HTML / screenshots — leave `xl:` / `2xl:` intact (no rewrite).
 * @param {string} source
 */
export function normalizeDesktopBreakpointPrefixes(source) {
  return String(source || '');
}

/**
 * Remap structural **desktop** layout tokens from `md:` → `lg:` so composition
 * from the desktop crop applies at ≥1024 (not at tablet 768).
 *
 * Targets: multi-column grids, flex-row strips, carousel wrap-at-desktop,
 * hide-arrows-on-desktop. Does not touch unrelated `md:` typography alone.
 *
 * Used for one-time migrations / optional tooling; prompts remain the primary
 * emit contract (pipeline does not rewrite AI TSX by default).
 *
 * @param {string} source
 */
export function normalizeDesktopLayoutToLg(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;

  // Carousel → desktop grid wrap (md:grid … md:hidden arrows)
  const looksLikeCarouselWrap =
    /\bsnap-x\b/.test(text) &&
    (/\bmd:grid\b/.test(text) || /\bmd:grid-cols-/.test(text)) &&
    /\bmd:hidden\b/.test(text);

  if (looksLikeCarouselWrap) {
    text = text
      .replace(/\bmd:grid\b/g, 'lg:grid')
      .replace(/\bmd:grid-cols-(\d+)\b/g, 'lg:grid-cols-$1')
      .replace(/\bmd:gap-\[([^\]]+)\]/g, 'lg:gap-[$1]')
      .replace(/\bmd:gap-(\d+)\b/g, 'lg:gap-$1')
      .replace(/\bmd:overflow-visible\b/g, 'lg:overflow-visible')
      .replace(/\bmd:pb-0\b/g, 'lg:pb-0')
      .replace(/\bmd:\[\&\>\*\]:w-auto\b/g, 'lg:[&>*]:w-auto')
      .replace(/\bmd:\[\&\>\*\]:shrink\b/g, 'lg:[&>*]:shrink')
      .replace(/\bmd:\[\&\>\*\]:snap-none\b/g, 'lg:[&>*]:snap-none')
      .replace(/\bmd:hidden\b/g, 'lg:hidden');
  }

  // Side-by-side / multi-column desktop composition incorrectly gated at md:
  text = text
    .replace(/\bmd:grid-cols-([2-9]|\d{2,})\b/g, 'lg:grid-cols-$1')
    .replace(/\bmd:flex-row\b/g, 'lg:flex-row')
    .replace(/\bmd:flex-nowrap\b/g, 'lg:flex-nowrap')
    .replace(/\bmd:w-1\/2\b/g, 'lg:w-1/2')
    .replace(/\bmd:w-1\/3\b/g, 'lg:w-1/3')
    .replace(/\bmd:col-span-([2-9])\b/g, 'lg:col-span-$1')
    .replace(/\bmd:col-start-([2-9])\b/g, 'lg:col-start-$1');

  // Deduplicate accidental lg:lg: after double remap
  text = text.replace(/\blg:lg:/g, 'lg:');

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: desktop layout tokens md: → lg: (desktop composition at ≥1024)',
    );
  }
  return text;
}

/**
 * Accordion / footer social chrome that expands or un-hides at `md:` (768)
 * shows desktop columns on Sitecore tablet (≤1023). Remap to `lg:` / `max-lg:`
 * so tablet crops that show accordion stay accordion.
 * @param {string} source
 */
export function normalizeAccordionViewportBreakpoints(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const looksLikeAccordionChrome =
    /aria-expanded/.test(text) &&
    (/rotate-180|rotate-45|⌄|chevron|angle-down|accordion|setExpanded|setOpen/i.test(
      text,
    ) ||
      /FooterColumn|FooterLinkGroup|footer-link|footer__menu/i.test(text) ||
      /\bmd:(?:hidden|block|pointer-events-none)\b/.test(text));

  const looksLikeFooterSocial =
    /footer__menu--icons|FooterSocial|footer-social|variant\s*=\s*\{?["']icons["']/i.test(
      text,
    ) ||
    (/max-md:(?:hidden|flex|justify-center|border-t)/.test(text) &&
      /facebook|instagram|SocialFaGlyph|social/i.test(text));

  if (!looksLikeAccordionChrome && !looksLikeFooterSocial) return text;

  const before = text;
  if (looksLikeAccordionChrome) {
    text = text
      .replace(/\bmd:hidden\b/g, 'lg:hidden')
      .replace(/\bmd:block\b/g, 'lg:block')
      .replace(/\bmd:flex\b/g, 'lg:flex')
      .replace(/\bmd:pointer-events-none\b/g, 'lg:pointer-events-none')
      .replace(/\bmd:min-h-0\b/g, 'lg:min-h-0')
      .replace(/\bmd:mb-6\b/g, 'lg:mb-6')
      .replace(/\bmd:pb-0\b/g, 'lg:pb-0')
      .replace(/\bmd:border-0\b/g, 'lg:border-0')
      .replace(/\bmd:px-0\b/g, 'lg:px-0')
      .replace(/\bmd:px-\[15px\]\b/g, 'lg:px-[15px]')
      .replace(/\bmd:flex-none\b/g, 'lg:flex-none')
      .replace(/\bmd:justify-start\b/g, 'lg:justify-start')
      .replace(/\bmd:py-0\b/g, 'lg:py-0')
      .replace(/\bmd:mr-4\b/g, 'lg:mr-4')
      .replace(/\bmd:p-0\b/g, 'lg:p-0')
      .replace(/\bmax-md:/g, 'max-lg:');
  }
  if (looksLikeFooterSocial) {
    text = text.replace(/\bmax-md:/g, 'max-lg:');
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: accordion/footer social breakpoints → lg:/max-lg: (tablet ≤1023 stays accordion)',
    );
  }
  return text;
}

/**
 * Carousel card roots should not be full-bleed (`w-full`) — capture cards are
 * typically `min(90%, 350px)`. Rewrite common full-width card roots when they
 * also declare a desktop card width.
 * @param {string} source
 */
export function normalizeCarouselCardWidths(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  let fixed = 0;
  text = text.replace(
    /(<article\b[^>]*\bclassName=(["'`]))([^"'`]*\bw-full\b[^"'`]*)(\2)/g,
    (full, open, q, classes) => {
      const carouselSized =
        /\b(lg:w-\[350px\]|w-\[350px\]|md:w-\[calc\(50%)/.test(classes) ||
        /\bw-\[min\(90%,350px\)\]/.test(classes);
      if (!carouselSized) return full;
      fixed += 1;
      let next = classes
        .replace(/\bw-full\b/g, '')
        .replace(/\bmin-w-0\b/g, '')
        .replace(/\bmd:w-\[calc\([^\]\)]+\)\]/g, '')
        .replace(/\blg:w-\[350px\]\b/g, '')
        .replace(/\bw-\[350px\]\b/g, '')
        .replace(/\blg:flex-none\b/g, '')
        .replace(/\bmd:flex-none\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!/\bw-\[min\(90%,350px\)\]/.test(next)) {
        next = `w-[min(90%,350px)] shrink-0 ${next}`.trim();
      }
      if (!/\bshrink-0\b/.test(next)) next = `${next} shrink-0`.trim();
      return `${open}${next}${q}`;
    },
  );

  if (fixed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: normalized ${fixed} carousel card width(s) to w-[min(90%,350px)]`,
    );
  }
  return text;
}

/**
 * LinkField names from local `Fields` (plus common CTA/Link defaults).
 * @param {string} source
 * @returns {Set<string>}
 */
function collectLinkFieldNamesForTextRewrite(source) {
  const linkNames = new Set(['CTA', 'Link']);
  const fieldsBlock = String(source || '').match(
    /\b(?:interface|type)\s+Fields\s*=?\s*\{([\s\S]*?)\}/,
  );
  if (fieldsBlock?.[1]) {
    for (const m of fieldsBlock[1].matchAll(
      /(?:(\w+)|["']([^"']+)["'])\s*:\s*LinkField\b/g,
    )) {
      linkNames.add(m[1] || m[2]);
    }
  }
  return linkNames;
}

/**
 * True when `index` sits inside an open `<Link field={same}>…` that has not closed.
 * @param {string} text
 * @param {number} index
 * @param {string} fieldAccessReSource — regex source for fields.CTA / fields["…"]
 */
function isTextOnLinkFieldNestedUnderMatchingLink(text, index, fieldAccessReSource) {
  const before = text.slice(0, index);
  const openRe = new RegExp(
    `<Link\\b[^>]*\\bfield=\\{${fieldAccessReSource}\\}[^>]*>`,
    'gi',
  );
  let lastOpen = -1;
  let m;
  while ((m = openRe.exec(before))) {
    lastOpen = m.index + m[0].length;
  }
  if (lastOpen < 0) return false;
  const between = before.slice(lastOpen);
  return !/<\/Link\b/.test(between);
}

/**
 * Always-on / prompt-first-safe: `<Text field={LinkField} />` is invalid (TS2322).
 * - Nested under matching `<Link field={…}>`: strip Text (and duplicate value.text) —
 *   childless Link paints the label.
 * - Otherwise (custom `<a>` / button): rewrite to `{String(fields…?.value?.text ?? '')}`.
 * @param {string} source
 */
export function rewriteTextOnLinkField(source) {
  let text = String(source || '');
  if (!text.trim() || !/<Text\b/.test(text)) return text;

  const linkNames = collectLinkFieldNamesForTextRewrite(text);
  let stripped = 0;
  let rewritten = 0;

  for (const name of linkNames) {
    if (!name) continue;
    const needsBracket = /[^A-Za-z0-9_$]/.test(name);
    const fieldAccess = needsBracket
      ? `fields\\[["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\]`
      : `fields\\.${name}`;
    const valueExpr = needsBracket
      ? `fields[${JSON.stringify(name)}]`
      : `fields.${name}`;

    const textTag = new RegExp(
      `<Text\\s+field=\\{${fieldAccess}\\}\\s*(?:\\/>|>\\s*<\\/Text>)`,
      'g',
    );
    /** @type {Array<{ start: number, end: number, nested: boolean }>} */
    const hits = [];
    let m;
    while ((m = textTag.exec(text))) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        nested: isTextOnLinkFieldNestedUnderMatchingLink(text, m.index, fieldAccess),
      });
    }
    // Replace from end so indices stay valid
    for (let i = hits.length - 1; i >= 0; i--) {
      const hit = hits[i];
      if (hit.nested) {
        text = `${text.slice(0, hit.start)}${text.slice(hit.end)}`;
        stripped += 1;
      } else {
        const replacement = `{String(${valueExpr}?.value?.text ?? '')}`;
        text = `${text.slice(0, hit.start)}${replacement}${text.slice(hit.end)}`;
        rewritten += 1;
      }
    }

    // Drop duplicate value.text only when nested under matching Link (childless Link paints it)
    const valueText = new RegExp(`\\{${fieldAccess}\\??\\.value\\??\\.text\\}`, 'g');
    text = text.replace(valueText, (full, offset) => {
      if (isTextOnLinkFieldNestedUnderMatchingLink(text, offset, fieldAccess)) {
        stripped += 1;
        return '';
      }
      return full;
    });
  }

  text = text.replace(
    /<span\s+className="underline[^"]*"\s*>\s*<\/span>\s*/g,
    '',
  );

  if (stripped > 0 || rewritten > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: Text-on-LinkField — stripped ${stripped} under <Link>, rewrote ${rewritten} to value.text (TS2322)`,
    );
  }
  return text;
}

/**
 * Remove invalid `<Text field={…LinkField…} />` (LinkField is not a TextField).
 * Prefer {@link rewriteTextOnLinkField} (preserves custom-anchor labels). This
 * remains for callers that only want strip semantics under gated fixups.
 * @param {string} source
 */
export function stripTextOnLinkField(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const linkNames = collectLinkFieldNamesForTextRewrite(text);
  let removed = 0;
  for (const name of linkNames) {
    if (!name) continue;
    const needsBracket = /[^A-Za-z0-9_$]/.test(name);
    const fieldAccess = needsBracket
      ? `fields\\[["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\]`
      : `fields\\.${name}`;
    const expr = needsBracket
      ? `fields\\[${JSON.stringify(name)}\\]`
      : `fields\\.${name}`;

    const textTag = new RegExp(
      `<Text\\s+field=\\{${fieldAccess}\\}\\s*(?:\\/>|>\\s*<\\/Text>)`,
      'g',
    );
    text = text.replace(textTag, () => {
      removed += 1;
      return '';
    });

    const valueText = new RegExp(`\\{${expr}\\??\\.value\\??\\.text\\}`, 'g');
    text = text.replace(valueText, () => {
      removed += 1;
      return '';
    });
  }

  text = text.replace(
    /<span\s+className="underline[^"]*"\s*>\s*<\/span>\s*/g,
    '',
  );

  if (removed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: removed ${removed} Text/value.text binding(s) on LinkField (use childless Link or Title/children inside <Link>)`,
    );
  }
  return text;
}

/**
 * Always-on: ensure SDK value imports for JSX tags / hooks actually used in source.
 * Fixes TS2304 when sitecoreize emits `<RichText>` (etc.) without importing it.
 * @param {string} source
 */
export function ensureSdkJsxValueImports(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  /** @type {Set<string>} */
  const used = new Set();
  for (const name of SDK_JSX_VALUE_NAMES) {
    if (name === 'useSitecore') {
      if (new RegExp(`\\b${name}\\s*\\(`).test(text)) used.add(name);
      continue;
    }
    if (new RegExp(`<${name}\\b`).test(text)) used.add(name);
  }
  if (!used.size) return text;

  const imported = collectSdkImports(text);
  const missing = [...used].filter((n) => !imported.has(n));
  if (!missing.length) return text;

  // Prefer merging into an existing value import (not type-only).
  const valueImportRe =
    /^import\s+(?!type\s)\{([^}]*)\}\s+from\s+['"]@sitecore-content-sdk\/nextjs['"];?\s*$/m;
  const valueMatch = text.match(valueImportRe);
  if (valueMatch) {
    const existing = String(valueMatch[1] || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...missing])];
    const nextLine = `import { ${merged.join(', ')} } from '${SDK_MODULE}';`;
    text = text.replace(valueImportRe, nextLine);
    fixupWarn(
      `  ⚠ Codegen fixup: added SDK value import(s) ${missing.join(', ')} (TS2304)`,
    );
    return text;
  }

  const importLine = `import { ${missing.join(', ')} } from '${SDK_MODULE}';\n`;
  const typeImportRe =
    /^import\s+type\s+\{[^}]*\}\s+from\s+['"]@sitecore-content-sdk\/nextjs['"];?\s*\n/m;
  const typeMatch = text.match(typeImportRe);
  if (typeMatch && typeMatch.index != null) {
    const at = typeMatch.index;
    text = `${text.slice(0, at)}${importLine}${text.slice(at)}`;
  } else {
    const useClient = text.match(/^['"]use client['"];?\s*\n/);
    if (useClient) {
      text = `${text.slice(0, useClient[0].length)}${importLine}${text.slice(useClient[0].length)}`;
    } else {
      text = importLine + text;
    }
  }
  fixupWarn(
    `  ⚠ Codegen fixup: added SDK value import(s) ${missing.join(', ')} (TS2304)`,
  );
  return text;
}

/**
 * Always-on: when CustomEvent detail is compared/dispatched with a Field string
 * value, normalize `CustomEvent<number>` → `CustomEvent<string>` (TS2367).
 * @param {string} source
 */
export function normalizeCustomEventDetailVsFieldString(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/CustomEvent\s*<\s*number\s*>/.test(text)) return text;

  const usesFieldStringDetail =
    /new\s+CustomEvent(?:\s*<[^>]*>)?\s*\([^)]*detail\s*:\s*[^}]*fields[\s\S]{0,120}?\.value/.test(
      text,
    ) ||
    /\(event\s+as\s+CustomEvent\s*<\s*number\s*>\)\.detail\s*[!=]==?\s*[^;\n]*fields/.test(
      text,
    );

  if (!usesFieldStringDetail) return text;

  const next = text.replace(/CustomEvent\s*<\s*number\s*>/g, 'CustomEvent<string>');
  if (next !== text) {
    fixupWarn(
      '  ⚠ Codegen fixup: CustomEvent<number> → CustomEvent<string> (detail paired with Field string value)',
    );
  }
  return next;
}

/**
 * Content SDK `<Link>` has no `underline` boolean prop — AI sometimes emits
 * `underline` like an HTML attribute. Move it into `className` (or drop if
 * className already has underline).
 * @param {string} source
 */
export function stripInvalidLinkBooleanProps(source) {
  let text = String(source || "");
  if (!text.trim()) return text;

  let fixed = 0;
  text = text.replace(/<Link(\b[^>]*?)(\/?)>/g, (full, attrs, selfClose) => {
    let removed = false;
    let inQuote = null;
    let escape = false;
    let nextAttrs = "";
    for (let i = 0; i < attrs.length; ) {
      const ch = attrs[i];
      if (inQuote) {
        nextAttrs += ch;
        if (escape) {
          escape = false;
          i++;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          i++;
          continue;
        }
        if (ch === inQuote) inQuote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inQuote = ch;
        nextAttrs += ch;
        i++;
        continue;
      }
      const rest = attrs.slice(i);
      const boolMatch = rest.match(/^underline(?:\s*=\s*\{\s*true\s*\})?(?=\s|$)/);
      if (boolMatch) {
        removed = true;
        i += boolMatch[0].length;
        continue;
      }
      nextAttrs += ch;
      i++;
    }
    if (!removed) return full;
    fixed += 1;

    const classMatch = nextAttrs.match(
      /\bclassName=(?:\{?["'`]([^"'`]*)["'`]\}?)/,
    );
    if (classMatch) {
      const existing = classMatch[1] ?? "";
      if (!/\bunderline\b/.test(existing)) {
        const withUnderline = `${existing} underline`.trim();
        nextAttrs = nextAttrs.replace(
          classMatch[0],
          classMatch[0].replace(existing, withUnderline),
        );
      }
    } else {
      nextAttrs = `${nextAttrs} className="underline"`;
    }
    nextAttrs = nextAttrs.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n");
    if (nextAttrs.length && !/\s$/.test(nextAttrs)) nextAttrs += " ";
    return `<Link${nextAttrs}${selfClose}>`;
  });

  if (fixed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: moved ${fixed} invalid Link underline prop(s) into className`,
    );
  }
  return text;
}

/**
 * Field names modeled as `Rich Text` in a definition.ts source string.
 * @param {string|null|undefined} definitionTs
 * @returns {string[]}
 */
export function extractRichTextFieldNamesFromDefinition(definitionTs) {
  const def = String(definitionTs || '');
  if (!def.trim()) return [];
  /** @type {Set<string>} */
  const names = new Set();
  for (const m of def.matchAll(
    /\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*type:\s*['"]Rich Text['"]/g,
  )) {
    names.add(m[1]);
  }
  for (const m of def.matchAll(
    /\{\s*type:\s*['"]RichText['"]\s*,\s*name:\s*['"]([^'"]+)['"]/g,
  )) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * True when TSX mounts `fields.<name>` / `fields["name"]` via `<Text>` (not RichText).
 * @param {string} tsx
 * @param {string} fieldName
 * @returns {boolean}
 */
export function tsxUsesTextComponentOnField(tsx, fieldName) {
  const text = String(tsx || '');
  const name = String(fieldName || '');
  if (!text.trim() || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const access = /[^A-Za-z0-9_$]/.test(name)
    ? `fields\\[["']${escaped}["']\\]`
    : `fields\\.${escaped}\\b`;
  // Allow attrs between <Text and field={…} (multiline open tags).
  const re = new RegExp(`<Text\\b[^>]*\\bfield=\\{\\s*${access}`, 's');
  return re.test(text);
}

/**
 * RichText definition fields that the TSX incorrectly mounts with `<Text>`.
 * Warn-only — no post-AI rewrite.
 * @param {string} tsx
 * @param {string|null|undefined} definitionTs
 * @returns {string[]}
 */
export function collectRichTextFieldsRenderedAsText(tsx, definitionTs) {
  return extractRichTextFieldNamesFromDefinition(definitionTs).filter((name) =>
    tsxUsesTextComponentOnField(tsx, name),
  );
}

/**
 * True when a self-closing or empty-body `<Link>` still has
 * `showLinkTextWithChildrenPresent` (including `={true|false}`).
 * Warn-only detector — no post-AI rewrite.
 * @param {string} source
 * @returns {boolean}
 */
export function hasShowLinkTextOnChildlessLink(source) {
  const text = String(source || '');
  if (!text.trim() || !/showLinkTextWithChildrenPresent/.test(text)) return false;
  let found = false;
  mapLinkOpenTags(text, (hit) => {
    if (!/showLinkTextWithChildrenPresent/.test(hit.attrs)) return null;
    if (hit.selfClosing || !String(hit.children || '').trim()) found = true;
    return null;
  });
  return found;
}

/**
 * Locate the end of a JSX opening tag starting at `start` (`<Tag…>` / `<Tag…/>`).
 * Skips `>` inside quotes and `{…}` so arrow `=>` in `field={…}` is not treated
 * as the tag terminator (naive `/[^>]*>/` mangled Links that way).
 *
 * @param {string} text
 * @param {number} start index of '<'
 * @param {string} tagName e.g. `Link`
 * @returns {{ attrs: string, selfClosing: boolean, openEnd: number, close: string } | null}
 */
export function findJsxOpenTagClose(text, start, tagName) {
  const src = String(text || '');
  const head = src.slice(start).match(new RegExp(`^<${tagName}\\b`));
  if (!head) return null;
  const attrsStart = start + head[0].length;
  let i = attrsStart;
  let quote = /** @type {string|null} */ (null);
  let brace = 0;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      brace += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      brace = Math.max(0, brace - 1);
      i += 1;
      continue;
    }
    if (brace > 0) {
      i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '>') {
      let closeStart = i;
      while (closeStart > attrsStart && /\s/.test(src[closeStart - 1])) {
        closeStart -= 1;
      }
      return {
        attrs: src.slice(attrsStart, closeStart),
        selfClosing: true,
        openEnd: i + 2,
        close: src.slice(closeStart, i + 2),
      };
    }
    if (ch === '>') {
      return {
        attrs: src.slice(attrsStart, i),
        selfClosing: false,
        openEnd: i + 1,
        close: '>',
      };
    }
    i += 1;
  }
  return null;
}

/**
 * Walk each `<Link` open tag with brace-aware attr parsing.
 * @param {string} text
 * @param {(hit: {
 *   index: number,
 *   attrs: string,
 *   selfClosing: boolean,
 *   openEnd: number,
 *   close: string,
 *   children: string|null,
 *   closeEnd: number,
 * }) => string|null} mapFn return replacement for `<Link…>`…`</Link>` / self-close, or null to keep
 * @returns {string}
 */
function mapLinkOpenTags(text, mapFn) {
  let out = '';
  let last = 0;
  let i = 0;
  const src = String(text || '');
  while (i < src.length) {
    const idx = src.indexOf('<Link', i);
    if (idx < 0) break;
    if (idx > 0 && /[\w.]/.test(src[idx - 1])) {
      i = idx + 5;
      continue;
    }
    const next = src[idx + 5];
    if (next && /[\w.]/.test(next)) {
      i = idx + 5;
      continue;
    }
    const open = findJsxOpenTagClose(src, idx, 'Link');
    if (!open) {
      i = idx + 5;
      continue;
    }
    let children = /** @type {string|null} */ (null);
    let closeEnd = open.openEnd;
    if (!open.selfClosing) {
      const closeIdx = src.indexOf('</Link>', open.openEnd);
      if (closeIdx < 0) {
        i = open.openEnd;
        continue;
      }
      children = src.slice(open.openEnd, closeIdx);
      closeEnd = closeIdx + '</Link>'.length;
    }
    const replacement = mapFn({
      index: idx,
      attrs: open.attrs,
      selfClosing: open.selfClosing,
      openEnd: open.openEnd,
      close: open.close,
      children,
      closeEnd,
    });
    if (replacement == null) {
      i = closeEnd;
      continue;
    }
    out += src.slice(last, idx) + replacement;
    last = closeEnd;
    i = closeEnd;
  }
  return out + src.slice(last);
}

/**
 * Append boolean `suppressHydrationWarning` to a JSX opening-tag attribute string.
 * @param {string} attrs
 * @returns {string}
 */
function appendSuppressHydrationWarningAttr(attrs) {
  const next = String(attrs || '');
  if (/\bsuppressHydrationWarning\b/.test(next)) return next;
  // Empty attrs must still get a leading space so `<Tag>` → `<Tag suppressHydrationWarning>`,
  // never `<TagsuppressHydrationWarning>` (breaks JSX parse / Prettier).
  if (next === '') return ' suppressHydrationWarning';
  if (/\s$/.test(next)) return `${next}suppressHydrationWarning`;
  return `${next} suppressHydrationWarning`;
}

/**
 * Pages edit chrome injects tabindex/cursor onto field anchors; Content SDK Link
 * forwards suppressHydrationWarning to the rendered `<a>`.
 * @param {string} source
 * @returns {string}
 */
export function ensureSuppressHydrationWarningOnLinks(source) {
  let text = String(source || '');
  if (!text.trim() || !/<Link\b/.test(text)) return text;

  let fixed = 0;
  // Brace/quote-aware open-tag scan — never treat `>` inside `field={… => …}` as tag end.
  text = mapLinkOpenTags(text, (hit) => {
    if (/\bsuppressHydrationWarning\b/.test(hit.attrs)) return null;
    fixed += 1;
    const open = `<Link${appendSuppressHydrationWarningAttr(hit.attrs)}${hit.close}`;
    if (hit.selfClosing) return open;
    return `${open}${hit.children}</Link>`;
  });

  if (fixed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: added suppressHydrationWarning on ${fixed} Link(s) (Pages edit hydration)`,
    );
  }
  return text;
}

/**
 * Pages edit chrome injects tabindex/cursor onto component roots. Ensure the
 * outermost **DOM** JSX element of each `export const Variant` return has
 * `suppressHydrationWarning`. Skip PascalCase custom roots (TS2322 unless the
 * component declares+forwards the prop) — prefer AI putting the attr on the
 * first DOM child inside the wrapper.
 * @param {string} source
 * @returns {string}
 */
export function ensureSuppressHydrationWarningOnVariantRoots(source) {
  let text = String(source || '');
  if (!text.trim() || !/export const [A-Z]/.test(text)) return text;

  let fixed = 0;

  /**
   * Inject suppressHydrationWarning on the first lowercase (DOM) JSX open tag
   * after `fromIdx` within `block`. PascalCase custom components are skipped.
   * @param {string} block
   * @param {number} fromIdx
   * @returns {string|null}
   */
  const injectOnFirstJsx = (block, fromIdx) => {
    const slice = block.slice(fromIdx);
    const m = slice.match(/<([A-Za-z][\w.]*)(\b[^>]*?)(\/?>)/);
    if (!m || m.index == null) return null;
    const tagName = m[1] || '';
    // Custom React components (PascalCase) reject unknown props → TS2322.
    if (/^[A-Z]/.test(tagName)) return null;
    const attrs = m[2] || '';
    if (/\bsuppressHydrationWarning\b/.test(attrs)) return null;
    const abs = fromIdx + m.index;
    const replacement = `<${tagName}${appendSuppressHydrationWarningAttr(attrs)}${m[3]}`;
    fixed += 1;
    return block.slice(0, abs) + replacement + block.slice(abs + m[0].length);
  };

  // Arrow implicit-return: export const Default = (…) => (
  text = text.replace(
    /(export const [A-Z]\w*\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[A-Za-z_][\w]*)\s*=>\s*\()([\s\S]*?)(\n\);)/g,
    (full, head, body, tail) => {
      const next = injectOnFirstJsx(body, 0);
      if (next == null) return full;
      return `${head}${next}${tail}`;
    },
  );

  // Block body: export const Default = (…) => { … return ( <Root …>
  // Also matches `export const Default: React.FC<…> = (props) => { … }`
  text = text.replace(
    /(export const [A-Z]\w*\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[A-Za-z_][\w]*)\s*=>\s*\{)([\s\S]*?)(\n\};)/g,
    (full, head, body, tail) => {
      const ret = body.match(/\breturn\s*\(/);
      if (!ret || ret.index == null) return full;
      const next = injectOnFirstJsx(body, ret.index + ret[0].length);
      if (next == null) return full;
      return `${head}${next}${tail}`;
    },
  );

  if (fixed > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: added suppressHydrationWarning on ${fixed} variant root(s) (Pages edit hydration)`,
    );
  }
  return text;
}

/**
 * True when a `<Link>` with non-empty children still has
 * `showLinkTextWithChildrenPresent` (any form).
 * Warn-only detector — no post-AI rewrite.
 * @param {string} source
 * @returns {boolean}
 */
export function hasShowLinkTextPropOnLinkWithChildren(source) {
  const text = String(source || '');
  if (!text.trim() || !/showLinkTextWithChildrenPresent/.test(text)) return false;
  let found = false;
  mapLinkOpenTags(text, (hit) => {
    if (hit.selfClosing || !String(hit.children || '').trim()) return null;
    if (/showLinkTextWithChildrenPresent/.test(hit.attrs)) found = true;
    return null;
  });
  return found;
}

/**
 * Text-style General Links: move underline onto `<Link>` className (continuous by
 * default). Does not inject `no-underline` on arrows — that is screenshot-driven.
 * @param {string} source
 */
export function fixTextStyleLinkUnderline(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  // Pattern: <Link …> with empty <span /> + arrow (legacy scaffold) → underline on Link
  text = text.replace(
    /(<Link\b[^>]*\bclassName=\{?["'`])([^"'`]*)(["'`]\}?\s*>)\s*<span\s*\/>\s*(<span[^>]*>[\s\S]*?→[\s\S]*?<\/span>)\s*<\/Link>/g,
    (full, open, classes, mid, arrow) => {
      const cleaned = classes
        .replace(/\bunderline\b/g, '')
        .replace(/\bdecoration-\[[^\]]*\]/g, '')
        .replace(/\bunderline-offset-\[[^\]]*\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const nextClasses = cleaned.includes('inline-flex')
        ? cleaned
        : `inline-flex items-center ${cleaned}`.trim();
      // Continuous underline on Link root; leave arrow classes as authored (no forced no-underline)
      const withUnderline = /\bunderline\b/.test(nextClasses)
        ? nextClasses
        : `${nextClasses} underline underline-offset-[0.3em]`.trim();
      return `${open}${withUnderline}${mid}${arrow}</Link>`;
    },
  );

  return text;
}

/**
 * Slice of the parent object after `from` (used to detect sibling Link/CTA keys).
 * @param {string} text
 * @param {number} from
 */
function restOfEnclosingObject(text, from) {
  let depth = 1;
  let i = from;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
    i += 1;
  }
  return text.slice(from, i);
}

/**
 * Image seeds must be `{ url, alt }` (DataImageValue). Codegen sometimes nests
 * sibling CTA/Link objects inside Image — invalid TS and wrong field mapping.
 * Lift nested Link/CTA out only if a sibling Link/CTA is missing; otherwise drop.
 * @param {string} source
 */
export function stripNestedLinkPropsFromImageSeeds(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  let fixed = 0;

  /** @param {string} s @param {number} openIdx */
  const endOfObject = (s, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '"' || ch === "'" || ch === '`') {
        i = skipStringLiteral(s, i) - 1;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i + 1;
      }
    }
    return -1;
  };

  /** Structural keys that must never be treated as Image seeds. */
  const STRUCTURAL_ASSIGN_KEYS = new Set([
    'fields',
    'items',
    'kind',
    'sections',
    'placeholders',
    'model',
    'location',
    'content',
    'datasourceLocation',
    'folderTemplate',
    'itemTemplate',
    'variants',
    'children',
  ]);

  // Image-shaped seeds: top-level url/alt/… (not nested CTA.url inside fields: { … }).
  const assignRe =
    /(?:\b[A-Za-z_][\w]*\b|"[^"\n]+"|'[^'\n]+')\s*:\s*\{/g;
  /** @type {Array<{ keyStart: number, objStart: number, objEnd: number, key: string }>} */
  const assigns = [];
  let m;
  while ((m = assignRe.exec(text)) !== null) {
    const keyTok = m[0].replace(/\s*:\s*\{$/, '').replace(/^["']|["']$/g, '');
    if (STRUCTURAL_ASSIGN_KEYS.has(keyTok)) continue;
    const objStart = m.index + m[0].length - 1;
    const objEnd = endOfObject(text, objStart);
    if (objEnd < 0) continue;
    const inner = text.slice(objStart + 1, objEnd - 1);
    if (/\b(?:fields|items|kind|sections|placeholders|model|location)\s*:/.test(inner)) {
      continue;
    }
    const topKeys = new Set(findTopLevelObjectKeyHits(inner).map((h) => h.key));
    const looksLikeImage = ['url', 'alt', 'base64', 'svgMarkup', 'path', 'guid'].some((k) =>
      topKeys.has(k),
    );
    if (!looksLikeImage) continue;
    if (!topKeys.has('Link') && !topKeys.has('CTA')) continue;
    assigns.push({
      keyStart: m.index,
      objStart,
      objEnd,
      key: m[0].replace(/\s*:\s*\{$/, ''),
    });
  }

  for (let a = assigns.length - 1; a >= 0; a -= 1) {
    const { keyStart, objStart, objEnd, key } = assigns[a];
    let inner = text.slice(objStart + 1, objEnd - 1);
    /** @type {Array<{ name: string, literal: string }>} */
    const lifted = [];
    const nestedAssignRe = /\b(Link|CTA)\s*:\s*\{/g;
    /** @type {Array<{ name: string, from: number, to: number, literal: string }>} */
    const nested = [];
    let nm;
    while ((nm = nestedAssignRe.exec(inner)) !== null) {
      const nOpen = nm.index + nm[0].length - 1;
      const nEnd = endOfObject(inner, nOpen);
      if (nEnd < 0) continue;
      nested.push({
        name: nm[1],
        from: nm.index,
        to: nEnd,
        literal: inner.slice(nOpen, nEnd),
      });
    }
    for (let i = nested.length - 1; i >= 0; i -= 1) {
      const n = nested[i];
      const lit = n.literal;
      const urlM = lit.match(/\burl\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      const textM = lit.match(/\btext\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      const nestedUrl = urlM ? urlM[2] : '';
      const nestedText = textM ? textM[2] : '';
      // Drop placeholder nests (e.g. Lees meer + "/") — do not promote them to fields.
      const isPlaceholder =
        isPlaceholderLinkUrl(nestedUrl) ||
        (!nestedUrl && /^lees meer$/i.test(nestedText.trim()));
      if (!isPlaceholder) {
        lifted.unshift({ name: n.name, literal: n.literal });
      }
      let from = n.from;
      if (
        inner[from - 1] === ',' ||
        /,\s*$/.test(inner.slice(Math.max(0, from - 3), from))
      ) {
        from = inner.lastIndexOf(',', from);
      }
      inner = inner.slice(0, from) + inner.slice(n.to);
      fixed += 1;
    }
    inner = inner
      .replace(/,\s*,/g, ',')
      .replace(/^\s*,\s*/, '')
      .replace(/,\s*$/, '')
      .trim();

    const after = restOfEnclosingObject(text, objEnd);
    let suffix = '';
    for (const { name, literal } of lifted) {
      if (new RegExp('\\b' + name + '\\s*:').test(after)) continue;
      suffix += ',\n          ' + name + ': ' + literal;
    }

    const replacementInner = key + ': { ' + inner + ' }' + suffix;
    text = text.slice(0, keyStart) + replacementInner + text.slice(objEnd);
  }

  if (fixed > 0) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped ' +
        fixed +
        ' nested Link/CTA prop(s) from Image-shaped seed(s)',
    );
  }
  return text;
}

export function stripUnitFieldFromTsx(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  // Only strip when Fields no longer includes Unit
  if (/\bUnit\s*:\s*TextField/.test(text)) return text;
  const before = text;
  text = text.replace(
    /\s*<span[^>]*>\s*<Text\s+field=\{fields\.Unit\}\s*\/>\s*<\/span>/g,
    '',
  );
  text = text.replace(/\s*<Text\s+field=\{fields\.Unit\}\s*\/>/g, '');
  if (text !== before) {
    fixupWarn('  ⚠ Codegen fixup: removed Unit Text from TSX (single Value metric)');
  }
  return text;
}

/**
 * Image/category cards often invent empty Description from vacant imgcard__desc.
 * If every Description seed is empty/missing, drop Description from the model + seeds.
 * @param {string} source
 */
export function stripVacuousDescriptionFromDefinition(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\{\s*name:\s*["']Description["']\s*,\s*type:\s*["']Single-Line Text["']/.test(text)) {
    return text;
  }
  // Looks like an image card when Image + Title (+ optional Promo / Link) exist
  const looksLikeImageCard =
    /\{\s*name:\s*["']Image["']\s*,\s*type:\s*["']Image["']/.test(text) &&
    /\{\s*name:\s*["']Title["']\s*,\s*type:\s*["']Single-Line Text["']/.test(text);
  if (!looksLikeImageCard) return text;

  const descSeeds = [
    ...text.matchAll(/Description\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g),
  ].map((m) => m[2].trim());
  const hasNonEmpty = descSeeds.some((v) => v.length > 0);
  if (hasNonEmpty) return text;

  const before = text;
  text = text.replace(
    /,?\s*\{\s*name:\s*["']Description["']\s*,\s*type:\s*["']Single-Line Text["']\s*\}/g,
    '',
  );
  text = text.replace(/,?\s*Description\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1/g, '');
  // Clean leftover double commas in fields arrays / objects
  text = text.replace(/,\s*,/g, ',');
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped vacuous Description from image/category card definition (empty seeds)',
    );
  }
  return text;
}

/**
 * Image/category cards with multiple visual modes: ensure `variants` lists
 * Default / Promo / Teaser when seeds show promo ribbon and/or teaser cards.
 * Prefer headless variants over Checkbox layout flags.
 * @param {string} source
 */
export function ensureHeadlessVariantsForVisualModes(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const looksLikeImageCard =
    /\{\s*name:\s*["']Image["']\s*,\s*type:\s*["']Image["']/.test(text) &&
    /\{\s*name:\s*["']Title["']\s*,\s*type:\s*["']Single-Line Text["']/.test(text);
  if (!looksLikeImageCard) return text;

  const hasPromoField =
    /\{\s*name:\s*["']Promo Label["']/.test(text) ||
    /["']Promo Label["']\s*:/.test(text);
  const teaserTitle =
    /bekijk|view all|alle producten|tous les produits|voir tous/i;
  let hasTeaserItem = false;
  let hasPromoSeed = false;
  text.replace(
    /\{\s*name\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1[\s\S]*?fields\s*:\s*\{([\s\S]*?)\}\s*(?:,\s*children[\s\S]*?)?\}/g,
    (_item, _q, _name, fieldsBody) => {
      const titleMatch = fieldsBody.match(
        /Title\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/,
      );
      const title = titleMatch ? titleMatch[2] : '';
      const hasRating =
        /\bRating\s*:/.test(fieldsBody) ||
        /\b["']Rating Maximum["']\s*:/.test(fieldsBody) ||
        /\b["']Rating Summary["']\s*:/.test(fieldsBody);
      // Teaser only for view-all titles / imgcard teasers — never bare !hasImage (rating cards).
      if (!hasRating && teaserTitle.test(title)) {
        hasTeaserItem = true;
      }
      if (/["']Promo Label["']\s*:\s*(["'])((?:\\.|(?!\1)[^\\])+)\1/.test(fieldsBody)) {
        hasPromoSeed = true;
      }
      return _item;
    },
  );

  if (!hasTeaserItem && !hasPromoSeed && !hasPromoField) return text;

  const needed = new Set(['Default']);
  if (hasPromoSeed || hasPromoField) needed.add('Promo');
  if (hasTeaserItem) needed.add('Teaser');

  const variantsMatch = text.match(/variants\s*:\s*\[([\s\S]*?)\]/);
  const existing = new Set();
  if (variantsMatch) {
    for (const m of variantsMatch[1].matchAll(/name\s*:\s*["']([^"']+)["']/g)) {
      existing.add(m[1]);
    }
  }
  for (const name of needed) existing.add(name);
  const list = [...existing]
    .sort((a, b) => {
      if (a === 'Default') return -1;
      if (b === 'Default') return 1;
      return a.localeCompare(b);
    })
    .map((name) => `{ name: "${name}" }`)
    .join(', ');

  if (variantsMatch) {
    text = text.replace(/variants\s*:\s*\[[\s\S]*?\]/, `variants: [${list}]`);
  } else {
    text = text.replace(
      /(placeholders\s*:\s*\[[\s\S]*?\]\s*,)/,
      `$1\n  variants: [${list}],`,
    );
    if (!/variants\s*:\s*\[/.test(text)) {
      text = text.replace(
        /(content\s*:\s*\{)/,
        `variants: [${list}],\n  $1`,
      );
    }
  }

  if (needed.size > 1) {
    fixupWarn(
      `  ⚠ Codegen fixup: image/category card — variants [${[...needed].join(', ')}] (prefer headless variants over layout checkboxes)`,
    );
  }
  return text;
}

/**
 * Strip Show Down Arrow checkbox when Teaser-like variants exist (or always on
 * image cards once multi-variant path is preferred).
 * @param {string} source
 */
export function stripShowDownArrowLayoutFlag(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/Show Down Arrow/.test(text)) return text;

  const hasTeaserVariant = /variants\s*:\s*\[[\s\S]*?name\s*:\s*["']Teaser["']/.test(
    text,
  );
  const looksLikeImageCard =
    /\{\s*name:\s*["']Image["']\s*,\s*type:\s*["']Image["']/.test(text) &&
    /\{\s*name:\s*["']Title["']\s*,\s*type:\s*["']Single-Line Text["']/.test(text);
  if (!hasTeaserVariant && !looksLikeImageCard) return text;

  const before = text;
  text = text.replace(
    /,?\s*\{\s*name:\s*["']Show Down Arrow["']\s*,\s*type:\s*["']Checkbox["']\s*\}/g,
    '',
  );
  text = text.replace(/,?\s*["']Show Down Arrow["']\s*:\s*(?:true|false)/g, '');
  text = text.replace(/,\s*,/g, ',');
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped Show Down Arrow checkbox (use Teaser headless variant instead)',
    );
  }
  return text;
}

/**
 * @deprecated Prefer ensureHeadlessVariantsForVisualModes + stripShowDownArrowLayoutFlag.
 * Kept as a thin alias for older tests / imports.
 * @param {string} source
 */
export function ensureTeaserShowDownArrowSeeds(source) {
  return stripShowDownArrowLayoutFlag(
    ensureHeadlessVariantsForVisualModes(source),
  );
}

/**
 * Category/image card TSX: drop vacuous Description; prefer Teaser export for ↓
 * chrome instead of Show Down Arrow checkbox.
 * @param {string} source
 */
export function normalizeImageCategoryCardTsx(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const hasImageField = /\bImage\s*:\s*ImageField/.test(text);
  const hasTitle = /\bTitle\s*:\s*TextField/.test(text);
  const hasDescription = /\bDescription\s*:\s*TextField/.test(text);
  const hasUnconditionalArrow =
    />\s*↓\s*<\/span>/.test(text) ||
    /aria-hidden="true"[^>]*>\s*↓\s*</.test(text);
  if (!hasImageField || !hasTitle) return text;
  if (!hasDescription && !hasUnconditionalArrow && !/Show Down Arrow/.test(text)) {
    return text;
  }

  let changed = false;

  if (hasDescription) {
    text = text.replace(/\s*Description\s*:\s*TextField\s*;?/g, '');
    text = text.replace(
      /\s*<Text\s+field=\{fields\.Description\}[^/]*\/>/g,
      '',
    );
    text = text.replace(
      /\s*<Text\s+field=\{fields\.Description\}[^>]*>\s*<\/Text>/g,
      '',
    );
    changed = true;
  }

  // Prefer Teaser variant export over Show Down Arrow checkbox
  if (/Show Down Arrow/.test(text) || hasUnconditionalArrow) {
    text = text.replace(/\s*['"]Show Down Arrow['"]\s*:\s*Field<[^;]+;?/g, '');
    text = text.replace(
      /\s*const showDownArrow\s*=\s*Boolean\([^;]+;\s*/g,
      '',
    );
    // If only Default export exists and has ↓, leave ↓ in Default but warn —
    // durable path expects a Teaser export; warn when missing.
    if (!/export const Teaser\b/.test(text) && hasUnconditionalArrow) {
      fixupWarn(
        '  ⚠ Codegen fixup: image/category card has ↓ chrome but no export const Teaser — prefer Teaser headless variant',
      );
    }
    if (/showDownArrow \?/.test(text)) {
      // Unwrap checkbox gate so chrome can move to Teaser; if Teaser exists, strip ↓ from Default
      if (/export const Teaser\b/.test(text)) {
        text = text.replace(
          /\{showDownArrow \?\s*\(\s*<span([^>]*)>\s*↓\s*<\/span>\s*\)\s*:\s*null\}/g,
          '',
        );
      }
    }
    changed = true;
  }

  if (changed) {
    fixupWarn(
      '  ⚠ Codegen fixup: image/category card — removed vacuous Description / Show Down Arrow; use Teaser/Promo variants',
    );
  }
  return text;
}

/**
 * Ensure definition `variants[]` covers every PascalCase `export const` in TSX.
 * When called on definition source alone, no-op unless paired via options.tsx.
 * Also runnable on TSX to warn about export ↔ variants mismatch when definition
 * text is passed in options.
 * @param {string} source TSX or definition
 * @param {{ definitionSource?: string }} [options]
 */
export function ensureVariantsCoverNamedExports(source, options = {}) {
  const text = String(source || '');
  if (!text.trim()) return text;

  const exportNames = [
    ...text.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9]*)\s*=/g),
  ].map((m) => m[1]);
  if (!exportNames.length) return text;

  // If this looks like TSX (has export const + JSX-ish), only warn unless we can patch a variants list in the same file
  const hasVariantsList = /variants\s*:\s*\[/.test(text);
  if (!hasVariantsList) {
    const def = String(options.definitionSource || '');
    if (def && /variants\s*:\s*\[/.test(def)) {
      const listed = new Set(
        [...def.matchAll(/name\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]),
      );
      const missing = exportNames.filter((n) => !listed.has(n));
      if (missing.length) {
        fixupWarn(
          `  ⚠ Codegen fixup: TSX exports [${exportNames.join(', ')}] missing from definition variants [${[...listed].join(', ')}] — add ${missing.join(', ')}`,
        );
      }
    }
    return text;
  }

  const variantsMatch = text.match(/variants\s*:\s*\[([\s\S]*?)\]/);
  if (!variantsMatch) return text;
  const existing = new Set();
  for (const m of variantsMatch[1].matchAll(/name\s*:\s*["']([^"']+)["']/g)) {
    existing.add(m[1]);
  }
  let added = false;
  for (const name of exportNames) {
    if (!existing.has(name)) {
      existing.add(name);
      added = true;
    }
  }
  if (!added) return text;
  const list = [...existing]
    .sort((a, b) => {
      if (a === 'Default') return -1;
      if (b === 'Default') return 1;
      return a.localeCompare(b);
    })
    .map((name) => `{ name: "${name}" }`)
    .join(', ');
  fixupWarn(
    `  ⚠ Codegen fixup: variants list updated to cover exports [${exportNames.join(', ')}]`,
  );
  return text.replace(/variants\s*:\s*\[[\s\S]*?\]/, `variants: [${list}]`);
}

/**
 * Definition-only: drop `variants[].name` entries that have no matching
 * `export const Name` in sibling TSX. Never rewrites TSX.
 * Always keeps Default. No-op when tsxSource is empty.
 * @param {string} definitionSource
 * @param {string | null | undefined} tsxSource
 */
export function stripOrphanVariantsNotInTsx(definitionSource, tsxSource) {
  let text = String(definitionSource || '');
  const tsx = String(tsxSource || '');
  if (!text.trim() || !tsx.trim()) return text;
  if (!/variants\s*:\s*\[/.test(text)) return text;

  const exportNames = new Set(
    [...tsx.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9]*)\s*=/g)].map(
      (m) => m[1],
    ),
  );
  if (!exportNames.size) return text;

  const variantsMatch = text.match(/variants\s*:\s*\[([\s\S]*?)\]/);
  if (!variantsMatch) return text;
  const listed = [
    ...variantsMatch[1].matchAll(/name\s*:\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  const kept = listed.filter(
    (name) => name === 'Default' || exportNames.has(name),
  );
  if (kept.length === listed.length) return text;
  if (!kept.includes('Default')) kept.unshift('Default');
  const list = [...new Set(kept)]
    .sort((a, b) => {
      if (a === 'Default') return -1;
      if (b === 'Default') return 1;
      return a.localeCompare(b);
    })
    .map((name) => `{ name: "${name}" }`)
    .join(', ');
  const dropped = listed.filter((n) => !kept.includes(n));
  fixupWarn(
    `  ⚠ Codegen fixup: stripped orphan definition variants [${dropped.join(', ')}] (not exported in TSX)`,
  );
  return text.replace(/variants\s*:\s*\[[\s\S]*?\]/, `variants: [${list}]`);
}

/**
 * Pages editing: field components must always mount (empty fields stay editable).
 */
export function warnConditionalFieldGuards(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  if (
    /fields\??\.\s*[\w"']+\s*&&\s*\(\s*<(Text|RichText|Image|Link)\b/.test(text) ||
    /fields\??\[["'][^"']+["']\]\s*&&\s*\(\s*<(Text|RichText|Image|Link)\b/.test(text)
  ) {
    fixupWarn(
      '  ⚠ Codegen fixup: conditional field guard around Text/RichText/Image/Link — always mount field components for Pages editing',
    );
  }
}

/**
 * Rewrite bare `fields.data.datasource` to `getDatasource(fields)` and ensure
 * helpers are imported from `lib/component-props` for link-list style TSX.
 *
 * @deprecated Not invoked on the AI write path — prefer prompt rules so AI emits
 * `getDatasource` correctly. Kept for optional tooling / tests only.
 */
export function ensureSafeDatasourceAccess(source) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const looksLikeLinkList =
    /\bchildren\??\.\s*results\b/.test(text) ||
    /\bfield\??\.\s*(title|link)\b/.test(text);
  const hasUnsafe =
    /\b(?:props\.)?fields\.data\.datasource\b/.test(text);

  if (!looksLikeLinkList && !hasUnsafe) return text;

  if (hasUnsafe) {
    text = text.replace(
      /\bprops\.fields\.data\.datasource\b/g,
      'getDatasource(props.fields)',
    );
    text = text.replace(
      /\bfields\.data\.datasource\b/g,
      'getDatasource(fields)',
    );
    fixupWarn(
      '  ⚠ Codegen fixup: rewrote unsafe fields.data.datasource → getDatasource(…)',
    );
  }

  const needsHelpers =
    /\bgetDatasource\s*\(/.test(text) ||
    /\bgetFieldValue\s*\(/.test(text) ||
    hasUnsafe;

  if (!needsHelpers) return text;

  const helperNames = [];
  if (/\bgetDatasource\s*\(/.test(text)) helperNames.push('getDatasource');
  if (/\bgetFieldValue\s*\(/.test(text) || hasUnsafe) {
    if (!helperNames.includes('getFieldValue')) helperNames.push('getFieldValue');
  }
  // After rewrite we always need getDatasource when hasUnsafe
  if (hasUnsafe && !helperNames.includes('getDatasource')) {
    helperNames.unshift('getDatasource');
  }
  if (helperNames.length === 0) return text;

  const propsImportRe =
    /^import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/m;

  if (propsImportRe.test(text)) {
    text = text.replace(propsImportRe, (full, typePrefix, named) => {
      if (typePrefix) {
        // Keep type-only import; add a separate value import below
        return full;
      }
      const existing = named
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const missing = helperNames.filter((h) => !existing.includes(h));
      if (missing.length === 0) return full;
      return `import { ${[...existing, ...missing].join(', ')} } from 'lib/component-props';`;
    });
  }

  const covered = new Set();
  for (const m of text.matchAll(
    /^import\s+(?!type\s)\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
  )) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/\s+as\s+\w+$/, '').trim();
      if (name) covered.add(name);
    }
  }
  const stillMissing = helperNames.filter((h) => !covered.has(h));
  if (stillMissing.length === 0) return text;

  const importLine = `import { ${stillMissing.join(', ')} } from 'lib/component-props';\n`;
  if (/^['"]use client['"];?\s*\n/.test(text)) {
    return text.replace(/^(['"]use client['"];?\s*\n+)/, `$1${importLine}`);
  }
  // After other imports if possible
  const lastImport = [...text.matchAll(/^import\s.+;?\s*$/gm)].pop();
  if (lastImport) {
    const idx = lastImport.index + lastImport[0].length;
    return `${text.slice(0, idx)}\n${importLine}${text.slice(idx)}`;
  }
  return importLine + text.replace(/^\uFEFF/, '');
}

/** @deprecated use ensureSafeDatasourceAccess */
export function warnUnsafeDatasourceAccess(source) {
  ensureSafeDatasourceAccess(source);
}

/**
 * Accordion panels that default to `hidden` without isEditing hide links in Pages.
 */
export function warnAccordionHiddenWithoutEditing(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  const hasHiddenToggle =
    /\$\{[^}]*\?\s*['"]block['"]\s*:\s*['"]hidden['"]/.test(text) ||
    /\$\{[^}]*\?\s*['"]hidden['"]\s*:\s*['"]block['"]/.test(text);
  if (!hasHiddenToggle) return;
  // Accordion panels may start collapsed in Pages (match live UX) — no isEditing force-open required.
}

/**
 * Platform link-list child seeds must not invent url: "#" when a real href exists.
 */
export function warnHashLinkListUrls(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  if (!/folder:\s*\[["'](?:Link Lists|Icon Link Lists|Image Link Lists)["']\]/.test(text) && !/(?:Icon |Image )?Link Lists/.test(text)) {
    // Still warn on common AI mistake in any definition with Link children
  }
  if (/Link\s*:\s*\{[^}]*url\s*:\s*["']#["']/.test(text)) {
    fixupWarn(
      '  ⚠ Codegen fixup: Link.url is "#" in definition content — use the captured href from HTML (only "#" when the source href is truly "#")',
    );
  }
}

/**
 * Normalize visible link label for map lookup.
 * @param {string} s
 */
export function normalizeLinkLabel(s) {
  return String(s || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * True when a Link/CTA url should be replaced from HTML (missing / placeholder).
 * @param {string} url
 */
export function isPlaceholderLinkUrl(url) {
  const u = String(url || '').trim();
  return !u || u === '/' || u === '#';
}

/**
 * Parse section HTML into label → href map (first wins per label).
 * Also supports ordered queues for duplicate labels via {@link buildOrderedAnchorHrefsFromHtml}.
 * @param {string} html
 * @returns {Map<string, string>}
 */
export function buildAnchorHrefMapFromHtml(html) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const { label, href } of listAnchorsFromHtml(html)) {
    if (!map.has(label)) map.set(label, href);
  }
  return map;
}

/**
 * Document-order anchors: { label, href }[].
 * @param {string} html
 * @returns {Array<{ label: string, href: string }>}
 */
export function listAnchorsFromHtml(html) {
  /** @type {Array<{ label: string, href: string }>} */
  const out = [];
  const raw = String(html || '');
  if (!raw.trim()) return out;

  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2] || '';
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
    if (!hrefMatch) continue;
    const href = String(hrefMatch[2] || '').trim();
    if (!href) continue;
    const label = normalizeLinkLabel(inner);
    if (!label) continue;
    out.push({ label, href });
  }
  return out;
}

/**
 * Ordered href queues keyed by normalized label (for duplicate "Lees meer" × N).
 * @param {string} html
 * @returns {Map<string, string[]>}
 */
export function buildOrderedAnchorHrefsFromHtml(html) {
  /** @type {Map<string, string[]>} */
  const queues = new Map();
  for (const { label, href } of listAnchorsFromHtml(html)) {
    if (!queues.has(label)) queues.set(label, []);
    queues.get(label).push(href);
  }
  return queues;
}

/**
 * Resolve href for a link label (capture language or English alias) via exact / soft / path-token match.
 * When `queues` is provided, consumes the next href for that label (document order).
 * @param {Map<string, string>} map
 * @param {string} text
 * @param {Map<string, string[]>|null} [queues]
 * @returns {string|null}
 */
export function resolveHrefForLinkText(map, text, queues = null) {
  const needle = normalizeLinkLabel(text);
  if (!needle || (!map.size && !(queues && queues.size))) return null;

  if (queues && queues.has(needle) && queues.get(needle).length) {
    return queues.get(needle).shift() ?? null;
  }

  if (map.has(needle)) return map.get(needle) ?? null;

  for (const group of LINK_LABEL_ALIAS_GROUPS) {
    if (!group.some((g) => normalizeLinkLabel(g) === needle)) continue;
    for (const g of group) {
      const key = normalizeLinkLabel(g);
      if (queues && queues.has(key) && queues.get(key).length) {
        return queues.get(key).shift() ?? null;
      }
      const href = map.get(key);
      if (href) return href;
    }
  }

  const softNeedle = needle.replace(/[&+]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [label, href] of map) {
    const softLabel = label.replace(/[&+]/g, ' ').replace(/\s+/g, ' ').trim();
    if (softLabel === softNeedle) return href;
    if (softLabel.includes(softNeedle) || softNeedle.includes(softLabel)) {
      return href;
    }
  }

  // Path-token overlap (e.g. "Jobs" ↔ /nl/jobs, "About AXA" ↔ /nl/over-axa via "axa")
  const words = softNeedle.split(/\W+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  /** @type {{ href: string, score: number }[]} */
  const scored = [];
  for (const [, href] of map) {
    let path = href.toLowerCase();
    try {
      path = new URL(href, 'https://example.com').pathname.toLowerCase();
    } catch {
      /* keep href */
    }
    let score = 0;
    for (const w of words) {
      if (path.includes(w)) score += 2;
      else if (w.length >= 4 && path.includes(w.slice(0, 4))) score += 1;
    }
    if (score > 0) scored.push({ href, score });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best) return null;
  if (second && second.score === best.score) return null; // ambiguous
  return best.href;
}

/**
 * Normalize href for map lookup (path + host, strip hash/query noise).
 * @param {string} href
 */
function normalizeHrefKey(href) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^javascript:/i.test(raw)) return raw.toLowerCase();
  try {
    const u = new URL(raw, 'https://example.invalid');
    return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.split('?')[0].split('#')[0].replace(/\/$/, '').toLowerCase();
  }
}

/**
 * Build href → capture-language label map from section HTML anchors.
 * @param {string} html
 * @returns {Map<string, string>}
 */
function buildHrefLabelMapFromHtml(html) {
  /** @type {Map<string, string>} */
  const map = new Map();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const attrs = m[1] || '';
    const inner = String(m[2] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i);
    if (!hrefMatch) continue;
    const href = String(hrefMatch[2] || '').trim();
    if (!href || !inner) continue;
    const key = normalizeHrefKey(href);
    if (key && !map.has(key)) map.set(key, inner.replace(/\u200b/g, '').trim());
  }
  return map;
}

/**
 * Fill missing / placeholder Link and CTA urls from section HTML anchors.
 * Also overwrites `text` with the capture-language HTML label when the href matches
 * (so English AI labels do not survive when culture ≠ en).
 *
 * @param {string} source definition TS
 * @param {string|null|undefined} sectionHtml
 * @returns {string}
 */
export function fillLinkUrlsFromSectionHtml(source, sectionHtml) {
  let text = String(source || '');
  if (!text.trim() || !String(sectionHtml || '').trim()) return text;

  const map = buildAnchorHrefMapFromHtml(sectionHtml);
  const queues = buildOrderedAnchorHrefsFromHtml(sectionHtml);
  const hrefLabels = buildHrefLabelMapFromHtml(sectionHtml);
  if (!map.size && !hrefLabels.size) return text;

  let filled = 0;
  text = text.replace(
    /\b((?:Link|CTA|[A-Za-z][\w ]*Link)\s*:\s*\{)([^}]*)(\})/g,
    (full, open, body, close) => {
      const textMatch = body.match(/\btext\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      if (!textMatch) return full;
      const linkText = textMatch[2];
      const urlMatch = body.match(/\burl\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/);
      const currentUrl = urlMatch ? urlMatch[2] : '';
      let href =
        urlMatch && !isPlaceholderLinkUrl(currentUrl)
          ? currentUrl
          : resolveHrefForLinkText(map, linkText, queues);
      if (!href) return full;

      const captureLabel = hrefLabels.get(normalizeHrefKey(href));
      const needsUrl = !urlMatch || isPlaceholderLinkUrl(currentUrl);
      const needsText =
        Boolean(captureLabel) &&
        normalizeLinkLabel(captureLabel) !== normalizeLinkLabel(linkText);
      if (!needsUrl && !needsText) return full;

      filled += 1;
      let newBody = body;
      if (needsText && captureLabel) {
        const textLit = JSON.stringify(captureLabel);
        newBody = newBody.replace(
          /\btext\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1/,
          `text: ${textLit}`,
        );
      }
      if (needsUrl) {
        const urlLit = JSON.stringify(href);
        if (urlMatch) {
          newBody = newBody.replace(
            /\burl\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1/,
            `url: ${urlLit}`,
          );
        } else {
          newBody = newBody.replace(
            /(\btext\s*:\s*(["'])(?:\\.|(?!\2)[^\\])*\2)/,
            `$1, url: ${urlLit}`,
          );
        }
      }
      return `${open}${newBody}${close}`;
    },
  );

  if (filled > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: synced ${filled} Link/CTA label/url(s) from section HTML`,
    );
  }
  return fillRemainingPlaceholderLinkUrlsByDocumentOrder(text, sectionHtml);
}

/**
 * After label-based fill, assign leftover url:"/" seeds from unused real hrefs
 * in document order (English AI labels often miss Dutch capture text).
 * @param {string} source
 * @param {string} sectionHtml
 * @returns {string}
 */
export function fillRemainingPlaceholderLinkUrlsByDocumentOrder(
  source,
  sectionHtml,
) {
  let text = String(source || '');
  if (!text.trim() || !String(sectionHtml || '').trim()) return text;

  const used = new Set();
  for (const m of text.matchAll(/\burl\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const u = m[2];
    if (!isPlaceholderLinkUrl(u)) used.add(normalizeHrefKey(u));
  }

  /** @type {string[]} */
  const pool = [];
  for (const { href } of listAnchorsFromHtml(sectionHtml)) {
    if (isPlaceholderLinkUrl(href) || /^#|^javascript:/i.test(href)) continue;
    const key = normalizeHrefKey(href);
    if (!key || used.has(key)) continue;
    if (pool.some((h) => normalizeHrefKey(h) === key)) continue;
    pool.push(href);
  }
  if (!pool.length) return text;

  let assigned = 0;
  let poolIdx = 0;
  text = text.replace(
    /\b((?:Link|CTA|[A-Za-z][\w ]*Link)\s*:\s*\{)([^}]*)(\})/g,
    (full, open, body, close) => {
      if (poolIdx >= pool.length) return full;
      if (!/\burl\s*:\s*(["'])\/\1/.test(body)) return full;
      const href = pool[poolIdx++];
      assigned += 1;
      used.add(normalizeHrefKey(href));
      const urlLit = JSON.stringify(href);
      const newBody = body.replace(/\burl\s*:\s*(["'])\/\1/, `url: ${urlLit}`);
      return `${open}${newBody}${close}`;
    },
  );

  if (assigned > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: filled ${assigned} leftover Link/CTA url:"/" from document-order hrefs`,
    );
  }
  return text;
}

/**
 * Normalize a field name for matching (`Primary CTA` ↔ `primaryCta` ↔ `primary_cta`).
 * @param {unknown} name
 */
export function normalizeSeedFieldKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Collect model field `{ name, type }` from definition `itemTemplate.sections[].fields`.
 * @param {string} source
 * @returns {Array<{ name: string, type: string }>}
 */
export function collectModelFieldsFromDefinition(source) {
  const text = String(source || '');
  /** @type {Array<{ name: string, type: string }>} */
  const out = [];
  const seen = new Set();
  const re =
    /\{\s*name\s*:\s*(["'])([^"']+)\1\s*,\s*type\s*:\s*(["'])([^"']+)\3/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[2].trim();
    const type = m[4].trim();
    if (!name || seen.has(name)) continue;
    // Skip folder/item template names that use the same shape
    if (/folder$/i.test(name) && /folder/i.test(type)) continue;
    seen.add(name);
    out.push({ name, type });
  }
  return out;
}

/**
 * True when a model field is General Link shaped (by type or name).
 * @param {{ name: string, type: string }} field
 */
function isLinkShapedModelField(field) {
  const t = String(field.type || '').toLowerCase();
  if (t.includes('link') || t === 'general link') return true;
  return /(?:^|\s)(cta|link)$/i.test(field.name) || /cta$/i.test(field.name);
}

/**
 * True when a model field is Image shaped.
 * @param {{ name: string, type: string }} field
 */
function isImageShapedModelField(field) {
  const t = String(field.type || '').toLowerCase();
  return t.includes('image') || /image|logo|icon$/i.test(field.name);
}

/**
 * Ordered CTA/action links from suggestedFields / repeats (conversionActions, etc.).
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {Array<{ text: string, url: string }>}
 */
export function collectOrderedActionLinksFromSectionInfo(info) {
  /** @type {Array<{ text: string, url: string }>} */
  const out = [];
  if (!info || typeof info !== 'object') return out;

  /**
   * @param {unknown} item
   */
  function pushLinkItem(item) {
    if (!item || typeof item !== 'object') return;
    const o = /** @type {Record<string, unknown>} */ (item);
    const link =
      o.link && typeof o.link === 'object'
        ? /** @type {Record<string, unknown>} */ (o.link)
        : o.cta && typeof o.cta === 'object'
          ? /** @type {Record<string, unknown>} */ (o.cta)
          : o;
    const urlRaw = link.url ?? link.href;
    if (typeof urlRaw !== 'string' || isPlaceholderLinkUrl(urlRaw)) return;
    const text = link.text != null ? String(link.text) : '';
    if (!text.trim()) return;
    out.push({ text: text.trim(), url: String(urlRaw).trim() });
  }

  /**
   * @param {unknown} arr
   * @param {string} nameHint
   */
  function consumeActionArray(arr, nameHint) {
    if (!Array.isArray(arr)) return;
    if (!/conversion|cta|action/i.test(String(nameHint || ''))) return;
    for (const item of arr) pushLinkItem(item);
  }

  /**
   * @param {unknown} node
   * @param {string} [parentKey]
   */
  function walk(node, parentKey = '') {
    if (node == null) return;
    if (Array.isArray(node)) {
      if (/conversion|cta|action/i.test(String(parentKey || ''))) {
        for (const item of node) pushLinkItem(item);
        return;
      }
      for (const item of node) walk(item, parentKey);
      return;
    }
    if (typeof node !== 'object') return;
    const o = /** @type {Record<string, unknown>} */ (node);
    // suggestedFields entry: { name: "conversionActions", value: [...] }
    if (typeof o.name === 'string' && Array.isArray(o.value)) {
      consumeActionArray(o.value, o.name);
    }
    for (const [k, v] of Object.entries(o)) {
      if (k === 'value' && typeof o.name === 'string') continue; // already handled
      walk(v, k);
    }
  }

  walk(info.suggestedFields);
  walk(info.repeats);
  // Deduplicate by url+text
  const seen = new Set();
  return out.filter((l) => {
    const key = `${normalizeLinkLabel(l.text)}|${l.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build lookup of suggestedFields by normalized name → { value, type }.
 * @param {Record<string, unknown>|null|undefined} info
 * @returns {Map<string, { value: unknown, type: string, name: string }>}
 */
function buildSuggestedFieldLookup(info) {
  /** @type {Map<string, { value: unknown, type: string, name: string }>} */
  const map = new Map();
  if (!info || typeof info !== 'object') return map;
  const seeds = Array.isArray(info.suggestedFields) ? info.suggestedFields : [];
  for (const seed of seeds) {
    if (!seed || typeof seed !== 'object') continue;
    const s = /** @type {Record<string, unknown>} */ (seed);
    const name = String(s.name || '').trim();
    if (!name) continue;
    // Skip structural arrays — handled via collectOrderedActionLinks
    if (String(s.type || '').toLowerCase() === 'array') continue;
    const key = normalizeSeedFieldKey(name);
    if (!key || map.has(key)) continue;
    map.set(key, { value: s.value, type: String(s.type || ''), name });
  }
  return map;
}

const CHROME_SEED_KEYS = new Set(['Heading', 'Title', 'Headline', 'Eyebrow']);

/**
 * Inject missing model content seeds onto chrome content items from suggestedFields.
 * Model-driven (any site/component) — no footer allowlist.
 *
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} info
 * @param {string|null|undefined} [_sectionHtml]
 */
export function injectMissingContentSeedsFromSuggestedFields(
  source,
  info,
  _sectionHtml = null,
) {
  let text = String(source || '');
  if (!text.trim() || !info) return text;

  const modelFields = collectModelFieldsFromDefinition(text);
  if (!modelFields.length) return text;

  const suggested = buildSuggestedFieldLookup(info);
  const actionLinks = collectOrderedActionLinksFromSectionInfo(info);
  let actionIdx = 0;
  let injected = 0;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;
  const contentOpen = text.indexOf('{', contentMatch.index);
  if (contentOpen < 0) return text;
  const itemsMatch = text.slice(contentOpen).match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return text;
  const itemsBracket = text.indexOf('[', contentOpen + itemsMatch.index);
  if (itemsBracket < 0) return text;

  const items = findTopLevelArrayObjects(text, itemsBracket);
  for (let ii = items.length - 1; ii >= 0; ii -= 1) {
    const { start, closeBrace } = items[ii];
    const body = text.slice(start + 1, closeBrace);
    const hits = findTopLevelObjectKeyHits(body);
    const fieldsHit = hits.find((h) => h.key === 'fields');
    if (!fieldsHit) continue;

    const fieldsRelOpen = body.indexOf('{', fieldsHit.start);
    if (fieldsRelOpen < 0) continue;
    const fieldsOpen = start + 1 + fieldsRelOpen;
    const fieldsAfter = skipObjectOrValue(text, fieldsOpen);
    let fieldsClose = fieldsAfter - 1;
    while (fieldsClose > fieldsOpen && text[fieldsClose] !== '}') fieldsClose -= 1;
    if (text[fieldsClose] !== '}') continue;

    const fieldsInner = text.slice(fieldsOpen + 1, fieldsClose);
    const fieldKeys = new Set(
      findTopLevelObjectKeyHits(fieldsInner).map((h) => h.key),
    );
    // Chrome items only — skip pure link-list / icon rows
    if (![...CHROME_SEED_KEYS].some((k) => fieldKeys.has(k))) continue;

    /** @type {string[]} */
    const additions = [];

    // Prefer Primary/Secondary CTA order when assigning action links
    const missingLinkFields = modelFields
      .filter((f) => isLinkShapedModelField(f) && !fieldKeys.has(f.name))
      .sort((a, b) => {
        const rank = (n) => {
          const k = normalizeSeedFieldKey(n);
          if (k === 'primarycta' || k === 'cta') return 0;
          if (k === 'secondarycta') return 1;
          if (k.endsWith('cta')) return 2;
          if (k === 'link') return 3;
          return 4;
        };
        return rank(a.name) - rank(b.name);
      });

    for (const field of modelFields) {
      if (fieldKeys.has(field.name)) continue;
      // Skip Heading/Title already handled by capture heading remap
      if (CHROME_SEED_KEYS.has(field.name) && field.name !== 'Eyebrow') continue;

      const key = normalizeSeedFieldKey(field.name);
      let literal = null;

      if (isLinkShapedModelField(field)) {
        const named = suggested.get(key);
        if (named) {
          literal = seedValueToTsLiteral(named.value, named.type || 'link');
        }
        if (!literal && actionLinks.length && actionIdx < actionLinks.length) {
          // Only consume action queue for fields in missingLinkFields order
          if (missingLinkFields.some((f) => f.name === field.name)) {
            const link = actionLinks[actionIdx];
            actionIdx += 1;
            literal = seedValueToTsLiteral(link, 'link');
          }
        }
      } else if (isImageShapedModelField(field)) {
        const named = suggested.get(key);
        if (named) {
          literal = seedValueToTsLiteral(named.value, named.type || 'image');
        }
      } else {
        const named = suggested.get(key);
        if (named) {
          const typeHint =
            named.type ||
            (/rich/i.test(field.type) ? 'rich text' : 'text');
          if (
            isUrlLikeTextValue(named.value) &&
            /^(heading|title|subtitle|label|description|eyebrow)$/i.test(field.name)
          ) {
            continue;
          }
          literal = seedValueToTsLiteral(named.value, typeHint);
        }
      }

      if (!literal) continue;
      // Quote keys that contain spaces (Primary CTA)
      const keyLit = /\s/.test(field.name)
        ? JSON.stringify(field.name)
        : field.name;
      additions.push(`${keyLit}: ${literal}`);
      fieldKeys.add(field.name);
    }

    if (!additions.length) continue;
    const trimmed = fieldsInner.trimEnd().replace(/,\s*$/, '');
    const seed = `${trimmed}${trimmed ? ',\n          ' : ''}${additions.join(',\n          ')}\n        `;
    text = text.slice(0, fieldsOpen + 1) + `\n          ${seed}` + text.slice(fieldsClose);
    injected += additions.length;
  }

  if (injected > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: injected ${injected} missing content seed(s) from suggestedFields`,
    );
  }
  return text;
}

/**
 * Inject missing CTA / Link / *CTA / *Link seeds onto content items when the model declares them.
 * Uses ordered HTML hrefs + optional seed link texts from section info.
 * @param {string} source
 * @param {Record<string, unknown>|null|undefined} info
 * @param {string|null|undefined} sectionHtml
 */
export function injectMissingLinkSeeds(source, info, sectionHtml = null) {
  let text = String(source || '');
  if (!text.trim()) return text;

  const modelFields = collectModelFieldsFromDefinition(text);
  /** @type {string[]} */
  let linkFieldNames = modelFields
    .filter((f) => isLinkShapedModelField(f))
    .map((f) => f.name);
  // Fallback to legacy CTA/Link detection when model parse finds nothing
  if (!linkFieldNames.length) {
    if (/\bname\s*:\s*["']CTA["']/.test(text)) linkFieldNames = ['CTA'];
    else if (/\bname\s*:\s*["']Link["']/.test(text)) linkFieldNames = ['Link'];
  }
  if (!linkFieldNames.length) return text;

  /** @type {string[]} */
  const seedTexts = [];
  if (info && typeof info === 'object') {
    const collect = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const n of node) collect(n);
        return;
      }
      const o = /** @type {Record<string, unknown>} */ (node);
      for (const [k, v] of Object.entries(o)) {
        if (/^(cta|link|primarycta|secondarycta)$/i.test(k.replace(/\s+/g, '')) && v && typeof v === 'object') {
          const t = String(/** @type {{ text?: unknown }} */ (v).text || '').trim();
          if (t) seedTexts.push(t);
        } else if (v && typeof v === 'object') {
          collect(v);
        }
      }
    };
    collect(info.suggestedFields);
    collect(info.repeats);
  }
  // Prefer ordered conversion/CTA action labels
  const actionLinks = collectOrderedActionLinksFromSectionInfo(info);
  for (const a of actionLinks) {
    if (a.text && !seedTexts.includes(a.text)) seedTexts.push(a.text);
  }

  const queues = buildOrderedAnchorHrefsFromHtml(sectionHtml || '');
  const map = buildAnchorHrefMapFromHtml(sectionHtml || '');
  const hrefLabels = buildHrefLabelMapFromHtml(sectionHtml || '');
  let injected = 0;
  let seedIdx = 0;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;
  const contentOpen = text.indexOf('{', contentMatch.index);
  if (contentOpen < 0) return text;
  const itemsMatch = text.slice(contentOpen).match(/\bitems\s*:\s*\[/);
  if (!itemsMatch || itemsMatch.index == null) return text;
  const itemsBracket = text.indexOf('[', contentOpen + itemsMatch.index);
  if (itemsBracket < 0) return text;

  const items = findTopLevelArrayObjects(text, itemsBracket);
  // Walk last→first so offsets stay valid while splicing into fields bodies.
  for (let ii = items.length - 1; ii >= 0; ii -= 1) {
    const { start, closeBrace } = items[ii];
    const body = text.slice(start + 1, closeBrace);
    const hits = findTopLevelObjectKeyHits(body);
    const fieldsHit = hits.find((h) => h.key === 'fields');
    if (!fieldsHit) continue;

    const fieldsRelOpen = body.indexOf('{', fieldsHit.start);
    if (fieldsRelOpen < 0) continue;
    const fieldsOpen = start + 1 + fieldsRelOpen;
    const fieldsAfter = skipObjectOrValue(text, fieldsOpen);
    let fieldsClose = fieldsAfter - 1;
    while (fieldsClose > fieldsOpen && text[fieldsClose] !== '}') fieldsClose -= 1;
    if (text[fieldsClose] !== '}') continue;

    let fieldsInner = text.slice(fieldsOpen + 1, fieldsClose);
    // Only top-level fields keys count — nested Image.Link must not suppress inject.
    const fieldKeys = new Set(findTopLevelObjectKeyHits(fieldsInner).map((h) => h.key));
    if (
      !['Title', 'Heading', 'Description', 'Image', 'Category', 'Label', 'Value', 'Subtitle', 'Headline', 'Eyebrow'].some(
        (k) => fieldKeys.has(k),
      )
    ) {
      continue;
    }

    /** @type {string[]} */
    const additions = [];
    for (const linkFieldName of linkFieldNames) {
      if (fieldKeys.has(linkFieldName)) {
        seedIdx += 1;
        continue;
      }

      let label = seedTexts[seedIdx] || '';
      seedIdx += 1;
      let href = label ? resolveHrefForLinkText(map, label, queues) : null;
      if (!href && actionLinks[seedIdx - 1]) {
        href = actionLinks[seedIdx - 1].url;
        if (!label) label = actionLinks[seedIdx - 1].text;
      }
      if (!href && queues.size) {
        for (const [, q] of queues) {
          if (q.length) {
            href = q.shift();
            break;
          }
        }
      }
      if (!href) href = '/';
      if (!label) {
        label = hrefLabels.get(normalizeHrefKey(href)) || '';
      }
      // Never invent placeholder CTA seeds when HTML/info had no href.
      if (!label || isPlaceholderLinkUrl(href)) {
        continue;
      }

      const keyLit = /\s/.test(linkFieldName)
        ? JSON.stringify(linkFieldName)
        : linkFieldName;
      additions.push(
        `${keyLit}: { text: ${JSON.stringify(label)}, url: ${JSON.stringify(href)} }`,
      );
      fieldKeys.add(linkFieldName);
    }

    if (!additions.length) continue;
    const trimmed = fieldsInner.trimEnd().replace(/,\s*$/, '');
    const seed = `${trimmed}${trimmed ? ',\n          ' : ''}${additions.join(',\n          ')}\n        `;
    text = text.slice(0, fieldsOpen + 1) + `\n          ${seed}` + text.slice(fieldsClose);
    injected += additions.length;
  }

  if (injected > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: injected ${injected} missing Link/CTA seed(s) from HTML/info`,
    );
  }
  return text;
}

/**
 * When a metric Unit field exists and some/all Unit seeds are empty (`""` from
 * empty `<span></span>`), clean seeds / optionally drop Unit:
 * - **all empty** → drop Unit from model + seeds
 * - **mixed** + primary `Number` (styled unit span) → keep Unit field; omit empty Unit seeds
 * - **mixed** + primary `Value` (one visual string) → merge non-empty units into Value; drop Unit
 * Primary metric keys: Value | Number | Statistic | Metric | Count.
 * @param {string} source
 */
export function collapseEmptyMetricUnitFields(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\bname\s*:\s*["']Unit["']/.test(text)) return text;

  const primaryNames = ['Value', 'Number', 'Statistic', 'Metric', 'Count'];
  const hasPrimary = primaryNames.some((n) =>
    new RegExp(`\\bname\\s*:\\s*["']${n}["']`).test(text),
  );
  if (!hasPrimary) return text;

  const prefersNumberSplit = /\bname\s*:\s*["']Number["']/.test(text);

  // Collect Unit seed values
  const unitVals = [...text.matchAll(/\bUnit\s*:\s*(["'])((?:\\.|(?!\1)[^\\])*)\1/g)].map(
    (m) => m[2].trim(),
  );
  if (!unitVals.length) return text;
  const anyEmpty = unitVals.some((u) => !u);
  const allEmpty = unitVals.every((u) => !u);
  if (!anyEmpty) return text;

  // Number + optional Unit (GlobalStatistic): keep Unit when any card has text;
  // only strip empty Unit: "" seeds so emit does not write Value: "".
  if (prefersNumberSplit && !allEmpty) {
    const before = text;
    text = omitEmptyUnitSeeds(text);
    if (text !== before) {
      fixupWarn(
        '  ⚠ Codegen fixup: omitted empty Unit: "" metric seeds (keep Unit field for non-empty cards)',
      );
    }
    return text;
  }

  // Value-style (or all-empty Unit): collapse Unit away; merge leftover unit text into primary
  const primaryAlt = primaryNames.join('|');
  text = text.replace(
    new RegExp(
      `\\b(${primaryAlt})\\s*:\\s*(["'])((?:\\\\.|(?!\\2)[^\\\\])*)\\2\\s*,\\s*Unit\\s*:\\s*(["'])((?:\\\\.|(?!\\4)[^\\\\])*)\\4`,
      'g',
    ),
    (full, primaryKey, q1, value, q3, unit) => {
      const u = String(unit || '').trim();
      const v = String(value || '').trim();
      if (!u) return `${primaryKey}: ${JSON.stringify(v)}`;
      if (/^\d[\d\s.]*$/.test(v)) {
        return `${primaryKey}: ${JSON.stringify(`${v} ${u}`)}`;
      }
      return `${primaryKey}: ${JSON.stringify(v)}`;
    },
  );

  // Drop Unit from model fields array
  text = text.replace(
    /,?\s*\{\s*name\s*:\s*["']Unit["']\s*,\s*type\s*:\s*["'][^"']+["']\s*\}/g,
    '',
  );
  // Drop leftover Unit: "…" seeds
  text = omitEmptyUnitSeeds(text);
  text = text.replace(/\s*,?\s*\bUnit\s*:\s*(["'])(?:\\.|(?!\1)[^\\])*\1\s*,?/g, '\n');

  fixupWarn(
    `  ⚠ Codegen fixup: collapsed empty/partial Unit metric fields into single primary (${allEmpty ? 'all empty' : 'mixed'})`,
  );
  return text;
}

/**
 * Remove `Unit: ""` / `Unit: ''` assignments from definition content seeds.
 * @param {string} source
 */
export function omitEmptyUnitSeeds(source) {
  return String(source || '')
    // Inline: `{ Number: "54", Unit: "", Title: "…" }`
    .replace(/,?\s*\bUnit\s*:\s*(["'])\1\s*,?/g, (full) =>
      full.trimStart().startsWith(',') && full.trimEnd().endsWith(',') ? ',' : '',
    )
    .replace(/\{\s*,/g, '{')
    .replace(/,\s*\}/g, '}');
}

/**
 * Collect `{ name, type }` field names from a named model template block
 * (`itemTemplate` or `childItemTemplate`) only — not merged across both.
 * @param {string} source
 * @param {'itemTemplate'|'childItemTemplate'} key
 * @returns {Set<string>}
 */
export function collectFieldNamesFromTemplateBlock(source, key) {
  const text = String(source || '');
  const names = new Set();
  const re = new RegExp(`\\b${key}\\s*:\\s*\\{`);
  const m = re.exec(text);
  if (!m) return names;
  const openIdx = m.index + m[0].length - 1;
  const closeIdx = findMatchingBrace(text, openIdx);
  if (closeIdx < 0) return names;
  const block = text.slice(openIdx, closeIdx + 1);
  const fieldRe =
    /\{\s*name\s*:\s*(["'])([^"']+)\1\s*,\s*type\s*:\s*(["'])([^"']+)\3/g;
  let fm;
  while ((fm = fieldRe.exec(block))) {
    const name = fm[2].trim();
    if (name) names.add(name);
  }
  return names;
}

/**
 * True when definition declares placeholders with at least one allowedControls entry
 * (composite parent — children are separate packages).
 * @param {string} source
 */
export function definitionHasPlaceholderAllowedControls(source) {
  const text = String(source || '');
  const m = /\bplaceholders\s*:\s*\[/.exec(text);
  if (!m) return false;
  const openIdx = m.index + m[0].length - 1;
  const closeIdx = findMatchingBracket(text, openIdx);
  if (closeIdx < 0) return false;
  const body = text.slice(openIdx, closeIdx + 1);
  if (/^\s*\[\s*\]\s*$/.test(body)) return false;
  return /allowedControls\s*:\s*\[\s*["'][^"']+["']/.test(body);
}

/**
 * AI sometimes emits illegal `itemTemplate.children: { itemTemplate: … }`
 * (not in DataItemTemplateDef). Rewrite to nested `childItemTemplate` so
 * {@link hoistNestedChildItemTemplate} can lift it to model level.
 * @param {string} source
 */
export function rewriteItemTemplateChildrenToChildItemTemplate(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const itemMatch = /\bitemTemplate\s*:\s*\{/.exec(text);
  if (!itemMatch) return text;
  const itemOpen = itemMatch.index + itemMatch[0].length - 1;
  const itemClose = findMatchingBrace(text, itemOpen);
  if (itemClose < 0) return text;
  const itemBody = text.slice(itemOpen, itemClose + 1);
  const childrenKey = /\bchildren\s*:\s*\{/.exec(itemBody);
  if (!childrenKey || childrenKey.index == null) return text;
  const absChildrenKey = itemOpen + childrenKey.index;
  const childrenOpen = absChildrenKey + childrenKey[0].length - 1;
  const childrenClose = findMatchingBrace(text, childrenOpen);
  if (childrenClose < 0) return text;
  const childrenBody = text.slice(childrenOpen, childrenClose + 1);
  const nestedItem = /\bitemTemplate\s*:\s*\{/.exec(childrenBody);
  if (!nestedItem || nestedItem.index == null) return text;
  const nestedOpen =
    childrenOpen + nestedItem.index + nestedItem[0].length - 1;
  const nestedClose = findMatchingBrace(text, nestedOpen);
  if (nestedClose < 0) return text;
  const nestedBlock = text.slice(
    childrenOpen + nestedItem.index,
    nestedClose + 1,
  );
  // Replace `children: { itemTemplate: {…} }` with `childItemTemplate: {…}`
  let absEnd = childrenClose + 1;
  while (absEnd < text.length && /[ \t]/.test(text[absEnd])) absEnd += 1;
  if (text[absEnd] === ',') absEnd += 1;
  while (absEnd < text.length && text[absEnd] === '\r') absEnd += 1;
  if (text[absEnd] === '\n') absEnd += 1;
  const replacement = nestedBlock.replace(
    /^\s*itemTemplate\s*:/,
    'childItemTemplate:',
  );
  let before = text.slice(0, absChildrenKey);
  let after = text.slice(absEnd);
  before = before.replace(/,\s*$/, '');
  after = after.replace(/^\s*,/, '');
  const needsCommaBefore = /[:,]\s*$/.test(before) || /\{\s*$/.test(before);
  const insert = needsCommaBefore
    ? `\n      ${replacement}`
    : `,\n      ${replacement}`;
  // Prefer trailing comma after insert when more props follow
  const nextNeedsComma = /^\s*[A-Za-z_]/.test(after);
  text =
    before +
    insert +
    (nextNeedsComma && !replacement.trimEnd().endsWith(',') ? ',' : '') +
    after;
  fixupWarn(
    '  ⚠ Codegen fixup: rewrote itemTemplate.children → childItemTemplate (DataItemTemplateDef has no children)',
  );
  return text;
}

/**
 * AI sometimes nests `childItemTemplate` inside `itemTemplate`. Emit only reads
 * `model.childItemTemplate` — hoist the nested block up to model level.
 * @param {string} source
 */
export function hoistNestedChildItemTemplate(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const itemMatch = /\bitemTemplate\s*:\s*\{/.exec(text);
  if (!itemMatch) return text;
  const itemOpen = itemMatch.index + itemMatch[0].length - 1;
  const itemClose = findMatchingBrace(text, itemOpen);
  if (itemClose < 0) return text;
  const itemBody = text.slice(itemOpen, itemClose + 1);
  const nested = /\bchildItemTemplate\s*:\s*\{/.exec(itemBody);
  if (!nested || nested.index == null) return text;
  const afterItem = text.slice(itemClose + 1, itemClose + 240);
  const hasSibling = /^\s*,?\s*\n?\s*childItemTemplate\s*:/.test(afterItem);
  const absKeyStart = itemOpen + nested.index;
  const absOpen = absKeyStart + nested[0].length - 1;
  const absClose = findMatchingBrace(text, absOpen);
  if (absClose < 0) return text;
  let absEnd = absClose + 1;
  while (absEnd < text.length && /[ \t]/.test(text[absEnd])) absEnd += 1;
  if (text[absEnd] === ',') absEnd += 1;
  while (absEnd < text.length && text[absEnd] === '\r') absEnd += 1;
  if (text[absEnd] === '\n') absEnd += 1;
  const block = text.slice(absKeyStart, absClose + 1).replace(/,?\s*$/, '');
  // Local cleanup only around the excision — never strip commas file-wide.
  let before = text.slice(0, absKeyStart);
  let after = text.slice(absEnd);
  before = before.replace(/,\s*$/, '');
  after = after.replace(/^\s*,/, '');
  text = `${before}${after}`;
  if (hasSibling) {
    fixupWarn(
      '  ⚠ Codegen fixup: removed nested childItemTemplate inside itemTemplate (sibling already present)',
    );
    return text;
  }
  const itemMatch2 = /\bitemTemplate\s*:\s*\{/.exec(text);
  if (!itemMatch2) return text;
  const itemOpen2 = itemMatch2.index + itemMatch2[0].length - 1;
  const itemClose2 = findMatchingBrace(text, itemOpen2);
  if (itemClose2 < 0) return text;
  // Insert as model sibling after `itemTemplate: {…}` — if a trailing comma
  // already follows the closing brace, place the block *after* that comma
  // (inserting before it left `}\nchildItemTemplate` with the comma orphaned).
  let insertAt = itemClose2 + 1;
  while (insertAt < text.length && /[ \t]/.test(text[insertAt])) insertAt += 1;
  if (text[insertAt] === ',') {
    insertAt += 1;
    text =
      text.slice(0, insertAt) + `\n    ${block}` + text.slice(insertAt);
  } else {
    text =
      text.slice(0, insertAt) + `,\n    ${block}` + text.slice(insertAt);
  }
  fixupWarn(
    '  ⚠ Codegen fixup: hoisted childItemTemplate out of itemTemplate → model.childItemTemplate',
  );
  return text;
}

/**
 * Placeholder composites must not declare model.childItemTemplate — that template
 * is only for same-definition nested content.items[].children (FAQ / link lists).
 * @param {string} source
 */
export function stripCompositeChildItemTemplate(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!definitionHasPlaceholderAllowedControls(text)) return text;
  const m = /\bchildItemTemplate\s*:\s*\{/.exec(text);
  if (!m) return text;
  const keyStart = m.index;
  const openIdx = keyStart + m[0].length - 1;
  const closeIdx = findMatchingBrace(text, openIdx);
  if (closeIdx < 0) return text;
  let end = closeIdx + 1;
  while (end < text.length && /[ \t]/.test(text[end])) end += 1;
  if (text[end] === ',') end += 1;
  while (end < text.length && text[end] === '\r') end += 1;
  if (text[end] === '\n') end += 1;
  let start = keyStart;
  // Drop a blank line left behind when the block sat on its own lines.
  text = text.slice(0, start) + text.slice(end);
  text = text.replace(/,\s*,/g, ',');
  fixupWarn(
    '  ⚠ Codegen fixup: stripped childItemTemplate (composite uses placeholder children — seeds live on child packages)',
  );
  return text;
}

/**
 * Drop content.items[].fields (and nested children[].fields) keys that are not
 * declared on the matching itemTemplate / childItemTemplate.
 * @param {string} source
 */
export function stripOrphanContentFieldSeeds(source) {
  const text = String(source || '');
  if (!text.trim()) return text;

  const itemNames = collectFieldNamesFromTemplateBlock(text, 'itemTemplate');
  const childNames = collectFieldNamesFromTemplateBlock(text, 'childItemTemplate');
  const itemNorm = new Map(
    [...itemNames].map((n) => [normalizeSeedFieldKey(n), n]),
  );
  const childNorm = new Map(
    [...childNames].map((n) => [normalizeSeedFieldKey(n), n]),
  );

  const contentMatch = /\bcontent\s*:\s*\{/.exec(text);
  if (!contentMatch) return text;
  const contentOpen = contentMatch.index + contentMatch[0].length - 1;
  const contentClose = findMatchingBrace(text, contentOpen);
  if (contentClose < 0) return text;

  /** @param {string} s @param {number} openIdx */
  const endOfObject = (s, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        const q = ch;
        i += 1;
        while (i < s.length) {
          if (s[i] === '\\') {
            i += 2;
            continue;
          }
          if (s[i] === q) break;
          i += 1;
        }
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  let out = '';
  let last = 0;
  let stripped = 0;
  const re = /\bfields\s*:\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index < contentOpen || m.index > contentClose) continue;
    const openBrace = m.index + m[0].length - 1;
    const close = endOfObject(text, openBrace);
    if (close < 0) break;
    const inChildren = isFieldsBlockInsideChildrenArray(
      text,
      contentOpen,
      m.index,
    );
    const allowedNorm = inChildren
      ? childNorm.size > 0
        ? childNorm
        : itemNorm
      : itemNorm;
    out += text.slice(last, openBrace + 1);
    const body = text.slice(openBrace + 1, close);
    out += stripDisallowedTopLevelFieldProps(body, allowedNorm, () => {
      stripped += 1;
    });
    out += '}';
    last = close + 1;
    re.lastIndex = close + 1;
  }
  out += text.slice(last);

  if (stripped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: stripped ${stripped} orphan content field seed(s) not on itemTemplate/childItemTemplate`,
    );
  }
  return out;
}

/**
 * @param {string} text
 * @param {number} contentOpen
 * @param {number} fieldsIdx
 */
function isFieldsBlockInsideChildrenArray(text, contentOpen, fieldsIdx) {
  const slice = text.slice(contentOpen, fieldsIdx);
  let lastChildrenRel = -1;
  const re = /\bchildren\s*:\s*\[/g;
  let m;
  while ((m = re.exec(slice))) lastChildrenRel = m.index;
  if (lastChildrenRel < 0) return false;
  const absOpen =
    contentOpen + lastChildrenRel + slice.slice(lastChildrenRel).indexOf('[');
  const close = findMatchingBracket(text, absOpen);
  return close > fieldsIdx;
}

/**
 * @param {string} body
 * @param {Map<string, string>} allowedNorm Map of normalizeSeedFieldKey → canonical name
 * @param {() => void} [onStrip]
 */
function stripDisallowedTopLevelFieldProps(body, allowedNorm, onStrip) {
  let depth = 0;
  let i = 0;
  let out = '';
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < body.length) {
        if (body[j] === '\\') {
          j += 2;
          continue;
        }
        if (body[j] === q) {
          j += 1;
          break;
        }
        j += 1;
      }
      out += body.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      out += ch;
      i += 1;
      continue;
    }
    if (depth === 0) {
      const rest = body.slice(i);
      // Only match a property key at a prop boundary (start / after comma).
      const keyMatch = rest.match(
        /^(\s*)((?:["'][^"']+["']|[A-Za-z_][\w]*))\s*:/,
      );
      if (keyMatch) {
        const rawKey = keyMatch[2].replace(/^["']|["']$/g, '').trim();
        const norm = normalizeSeedFieldKey(rawKey);
        if (!allowedNorm.has(norm)) {
          // Skip entire property value
          let j = i + keyMatch[0].length;
          while (j < body.length && /\s/.test(body[j])) j += 1;
          if (body[j] === '"' || body[j] === "'") {
            const q = body[j];
            j += 1;
            while (j < body.length) {
              if (body[j] === '\\') {
                j += 2;
                continue;
              }
              if (body[j] === q) {
                j += 1;
                break;
              }
              j += 1;
            }
          } else if (body[j] === '{') {
            const close = findMatchingBrace(body, j);
            j = close >= 0 ? close + 1 : body.length;
          } else if (body[j] === '[') {
            const close = findMatchingBracket(body, j);
            j = close >= 0 ? close + 1 : body.length;
          } else {
            while (
              j < body.length &&
              body[j] !== ',' &&
              body[j] !== '}'
            ) {
              j += 1;
            }
          }
          while (j < body.length && /\s/.test(body[j])) j += 1;
          if (body[j] === ',') j += 1;
          onStrip?.();
          if (keyMatch[1].includes('\n')) out += '\n';
          i = j;
          continue;
        }
        // Allowed key — emit key+colon in one step so we never re-match mid-key.
        out += keyMatch[0];
        i += keyMatch[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out.replace(/,(\s*)$/g, '$1').replace(/,(\s*,)+/g, ',');
}

/**
 * @param {string} text
 * @param {number} openIdx index of `[`
 * @returns {number} index of matching `]`, or -1
 */
function findMatchingBracket(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (text[i] === q) break;
        i += 1;
      }
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Generic: omit top-level content `fields` entries whose value is exactly `""`.
 * Empty DOM companions (`<span></span>`, vacant promo labels) must not seed
 * `Field: ""` — leave the key absent so emit skips the field (truly empty).
 * Does not touch nested Link/Image object props (`url: ""` inside `{…}`).
 * @param {string} source
 */
export function omitEmptyStringContentFieldSeeds(source) {
  const text = String(source || '');
  if (!text.trim()) return text;

  /** @param {string} s @param {number} openIdx */
  const endOfObject = (s, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '"' || ch === "'") {
        const q = ch;
        i += 1;
        while (i < s.length) {
          if (s[i] === '\\') {
            i += 2;
            continue;
          }
          if (s[i] === q) break;
          i += 1;
        }
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const re = /\bfields\s*:\s*\{/g;
  let out = '';
  let last = 0;
  let stripped = 0;
  let m;
  while ((m = re.exec(text))) {
    const openBrace = m.index + m[0].length - 1;
    const close = endOfObject(text, openBrace);
    if (close < 0) break;
    out += text.slice(last, openBrace + 1);
    const body = text.slice(openBrace + 1, close);
    out += stripTopLevelEmptyStringProps(body, () => {
      stripped += 1;
    });
    out += '}';
    last = close + 1;
    re.lastIndex = close + 1;
  }
  out += text.slice(last);

  if (stripped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: omitted ${stripped} empty string content field seed(s) (leave absent, do not seed "")`,
    );
  }
  return out;
}

/**
 * @param {string} body
 * @param {() => void} [onStrip]
 */
function stripTopLevelEmptyStringProps(body, onStrip) {
  let depth = 0;
  let i = 0;
  let out = '';
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < body.length) {
        if (body[j] === '\\') {
          j += 2;
          continue;
        }
        if (body[j] === q) {
          j += 1;
          break;
        }
        j += 1;
      }
      out += body.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      out += ch;
      i += 1;
      continue;
    }
    if (depth === 0) {
      const rest = body.slice(i);
      const emptyProp = rest.match(
        /^(\s*)((?:["'][^"']+["']|[A-Za-z_][\w]*))\s*:\s*(["'])\3\s*,?/,
      );
      if (emptyProp) {
        onStrip?.();
        if (emptyProp[1].includes('\n')) out += '\n';
        i += emptyProp[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out.replace(/,(\s*)$/g, '$1').replace(/,(\s*,)+/g, ',');
}

/**
 * General Link / CTA / Link seeds must include url (DataLinkValue).
 * Last resort only when `allowSeedSalvage` is on: rewrites `{ text: "…" }` (no url)
 * → `{ text: "…", url: "/" }` after HTML fill. Prefer CONTRACT detect + AI retry
 * (`collectLinkSeedContractDiagnostics`) instead of this rewrite.
 */
export function ensureLinkSeedsHaveUrl(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /\b((?:Link|CTA)\s*:\s*\{)\s*text\s*:\s*(["'][^"']*["'])\s*(\})/g,
    '$1 text: $2, url: "/" $3',
  );
  // Also fill empty url: "" placeholders that HTML fill missed
  text = text.replace(
    /\b((?:Link|CTA)\s*:\s*\{[^}]*?\burl\s*:\s*)(["'])\2/g,
    '$1$2/$2',
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: added last-resort url: "/" to Link/CTA seeds still missing a real href (prefer section HTML / captured href)',
    );
  }
  return text;
}

/**
 * Icon Link Lists Icon field must be FA brands ids, not AXA icon-* CSS classes.
 */
export function normalizeIconLinkListIconSeeds(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  const map = {
    'icon-facebook': 'facebook',
    'icon-instagram': 'instagram',
    'icon-tiktok': 'tiktok',
    'icon-youtube': 'youtube',
    'icon-linkedin': 'linkedin',
    'icon-twitter': 'x-twitter',
    'icon-x': 'x-twitter',
  };
  for (const [from, to] of Object.entries(map)) {
    text = text.replaceAll(`Icon: "${from}"`, `Icon: "${to}"`);
    text = text.replaceAll(`Icon: '${from}'`, `Icon: '${to}'`);
  }
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: normalized Icon Link List Icon seeds to Font Awesome brands ids',
    );
  }
  return text;
}

/**
 * Strip optional (`?`) markers on Content SDK field properties inside
 * `interface Fields` / `type Fields = { … }`. Emptiness is runtime empty
 * `value`, not optional TypeScript properties.
 *
 * Does not touch GraphQL datasource / child shapes outside a Fields block.
 *
 * @param {string} source
 */
export function ensureRequiredFieldsProperties(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\b(?:interface|type)\s+Fields\b/.test(text)) return text;

  const before = text;
  const fieldType =
    '(?:TextField|RichTextField|ImageField|LinkField|Field\\s*<[^>]+>)';
  // Identifier or quoted key, then optional `?`, then Content SDK field type.
  const optionalPropRe = new RegExp(
    `((?:'[^']+'|"[^"]+"|[A-Za-z_][\\w]*))\\s*\\?\\s*:\\s*(${fieldType})\\b`,
    'g',
  );

  text = rewriteFieldsTypeBlocks(text, (body) =>
    body.replace(optionalPropRe, '$1: $2'),
  );

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: stripped optional (?) from Fields interface properties (required Content SDK fields)',
    );
  }
  return text;
}

/**
 * Bodies of each `interface Fields {…}` / `type Fields = {…}` (brace-matched).
 * @param {string} source
 * @returns {string[]}
 */
function extractFieldsTypeBodies(source) {
  const text = String(source || '');
  const starters = [
    /\binterface\s+Fields\s*\{/g,
    /\btype\s+Fields\s*=\s*\{/g,
  ];
  /** @type {string[]} */
  const bodies = [];
  for (const re of starters) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const openBrace = m.index + m[0].length - 1;
      const closeBrace = findMatchingBrace(text, openBrace);
      if (closeBrace < 0) continue;
      bodies.push(text.slice(openBrace + 1, closeBrace));
    }
  }
  return bodies;
}

/**
 * Apply `fn` to the body of each `interface Fields {…}` / `type Fields = {…}` block.
 * @param {string} source
 * @param {(body: string) => string} fn
 */
function rewriteFieldsTypeBlocks(source, fn) {
  let text = String(source || '');
  const starters = [
    /\binterface\s+Fields\s*\{/g,
    /\btype\s+Fields\s*=\s*\{/g,
  ];
  /** @type {{ open: number, close: number }[]} */
  const ranges = [];
  for (const re of starters) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const openBrace = m.index + m[0].length - 1;
      const closeBrace = findMatchingBrace(text, openBrace);
      if (closeBrace < 0) continue;
      ranges.push({ open: openBrace, close: closeBrace });
    }
  }
  // Rewrite from end so indexes stay valid.
  ranges.sort((a, b) => b.open - a.open);
  for (const { open, close } of ranges) {
    const body = text.slice(open + 1, close);
    const next = fn(body);
    if (next !== body) {
      text = text.slice(0, open + 1) + next + text.slice(close);
    }
  }
  return text;
}

/**
 * @param {string} text
 * @param {number} openIdx index of `{`
 * @returns {number} index of matching `}`, or -1
 */
function findMatchingBrace(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Optional `Link?` / `Image?` on `interface Fields` + boolean guards (`showLink`,
 * `videoHref`) do not narrow `fields.Link` for `<Link field={…}>` (TS2322).
 * Assign a local and pass that into Link/Image.
 *
 * @param {string} source
 */
export function narrowOptionalPropertyLinkFields(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;

  const optionalKeys = parseOptionalLinkImageFieldKeys(text);
  if (!optionalKeys.length) return text;

  for (const { key, access } of optionalKeys) {
    const localName = optionalFieldLocalName(key);
    const fieldAttrRe = new RegExp(
      `\\bfield=\\{${escapeRegExp(access)}\\}`,
    );
    const usedOnSitecoreField =
      new RegExp(
        `<(?:Link|Image)\\b[^>]*\\bfield=\\{${escapeRegExp(access)}\\}`,
        's',
      ).test(text) || fieldAttrRe.test(text);

    if (!usedOnSitecoreField && !new RegExp(escapeRegExp(access)).test(text)) {
      continue;
    }

    // const showLink = Boolean(fields.Link?.value?.href);
    const showBoolRe = new RegExp(
      `\\n\\s*const\\s+(show\\w+)\\s*=\\s*Boolean\\(\\s*${escapeRegExp(access)}\\?\\.value\\?\\.(href|src)\\s*\\);?`,
    );
    const showMatch = text.match(showBoolRe);
    if (showMatch) {
      const showName = showMatch[1];
      const prop = showMatch[2];
      text = text.replace(showBoolRe, '');
      text = text.replace(
        new RegExp(`\\b${showName}\\s*\\?`, 'g'),
        `${localName}?.value?.${prop} ?`,
      );
      text = text.replace(
        new RegExp(`\\{${showName}\\s*&&`, 'g'),
        `{${localName}?.value?.${prop} &&`,
      );
    }

    // const videoHref = typeof fields.Video?.value?.href === 'string' ? fields.Video.value.href : undefined;
    // (assignment may wrap after `=`)
    const hrefLocalRe = new RegExp(
      `\\n(\\s*)const\\s+(\\w+[Hh]ref)\\s*=\\s*typeof\\s+${escapeRegExp(access)}\\?\\.value\\?\\.href\\s*===\\s*['"]string['"]\\s*\\?\\s*${escapeRegExp(access)}(?:\\?\\.value\\.href|\\.value\\.href)\\s*:\\s*undefined;?`,
      's',
    );
    const hrefMatch = text.match(hrefLocalRe);
    if (hrefMatch) {
      const indent = hrefMatch[1];
      const hrefName = hrefMatch[2];
      text = text.replace(
        hrefLocalRe,
        `\n${indent}const ${localName} = ${access};\n${indent}const ${hrefName} =\n${indent}  typeof ${localName}?.value?.href === 'string' ? ${localName}.value.href : undefined;`,
      );
      // Prefer field-local + href for Link mount (narrows LinkField).
      // Covers `{videoHref ?`, `return videoHref ?`, `(videoHref ?`.
      if (
        !new RegExp(
          `${escapeRegExp(localName)}\\s*&&\\s*${escapeRegExp(hrefName)}\\s*\\?`,
        ).test(text)
      ) {
        text = text.replace(
          new RegExp(`\\b${escapeRegExp(hrefName)}\\s*\\?`, 'g'),
          `${localName} && ${hrefName} ?`,
        );
      }
    }

    if (!new RegExp(`\\bconst\\s+${localName}\\s*=`).test(text)) {
      text = injectOptionalFieldLocal(text, localName, access);
    }

    // field={fields.Link} → field={linkField} on Link/Image (and any remaining)
    text = text.replace(
      new RegExp(`\\bfield=\\{${escapeRegExp(access)}\\}`, 'g'),
      `field={${localName}}`,
    );

    // Remaining optional-chained reads on the property → local (value access)
    text = text.replace(
      new RegExp(`${escapeRegExp(access)}\\?\\.value`, 'g'),
      `${localName}?.value`,
    );
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: narrowed optional Fields Link/Image via local (boolean guards do not narrow for tsc)',
    );
  }
  return text;
}

/**
 * @param {string} source
 * @returns {{ key: string, access: string }[]}
 */
function parseOptionalLinkImageFieldKeys(source) {
  const block = String(source || '').match(/interface\s+Fields\s*\{([^}]*)\}/s);
  if (!block) return [];
  /** @type {{ key: string, access: string }[]} */
  const out = [];
  const re =
    /(?:^|\n)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][\w]*))\s*\?:\s*(?:LinkField|ImageField)\b/g;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    const key = m[1] || m[2] || m[3];
    if (!key) continue;
    const access = /^[A-Za-z_][\w]*$/.test(key)
      ? `fields.${key}`
      : `fields[${JSON.stringify(key)}]`;
    out.push({ key, access });
  }
  return out;
}

/**
 * @param {string} key
 */
function optionalFieldLocalName(key) {
  const camel = String(key || '')
    .replace(/[^\w]+([A-Za-z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
    .replace(/[^\w]/g, '');
  const base = camel || 'field';
  return /Field$/i.test(base) ? base : `${base}Field`;
}

/**
 * @param {string} text
 * @param {string} localName
 * @param {string} access
 */
function injectOptionalFieldLocal(text, localName, access) {
  if (new RegExp(`\\bconst\\s+${localName}\\s*=`).test(text)) return text;
  const decl = `const ${localName} = ${access};`;
  const afterFieldsDestructure = text.replace(
    /(const\s*\{\s*fields\s*\}\s*=\s*props\s*;)/,
    `$1\n  ${decl}`,
  );
  if (afterFieldsDestructure !== text) return afterFieldsDestructure;
  return text.replace(
    /(const\s+fields\s*=\s*props\.fields\s*;)/,
    `$1\n  ${decl}`,
  );
}

/**
 * @param {string} s
 */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `(linkField?.value?.href || isEditing) && <Link field={linkField}>` does not
 * narrow `LinkField | undefined` when `isEditing` is true (TS2322). Rewrite to
 * `linkField && (linkField.value?.href || isEditing)` for locals used as field=.
 * Same for Image `src`.
 * @param {string} source
 */
export function narrowIsEditingFieldGuards(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  // Collect locals passed to <Link|Image field={local}>
  /** @type {Set<string>} */
  const fieldLocals = new Set();
  for (const m of text.matchAll(
    /<(?:Link|Image)\b[^>]*\bfield=\{([A-Za-z_][\w]*)\}/gs,
  )) {
    fieldLocals.add(m[1]);
  }
  for (const name of fieldLocals) {
    const re = new RegExp(
      `\\{\\s*\\(\\s*${escapeRegExp(name)}\\?\\.value\\?\\.(href|src)\\s*\\|\\|\\s*isEditing\\s*\\)\\s*&&`,
      'g',
    );
    text = text.replace(
      re,
      (_full, prop) =>
        `{${name} && (${name}.value?.${prop} || isEditing) &&`,
    );
  }
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: narrowed (field?.value || isEditing) guards so Link/Image field is defined for tsc',
    );
  }
  return text;
}

/**
 * `getFieldValue(...) as LinkField | undefined` leaves TS2322 on `<Link field={x}>`.
 * Prefer empty-field fallbacks (same pattern as TextField empty seeds).
 * @param {string} source
 */
export function coerceGetFieldValueLinkImageLocals(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  // Match: const x = getFieldValue(...) as LinkField | undefined;
  // (cast may wrap across lines: `as\n  | LinkField\n  | undefined`)
  const linkCastRe =
    /const\s+([A-Za-z_][\w]*)\s*=\s*getFieldValue\(([^)]*)\)\s+as\s+\|?\s*LinkField\s*\|\s*undefined\s*;/gs;
  const imageCastRe =
    /const\s+([A-Za-z_][\w]*)\s*=\s*getFieldValue\(([^)]*)\)\s+as\s+\|?\s*ImageField\s*\|\s*undefined\s*;/gs;

  let injectedLink = false;
  let injectedImage = false;
  text = text.replace(linkCastRe, (_full, name, gfArg) => {
    injectedLink = true;
    return `const ${name} = getFieldValue(${gfArg}) ?? emptyLinkField;`;
  });
  text = text.replace(imageCastRe, (_full, name, gfArg) => {
    injectedImage = true;
    return `const ${name} = getFieldValue(${gfArg}) ?? emptyImageField;`;
  });

  if (injectedLink && !/\bconst\s+emptyLinkField\b/.test(text)) {
    const decl =
      "const emptyLinkField = { value: { href: '', text: '', linktype: 'external' } } as LinkField;";
    text = injectEmptyFieldConst(text, decl, 'emptyLinkField');
  }
  if (injectedImage && !/\bconst\s+emptyImageField\b/.test(text)) {
    const decl =
      "const emptyImageField = { value: { src: '', alt: '' } } as ImageField;";
    text = injectEmptyFieldConst(text, decl, 'emptyImageField');
  }

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: getFieldValue Link/Image locals use empty-field fallback (not LinkField | undefined)',
    );
  }
  return text;
}

/**
 * @param {string} text
 * @param {string} decl
 * @param {string} name
 */
function injectEmptyFieldConst(text, decl, name) {
  if (new RegExp(`\\bconst\\s+${escapeRegExp(name)}\\b`).test(text)) return text;
  // Prefer next to existing emptyTextField / emptyRichTextField
  const afterEmpty = text.replace(
    /(const\s+empty(?:Text|RichText)Field\s*=\s*[^;]+;)/,
    `$1\n${decl}`,
  );
  if (afterEmpty !== text) return afterEmpty;
  // Else before first export const Default
  const beforeExport = text.replace(
    /(export\s+const\s+Default\b)/,
    `${decl}\n\n$1`,
  );
  if (beforeExport !== text) return beforeExport;
  return `${decl}\n${text}`;
}

/**
 * `<Link field={getFieldValue(...)} />` / `field={….?.link}` is `LinkField | undefined`.
 * Rewrite common map → ( <Link field={getFieldValue(...)} /> ) shapes; wrap
 * `field={props.fields?.X}` / `field={fields?.X}` on `<Link>` and `<Image>`.
 * Also narrow optional `Fields` properties (`Link?: LinkField`) used with boolean guards.
 */
export function ensureNarrowedLinkFields(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;

  // .map((child, i) => ( <Link … field={getFieldValue(...)} … /> ))
  text = text.replace(
    /\.map\(\((\w+)\s*,\s*(\w+)\)\s*=>\s*\(\s*<Link(\b[^>]*?)\bfield=\{getFieldValue\(([^)]+)\)\}([^>]*)\/>\s*\)\)/gs,
    (_full, item, idx, beforeAttrs, gfArg, afterAttrs) =>
      `.map((${item}, ${idx}) => {\n        const linkField = getFieldValue(${gfArg});\n        if (!linkField) return null;\n        return <Link${beforeAttrs}field={linkField}${afterAttrs}/>;\n      })`,
  );

  // .map((child, i) => ( <Link … field={child.field?.link} … /> ))
  text = text.replace(
    /\.map\(\((\w+)\s*,\s*(\w+)\)\s*=>\s*\(\s*<Link(\b[^>]*?)\bfield=\{(\w+)\.field\?\.link\}([^>]*)\/>\s*\)\)/gs,
    (_full, item, idx, beforeAttrs, itemRef, afterAttrs) => {
      if (item !== itemRef) return _full;
      return `.map((${item}, ${idx}) => {\n        const linkField = ${item}.field?.link;\n        if (!linkField) return null;\n        return <Link${beforeAttrs}field={linkField}${afterAttrs}/>;\n      })`;
    },
  );

  // .map((item, i) => ( <Link … field={item.fields?.Link} … /> ))
  text = text.replace(
    /\.map\(\((\w+)\s*,\s*(\w+)\)\s*=>\s*\(\s*<li[^>]*>\s*<Link(\b[^>]*?)\bfield=\{(\w+)\.fields\?\.Link\}([^>]*)\/>\s*<\/li>\s*\)\)/gs,
    (_full, item, idx, beforeAttrs, itemRef, afterAttrs) => {
      if (item !== itemRef) return _full;
      return `.map((${item}, ${idx}) => {\n        const linkField = ${item}.fields?.Link;\n        if (!linkField) return null;\n        return (\n        <li key={${item}.id || ${item}.name || ${idx}}>\n          <Link${beforeAttrs}field={linkField}${afterAttrs}/>\n        </li>\n      );\n      })`;
    },
  );
  text = text.replace(
    /\.map\(\((\w+)\s*,\s*(\w+)\)\s*=>\s*\(\s*<Link(\b[^>]*?)\bfield=\{(\w+)\.fields\?\.Link\}([^>]*)\/>\s*\)\)/gs,
    (_full, item, idx, beforeAttrs, itemRef, afterAttrs) => {
      if (item !== itemRef) return _full;
      return `.map((${item}, ${idx}) => {\n        const linkField = ${item}.fields?.Link;\n        if (!linkField) return null;\n        return <Link${beforeAttrs}field={linkField}${afterAttrs}/>;\n      })`;
    },
  );

  text = coerceGetFieldValueLinkImageLocals(text);
  text = narrowIsEditingFieldGuards(text);
  text = narrowOptionalPropertyLinkFields(text);
  text = wrapOptionalSitecoreFieldComponents(text);

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: narrowed optional Link/Image field before Sitecore field component',
    );
  }

  if (
    /<Link\b[^>]*\bfield=\{getFieldValue\([^)]+\)\}/s.test(text) ||
    /<Link\b[^>]*\bfield=\{[^}]*\?\.link\}/s.test(text)
  ) {
    fixupWarn(
      '  ⚠ Codegen fixup: <Link field={…}> may be undefined — assign to a local, early-return if missing, then pass the narrowed field',
    );
  }
  return text;
}

/**
 * Layout JSON often omits checkbox/text fields. Unguarded `.value` throws at export.
 * `fields["Open In New Window"].value` → `fields["Open In New Window"]?.value`
 * `fields.Link.value` → `fields.Link?.value` (idempotent if `?.value` already present).
 * @param {string} source
 */
export function ensureOptionalFieldValueAccess(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /\b((?:props\.)?fields\[[^\]]+\])\.value\b/g,
    '$1?.value',
  );
  text = text.replace(
    /\b((?:props\.)?fields\.\w+)\.value\b/g,
    '$1?.value',
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: optional-chained .value on fields (layout may omit the field)',
    );
  }
  return text;
}

const OPTIONAL_FIELD_ATTR =
  /\bfield=\{((?:props\.)?fields)\?\.([A-Za-z_][\w]*|\[[^\]]+\])\}/;

/** `field={item.fields?.Link}` / `field={row.fields?.["Card Link"]}` */
const OPTIONAL_NESTED_FIELDS_ATTR =
  /\bfield=\{(\w+)\.fields\?\.([A-Za-z_][\w]*|\[[^\]]+\])\}/;

/**
 * Wrap `<Link>` / `<Image>` that use `field={props.fields?.X}` (or `fields?.X`)
 * so tsc sees a defined field.
 * @param {string} source
 */
export function wrapOptionalSitecoreFieldComponents(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  for (const tag of ['Link', 'Image']) {
    text = wrapOptionalFieldTag(text, tag);
    text = wrapOptionalNestedFieldsTag(text, tag);
  }
  return text;
}

/**
 * Wrap `<Link field={item.fields?.Link} />` so optional nested Link is guarded.
 * @param {string} text
 * @param {string} tag
 */
function wrapOptionalNestedFieldsTag(text, tag) {
  const openRe = new RegExp(`<${tag}\\b`, 'g');
  /** @type {number[]} */
  const starts = [];
  let m;
  while ((m = openRe.exec(text)) !== null) starts.push(m.index);
  for (let s = starts.length - 1; s >= 0; s -= 1) {
    const start = starts[s];
    const end = findJsxElementEnd(text, start, tag);
    if (end < 0) continue;
    const el = text.slice(start, end);
    const attr = el.match(OPTIONAL_NESTED_FIELDS_ATTR);
    if (!attr) continue;
    const item = attr[1];
    const key = attr[2];
    const optionalExpr = `${item}.fields?.${key}`;
    const definedExpr = key.startsWith('[')
      ? `${item}.fields${key}`
      : `${item}.fields.${key}`;
    const nextEl = el.replace(OPTIONAL_NESTED_FIELDS_ATTR, `field={${definedExpr}}`);
    const wrapped = `{${optionalExpr} ? (\n        ${nextEl}\n      ) : null}`;
    text = text.slice(0, start) + wrapped + text.slice(end);
  }
  return text;
}

/**
 * @param {string} text
 * @param {string} tag
 */
function wrapOptionalFieldTag(text, tag) {
  const openRe = new RegExp(`<${tag}\\b`, 'g');
  /** @type {number[]} */
  const starts = [];
  let m;
  while ((m = openRe.exec(text)) !== null) starts.push(m.index);
  for (let s = starts.length - 1; s >= 0; s -= 1) {
    const start = starts[s];
    const end = findJsxElementEnd(text, start, tag);
    if (end < 0) continue;
    const el = text.slice(start, end);
    const attr = el.match(OPTIONAL_FIELD_ATTR);
    if (!attr) continue;
    const receiver = attr[1];
    const key = attr[2];
    const optionalExpr = `${receiver}?.${key}`;
    const definedExpr = key.startsWith('[')
      ? `${receiver}${key}`
      : `${receiver}.${key}`;
    const nextEl = el.replace(OPTIONAL_FIELD_ATTR, `field={${definedExpr}}`);
    const wrapped = `{${optionalExpr} ? (\n        ${nextEl}\n      ) : null}`;
    text = text.slice(0, start) + wrapped + text.slice(end);
  }
  return text;
}

/**
 * @param {string} text
 * @param {number} start index of '<'
 * @param {string} tag
 */
function findJsxElementEnd(text, start, tag) {
  const head = text.slice(start).match(new RegExp(`^<${tag}\\b`));
  if (!head) return -1;
  let i = start + head[0].length;
  let quote = null;
  let brace = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      brace += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      brace = Math.max(0, brace - 1);
      i += 1;
      continue;
    }
    if (brace > 0) {
      i += 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '>') return i + 2;
    if (ch === '>') {
      i += 1;
      const close = `</${tag}>`;
      const idx = text.indexOf(close, i);
      return idx < 0 ? -1 : idx + close.length;
    }
    i += 1;
  }
  return -1;
}

/**
 * Add `list-none` on `<ul>` / `<ol>` that wrap bare `<li>` without bullets contract.
 * @param {string} source
 * @returns {string}
 */
export function ensureListNoneOnLists(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const hasBareLi =
    /<li\b(?![^>]*\blist-none\b)[^>]*>/.test(text) &&
    !/<ul\b[^>]*\blist-none\b/.test(text) &&
    !/<ol\b[^>]*\blist-none\b/.test(text);
  if (!hasBareLi) return text;
  const before = text;
  text = text.replace(/<(ul|ol)(\s[^>]*)?>/gi, (full, tag, attrs = '') => {
    const a = attrs || '';
    if (/\blist-none\b/.test(a)) return full;
    if (/\bclassName\s*=\s*\{([^}]*)\}/.test(a)) {
      return full.replace(/\bclassName\s*=\s*\{([^}]*)\}/, (_m, expr) => {
        const patched = expr.replace(/(['"`])([^'"`]*)\1/g, (sm, q, cls) =>
          /\blist-none\b/.test(cls) ? sm : `${q}list-none ${cls}${q}`,
        );
        return `className={${patched}}`;
      });
    }
    if (/\bclassName\s*=\s*["']([^"']*)["']/.test(a)) {
      return full.replace(
        /\bclassName\s*=\s*(["'])([^"']*)\1/,
        (_m, q, cls) => `className=${q}list-none ${cls}${q}`,
      );
    }
    const insert = a && a.trim() ? a : '';
    return `<${tag}${insert} className="list-none">`;
  });
  // Fragment / bare <li> roots (no wrapping ul) — put list-none on the li itself.
  if (
    /<li\b(?![^>]*\blist-none\b)[^>]*>/.test(text) &&
    !/<ul\b/i.test(text) &&
    !/<ol\b/i.test(text)
  ) {
    text = text.replace(/<li(\s[^>]*)?>/gi, (full, attrs = '') => {
      const a = attrs || '';
      if (/\blist-none\b/.test(a)) return full;
      if (/\bclassName\s*=\s*["']([^"']*)["']/.test(a)) {
        return full.replace(
          /\bclassName\s*=\s*(["'])([^"']*)\1/,
          (_m, q, cls) => `className=${q}list-none ${cls}${q}`,
        );
      }
      if (/\bclassName\s*=/.test(a)) return full;
      const insert = a && a.trim() ? a : '';
      return `<li${insert} className="list-none">`;
    });
  }
  if (text !== before) {
    fixupWarn('  ⚠ Codegen fixup: added list-none on ul/ol/li (bullet-free chrome)');
  }
  return text;
}

/**
 * Narrow companion chrome Props away from ComponentWithContextProps / ComponentProps
 * when the client only needs `{ fields, children? }` (map-entry passes fields only).
 * @param {string} source
 * @returns {string}
 */
export function narrowCompanionChromePropsType(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (
    !/\bComponentWithContextProps\b/.test(text) &&
    !/\bComponentProps\b/.test(text)
  ) {
    return text;
  }
  const before = text;
  // type Props = ComponentWithContextProps & { fields: …; children?: … };
  text = text.replace(
    /\btype\s+(\w+)\s*=\s*ComponentWithContextProps\s*&\s*(\{[\s\S]*?\})\s*;/g,
    (full, name, shape) => {
      if (!/\bfields\b/.test(shape)) return full;
      return `type ${name} = ${shape};`;
    },
  );
  text = text.replace(
    /\btype\s+(\w+)\s*=\s*ComponentProps\s*&\s*(\{[\s\S]*?\})\s*;/g,
    (full, name, shape) => {
      if (!/\bfields\b/.test(shape)) return full;
      return `type ${name} = ${shape};`;
    },
  );
  // Drop unused ComponentWithContextProps / ComponentProps imports from lib/component-props
  if (
    !/\bComponentWithContextProps\b/.test(text.replace(/^import\s.+;?\s*$/gm, ''))
  ) {
    text = text.replace(
      /^import\s+type\s*\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
      (full, named) => {
        const keep = named
          .split(',')
          .map((s) => s.trim())
          .filter(
            (s) =>
              s &&
              s !== 'ComponentWithContextProps' &&
              s !== 'ComponentProps',
          );
        if (!keep.length) return '';
        return `import type { ${keep.join(', ')} } from 'lib/component-props';`;
      },
    );
    text = text.replace(
      /^import\s*\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
      (full, named) => {
        const keep = named
          .split(',')
          .map((s) => s.trim())
          .filter(
            (s) =>
              s &&
              s !== 'ComponentWithContextProps' &&
              s !== 'ComponentProps',
          );
        if (!keep.length) return '';
        return `import { ${keep.join(', ')} } from 'lib/component-props';`;
      },
    );
  }
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: narrowed companion chrome Props to { fields, children? }',
    );
  }
  return text;
}

/**
 * Mechanical CONTRACT fix: never read fields.children — use getDatasource then
 * datasource?.children. Runs always-on before collect/AI.
 * @param {string} source
 * @returns {string}
 */
export function rewriteFieldsChildrenViaDatasource(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\bfields\??\.children\b/.test(text)) return text;

  const before = text;
  const dsBind = text.match(
    /\b(?:const|let|var)\s+(\w+)\s*=\s*getDatasource\s*(?:<[^>]*>)?\s*\(/,
  );
  let dsName = dsBind ? dsBind[1] : null;
  const hasGetDatasourceCall = /\bgetDatasource\s*[<(]/.test(text);

  if (!dsName) {
    if (hasGetDatasourceCall) {
      // getDatasource used but no binding we can reuse — leave fields.children
      // alone rather than inventing a conflicting name.
      return text;
    }
    dsName = 'datasource';
    const argExpr = inferGetDatasourceFieldsArg(text);
    const binding = `  const ${dsName} = getDatasource(${argExpr});\n`;
    const inserted = insertAtComponentBodyStart(text, binding);
    if (inserted !== text) {
      text = inserted;
    } else {
      // Fallback: inline getDatasource without a binding (still clears CONTRACT).
      text = text.replace(
        /\bprops\.fields\??\.children\b/g,
        'getDatasource(props.fields)?.children',
      );
      text = text.replace(
        /\bfields\??\.children\b/g,
        `getDatasource(${argExpr})?.children`,
      );
      if (!/\bfields\??\.children\b/.test(text)) {
        text = ensureGetDatasourceLibImport(text);
        if (text !== before) {
          fixupWarn(
            '  ⚠ Codegen fixup: fields.children → inline getDatasource(…).children',
          );
        }
        return text;
      }
      return before;
    }
  }

  text = text.replace(/\bprops\.fields\??\.children\b/g, `${dsName}?.children`);
  text = text.replace(/\bfields\??\.children\b/g, `${dsName}?.children`);

  if (/\bfields\??\.children\b/.test(text)) return before;

  text = ensureGetDatasourceLibImport(text);

  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: fields.children → getDatasource + datasource?.children',
    );
  }
  return text;
}

/**
 * @param {string} text
 * @returns {string}
 */
function inferGetDatasourceFieldsArg(text) {
  // Canonical chrome is `(props: Props)` + props.fields (unwrap at map-entry).
  if (/\(\s*props\s*(?::|,|\))/.test(text) || /\bprops\.fields\b/.test(text)) {
    return 'props.fields';
  }
  if (
    /export\s+const\s+Default\s*=\s*(?:async\s*)?\(\s*\{[^}]*\bfields\b/.test(
      text,
    ) ||
    /export\s+default\s+function\s+\w+\s*\(\s*\{[^}]*\bfields\b/.test(text) ||
    /function\s+\w+\s*\(\s*\{[^}]*\bfields\b/.test(text)
  ) {
    return 'fields';
  }
  if (/\bconst\s*\{\s*fields[\s,}]/.test(text)) return 'fields';
  return 'props.fields';
}

/**
 * Insert a statement right after the opening `{` of Default / default export chrome.
 * @param {string} text
 * @param {string} binding
 * @returns {string}
 */
function insertAtComponentBodyStart(text, binding) {
  const patterns = [
    /export\s+const\s+Default\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^{=;]+)?\s*=>\s*\{/,
    /export\s+const\s+Default\s*=\s*(?:async\s*)?\(\s*\{[^}]*\}\s*(?::\s*[^)]+)?\s*\)\s*(?::\s*[^{=;]+)?\s*=>\s*\{/,
    /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/,
    /export\s+default\s+function\s+\w+\s*\(\s*\{[^}]*\}\s*(?::\s*[^)]+)?\s*\)\s*(?::\s*[^{]+)?\s*\{/,
    /function\s+\w+\s*\(\s*\{[^}]*\}\s*(?::\s*[^)]+)?\s*\)\s*(?::\s*[^{]+)?\s*\{/,
    /(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(\s*\{[^}]*\}\s*(?::\s*[^)]+)?\s*\)\s*(?::\s*[^{=;]+)?\s*=>\s*\{/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m || m.index == null) continue;
    const at = m.index + m[0].length;
    return `${text.slice(0, at)}\n${binding}${text.slice(at)}`;
  }
  return text;
}

/**
 * Ensure `getDatasource` is a value import from lib/component-props.
 * @param {string} text
 * @returns {string}
 */
function ensureGetDatasourceLibImport(text) {
  const covered = new Set();
  for (const m of text.matchAll(
    /^import\s+(?!type\s)\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/gm,
  )) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/\s+as\s+\w+$/, '').trim();
      if (name) covered.add(name);
    }
  }
  if (covered.has('getDatasource')) return text;

  const propsImportRe =
    /^import\s+(?!type\s)\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/m;
  if (propsImportRe.test(text)) {
    return text.replace(propsImportRe, (full, named) => {
      const existing = named
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (existing.includes('getDatasource')) return full;
      return `import { ${[...existing, 'getDatasource'].join(', ')} } from 'lib/component-props';`;
    });
  }

  const importLine = `import { getDatasource } from 'lib/component-props';\n`;
  if (/^['"]use client['"];?\s*\n/.test(text)) {
    return text.replace(/^(['"]use client['"];?\s*\n+)/, `$1${importLine}`);
  }
  const lastImport = [...text.matchAll(/^import\s.+;?\s*$/gm)].pop();
  if (lastImport && lastImport.index != null) {
    const idx = lastImport.index + lastImport[0].length;
    return `${text.slice(0, idx)}\n${importLine}${text.slice(idx)}`;
  }
  return importLine + text.replace(/^\uFEFF/, '');
}

/**
 * getDatasource / getFieldValue must come from lib/component-props only.
 * @param {string} source
 */
export function rewriteGetDatasourceImportPath(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  /** @type {string[]} */
  const moved = [];
  /** @type {string[]} */
  const movedTypes = [];
  const LIB_ONLY = new Set([
    'getDatasource',
    'getFieldValue',
    'ComponentWithContextProps',
    'ComponentProps',
  ]);
  const stripHelpers = (fromMod, typeOnly) => {
    const typeKw = typeOnly ? 'type\\s+' : '';
    const re = new RegExp(
      `import\\s+${typeKw}\\{([^}]*)\\}\\s*from\\s*['"]${fromMod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*;?`,
      'g',
    );
    text = text.replace(re, (full, inner) => {
      const parts = inner
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const keep = [];
      for (const p of parts) {
        const base = p.replace(/\s+as\s+\w+$/, '').trim();
        if (LIB_ONLY.has(base)) {
          if (base === 'getDatasource' || base === 'getFieldValue') {
            moved.push(base);
          } else {
            movedTypes.push(base);
          }
        } else {
          keep.push(p);
        }
      }
      if (keep.length === parts.length) return full;
      if (!keep.length) return '';
      const kw = typeOnly ? 'type ' : '';
      return `import ${kw}{ ${keep.join(', ')} } from '${fromMod}';`;
    });
  };
  stripHelpers('@sitecore-content-sdk/nextjs', false);
  stripHelpers('@sitecore-content-sdk/nextjs', true);
  stripHelpers('lib/utils', false);
  const unique = [...new Set(moved)];
  const uniqueTypes = [...new Set(movedTypes)];
  if (!unique.length && !uniqueTypes.length) return text;

  if (unique.length) {
    const propsImportRe =
      /^import\s+(?!type\s)\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/m;
    if (propsImportRe.test(text)) {
      text = text.replace(propsImportRe, (full, named) => {
        const existing = named
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const missing = unique.filter((h) => !existing.includes(h));
        if (!missing.length) return full;
        return `import { ${[...existing, ...missing].join(', ')} } from 'lib/component-props';`;
      });
    } else {
      text =
        `import { ${unique.join(', ')} } from 'lib/component-props';\n` + text;
    }
  }
  if (uniqueTypes.length) {
    const typeImportRe =
      /^import\s+type\s*\{([^}]*)\}\s*from\s*['"]lib\/component-props['"];?\s*$/m;
    if (typeImportRe.test(text)) {
      text = text.replace(typeImportRe, (full, named) => {
        const existing = named
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const missing = uniqueTypes.filter((h) => !existing.includes(h));
        if (!missing.length) return full;
        return `import type { ${[...existing, ...missing].join(', ')} } from 'lib/component-props';`;
      });
    } else {
      text =
        `import type { ${uniqueTypes.join(', ')} } from 'lib/component-props';\n` +
        text;
    }
  }
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: getDatasource/getFieldValue/Component*Props → lib/component-props',
    );
  }
  return text;
}

export function rewriteCheckboxFieldType(source) {
  let text = String(source || '');
  if (!text.trim() || !/\bCheckboxField\b/.test(text)) return text;
  const before = text;

  text = text.replace(
    /import\s+(type\s+)?\{([^}]*)\}\s*from\s+['"]@sitecore-content-sdk\/nextjs['"]\s*;?/g,
    (full, typeKw, inner) => {
      const parts = inner
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const next = parts.filter((p) => !/\bCheckboxField\b/.test(p));
      if (next.length === parts.length) return full;
      if (!next.length) return '';
      const kw = typeKw || '';
      return `import ${kw}{ ${next.join(', ')} } from '@sitecore-content-sdk/nextjs';`;
    },
  );
  // Drop local aliases: type CheckboxField = Field<boolean>; / interface CheckboxField {…}
  text = text.replace(
    /^\s*(?:export\s+)?type\s+CheckboxField\s*=\s*Field\s*<\s*boolean\s*>\s*;?\s*$/gm,
    '',
  );
  text = text.replace(
    /^\s*(?:export\s+)?(?:type|interface)\s+CheckboxField\b[^{;=\n]*(?:=\s*Field\s*<\s*boolean\s*>\s*;|\{[\s\S]*?\})\s*$/gm,
    '',
  );
  text = text.replace(/\bCheckboxField\b/g, 'Field<boolean>');
  text = ensureTsxFieldTypeImports(text);
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: CheckboxField → Field<boolean> (SDK has no CheckboxField)',
    );
  }
  return text;
}

/**
 * Sitecore rendering GraphQL types already expose `personalization`.
 * A datasource field of that name fails publish ("field already exists").
 * @param {string} source
 */
export function renameReservedSitecoreFieldNames(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /(\{\s*name\s*:\s*)(["'])Personalization\2/g,
    '$1$2Personalization Label$2',
  );
  text = text.replace(
    /(^|[\s,{])Personalization(\s*:)/gm,
    (full, pre, colon, offset) => {
      const after = text.slice(offset + full.length, offset + full.length + 16);
      if (/^\s*Enabled\b/.test(after) || /^Label\b/.test(full.slice(pre.length))) {
        return full;
      }
      return `${pre}"Personalization Label"${colon}`;
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: renamed datasource field Personalization → Personalization Label (reserved on Sitecore renderings)',
    );
  }
  return text;
}

/**
 * @param {string} source
 */
export function renameReservedSitecoreFieldNamesInTsx(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /(^|[\s{])Personalization(\s*:\s*(?:TextField|RichTextField|Field))/gm,
    '$1"Personalization Label"$2',
  );
  text = text.replace(
    /\bfields\.Personalization\b(?!\s*Enabled)/g,
    'fields["Personalization Label"]',
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: TSX Personalization → fields["Personalization Label"]',
    );
  }
  return text;
}

/**
 * Component `content` must not include site-presentation `presentation` wiring.
 * @param {string} source
 */
export function stripContentPresentationFromDefinition(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (/\bkind\s*:\s*["']site-presentation["']/.test(text)) return text;

  const contentMatch = text.match(/\bcontent\s*:\s*\{/);
  if (!contentMatch || contentMatch.index == null) return text;
  const contentOpen = text.indexOf('{', contentMatch.index);
  if (contentOpen < 0) return text;

  let depth = 0;
  let i = contentOpen;
  let quote = null;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
      i += 1;
      continue;
    }
    if (depth === 1 && /^\bpresentation\s*:/.test(text.slice(i))) {
      const colon = text.indexOf(':', i);
      if (colon < 0) break;
      const valueEnd = skipObjectOrValue(text, colon + 1);
      text = text.slice(0, i) + text.slice(valueEnd);
      text = text.replace(/,\s*,/g, ',');
      fixupWarn(
        '  ⚠ Codegen fixup: removed content.presentation (belongs on site-presentation definition)',
      );
      return text;
    }
    i += 1;
  }
  return text;
}

/**
 * DOM string attrs must not take TextField.value / Image alt without a string coerce.
 */
export function warnLooseFieldValueStringAttrs(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  if (
    /\b(?:aria-label|placeholder|title)=\{(?![^}]*typeof)[^}]*\.value(?:\?\.alt)?[^}]*\}/.test(
      text,
    )
  ) {
    fixupWarn(
      '  ⚠ Codegen fixup: aria-label/placeholder/title used Field.value without typeof === "string" coerce',
    );
  }
}

/**
 * Coerce `aria-label={x?.value}` / `placeholder={x?.value || undefined}` to a
 * string-narrowed expression (Field.value may be string | number).
 * @param {string} source
 */
export function coerceLooseFieldValueStringAttrs(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /\b(aria-label|placeholder|title)=\{(\s*)([^}]+?)(\s*)\}/g,
    (full, attr, ws1, expr, ws2) => {
      const inner = String(expr || '').trim();
      if (!inner || /\btypeof\b/.test(inner)) return full;
      // title?.value / title?.value || undefined / foo.value
      const m = /^(?:([\w.?[\]]+?)\?\.value|([\w.?[\]]+?)\.value)(?:\s*\|\|\s*undefined)?$/.exec(
        inner,
      );
      if (!m) return full;
      const receiver = (m[1] || m[2] || '').replace(/\?$/, '');
      if (!receiver) return full;
      return `${attr}={${ws1}typeof ${receiver}?.value === 'string' ? ${receiver}.value : undefined${ws2}}`;
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: coerced aria-label/placeholder/title Field.value to typeof === "string"',
    );
  }
  return text;
}

/**
 * Safety net: flag main TSX that builds arrays of objects with JSX/`children`
 * and passes them into a companion `*.client` (RSC-unsafe / wrong composite model).
 */
export function warnClientJsxArrayProps(source) {
  const text = String(source || '');
  if (!text.trim()) return;
  const importsClient = /\bfrom\s+['"]\.\/[^'"]+\.client['"]/.test(text);
  if (!importsClient) return;

  // Array of objects that include JSX children: or children: <…>
  const hasJsxInArray =
    /\b(categories|items|cards|entries|sections|groups)\s*=\s*\[[\s\S]*?(children\s*:\s*<|<[A-Z][\w.]*)/.test(
      text,
    ) ||
    /\[[\s\S]*?\{\s*[\s\S]*?(children\s*:\s*<|<[A-Z][\w.]*)[\s\S]*?\}\s*,[\s\S]*?\]/.test(
      text,
    );

  if (hasJsxInArray) {
    fixupWarn(
      '  ⚠ Codegen fixup: main TSX builds JSX/array props for *.client — use AppPlaceholder + child components instead (do not pass JSX into client chrome)',
    );
  }
}

/**
 * Companion `.client.tsx` — **does not rewrite** AI source (aside from normalizeAiSource).
 * Mutating helpers remain exported; emit rules live in system-codegen-sitecoreize.md.
 */
/**
 * `Element.focus` is not in the DOM lib — cast `querySelector(…)` results used
 * with `.focus()` to `HTMLElement | null` so `tsc` / next build pass.
 * @param {string} source
 */
export function ensureQuerySelectorFocusHtmlElement(source) {
  let text = String(source || '');
  if (!text.trim() || !/\.focus\s*\(/.test(text)) return text;
  // Skip when already cast: querySelector(...) as HTMLElement …
  const qs =
    '((?:\\w+\\.)?querySelector(?:All)?\\s*(?:<[^>]+>)?\\s*\\([^)]*\\))';
  text = text.replace(
    new RegExp(`${qs}(?!\\s+as\\s+HTMLElement)\\s*\\?\\.\\s*focus\\s*\\(`, 'g'),
    '($1 as HTMLElement | null)?.focus(',
  );
  text = text.replace(
    new RegExp(`${qs}(?!\\s+as\\s+HTMLElement)\\s*\\.\\s*focus\\s*\\(`, 'g'),
    '($1 as HTMLElement | null)?.focus(',
  );
  return text;
}

/**
 * After `const root = …?.closest(…)` / optional querySelector, bare `root.querySelector`
 * fails tsc (TS18049) — control-flow does not narrow from later `button` checks.
 * Insert `if (!ident) return;` right after the assignment when missing.
 * @param {string} source
 */
export function ensureNullableDomRootGuards(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  // const root = expr?.closest(...)  OR  const root = expr?.querySelector...
  text = text.replace(
    /(const\s+)([A-Za-z_$][\w$]*)(\s*=\s*[^;\n]*\?\.(?:closest|querySelector(?:All)?)\b[^;\n]*;?)(\s*)/g,
    (full, constKw, name, assign, ws, offset, whole) => {
      const after = String(whole || text).slice(offset + full.length);
      if (new RegExp(`^\\s*if\\s*\\(\\s*!\\s*${name}\\b`).test(ws + after)) {
        return full;
      }
      return `${constKw}${name}${assign}${ws}if (!${name}) return; `;
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: guarded nullable DOM root (optional-chain assignment) for tsc',
    );
  }
  return text;
}

export function normalizeClientTsx(source) {
  // 'use client' is required on every companion — keep outside prompt-first skip.
  let text = ensureCompanionClientUseClient(normalizeAiSource(source));
  if (!text.trim()) return text;
  if (shouldSkipMutatingTsxFixups()) {
    if (shouldSkipAiSourceFixups()) logSkipAiSourceFixupsOnce();
    else logV2PromptFirstOnce();
    return text;
  }
  text = dedupeUseClientDirective(text);
  text = fixGluedJsxTagAttributes(text);
  text = fixJsxClassNameEscapedQuotes(text);
  text = ensureClientTrackHorizontalRow(text);
  text = stripDebugOutlineClasses(text);
  text = ensureMobileNavToggleClickHandler(text);
  text = ensureQuerySelectorFocusHtmlElement(text);
  text = ensureNullableDomRootGuards(text);
  text = ensureClientDefaultExport(text);
  text = ensureCompanionClientUseClient(text);
  warnLooseFieldValueStringAttrs(text);
  if (hasNestedPlaceholder(text)) {
    fixupWarn(
      '  ⚠ TSX emit: clientTsx referenced AppPlaceholder/Placeholder — remove nested placeholder usage from client chrome',
    );
  }
  if (
    /\b(categories|items|cards)\s*:\s*/.test(text) &&
    /children\s*:\s*React\.ReactNode/.test(text) === false &&
    /children\s*\??\s*:\s*React\.ReactNode/.test(text) === false
  ) {
    if (/categories\s*:\s*Array|items\s*:\s*Array|categories\s*:\s*\{/.test(text)) {
      fixupWarn(
        '  ⚠ TSX emit: clientTsx appears to model repeating content arrays — prefer AppPlaceholder children + child components',
      );
    }
  }
  if (
    /\bsnap-x\b/.test(text) &&
    /\bmd:grid\b/.test(text) &&
    !/\blg:grid\b/.test(text)
  ) {
    fixupWarn(
      '  ⚠ TSX emit: clientTsx carousel wraps to grid at md: — use lg:grid (≥1024)',
    );
  }
  if (
    /\{children\}/.test(text) &&
    /basis-(full|1\/2)|md:basis-1\/2|lg:basis-1\/2/.test(text) &&
    /flex min-w-0 shrink-0/.test(text)
  ) {
    fixupWarn(
      '  ⚠ TSX emit: clientTsx wraps all AppPlaceholder children in one basis-full/1/2 shell — size each child with [&>*]:… / auto-cols-* track instead',
    );
  }
  return text;
}

/**
 * planMode is informational only — do not warn/branch on single vs composite labels.
 * @param {string} source
 * @param {{ planMode?: string|null }} [options]
 */
export function warnSingleModeAppPlaceholder(source, _options = {}) {
  return String(source || '');
}

/**
 * Strip `placeholders: […]` from definitions when TSX is a leaf (no AppPlaceholder).
 * planMode is informational only — never decides strip.
 * @param {string} source
 * @param {{ planMode?: string|null, tsxSource?: string|null, clientTsxSource?: string|null, plan?: { children?: unknown[] }|null }} [options]
 */
export function stripPlaceholdersWhenSingleMode(source, options = {}) {
  const tsx = `${String(options.tsxSource || '')}\n${String(options.clientTsxSource || '')}`;
  // Without TSX evidence, do not strip based on planMode labels.
  if (!String(options.tsxSource || '').trim() && !String(options.clientTsxSource || '').trim()) {
    return String(source || '');
  }
  const hasAppPlaceholder = /\bAppPlaceholder\b/.test(tsx);
  if (hasAppPlaceholder) return String(source || '');
  let text = String(source || '');
  const key = text.match(/\bplaceholders\s*:\s*/);
  if (!key || key.index == null) return text;
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
  // Already empty — no rewrite noise
  const body = text.slice(open + 1, close).trim();
  if (!body) return text;
  let end = close + 1;
  const after = text.slice(end);
  const comma = after.match(/^\s*,/);
  if (comma) end += comma[0].length;
  const replacement = comma ? 'placeholders: [],' : 'placeholders: []';
  const next = text.slice(0, key.index) + replacement + text.slice(end);
  if (next !== text) {
    fixupWarn(
      '  ⚠ Codegen fixup: TSX has no AppPlaceholder (leaf) — cleared placeholders[]',
    );
  }
  return next;
}

/**
 * Collapse duplicate `'use client'` directives to a single leading directive.
 * @param {string} source
 */
export function dedupeUseClientDirective(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const lineRe = /^[ \t]*['"]use client['"];?[ \t]*\r?\n/gm;
  const matches = text.match(lineRe);
  if (!matches || matches.length <= 1) return text;
  text = text.replace(lineRe, '');
  text = `'use client';\n${text.replace(/^\uFEFF/, '').replace(/^\s*\n+/, '')}`;
  fixupWarn(
    "  ⚠ Codegen fixup: removed duplicate 'use client' directive(s)",
  );
  return text;
}

/**
 * Default-import binding for `./….client` companion chrome.
 * @param {string} source
 * @returns {string|null}
 */
export function parseCompanionClientImportAlias(source) {
  const m = String(source || '').match(
    /\bimport\s+([A-Za-z_$][\w$]*)(?:\s*,\s*\{[^}]*\})?\s+from\s+(['"])(\.\/[^'"]+\.client)\2/,
  );
  return m ? m[1] : null;
}

/**
 * Whether `name` is declared in this file (import / function / const / class).
 * @param {string} source
 * @param {string} name
 */
function isIdentifierDeclaredInSource(source, name) {
  const text = String(source || '');
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (
    new RegExp(
      `\\bimport\\s+(?:\\{[^}]*\\b${esc}\\b[^}]*\\}|${esc}\\s*,|${esc}\\s+from)`,
    ).test(text)
  ) {
    return true;
  }
  if (
    new RegExp(
      `\\b(?:function|class|const|let|var)\\s+${esc}\\b`,
    ).test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Rewrite invented `*Chrome` JSX tags to the imported `.client` alias; unwrap nested duplicates.
 * @param {string} source
 */
export function remapOrphanChromeJsxToCompanionImport(source) {
  let text = String(source || '');
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return text;

  const chromeTags = new Set();
  const tagRe = /<\/?([A-Za-z][\w]*Chrome)\b/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    chromeTags.add(m[1]);
  }

  const remapped = [];
  for (const tag of chromeTags) {
    if (tag === alias) continue;
    if (isIdentifierDeclaredInSource(text, tag)) continue;
    const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`<(/?)${esc}\\b`, 'g'), `<$1${alias}`);
    remapped.push(tag);
  }
  if (remapped.length) {
    fixupWarn(
      `  ⚠ Codegen fixup: remapped orphan Chrome JSX → ${alias} (${remapped.join(', ')})`,
    );
  }

  text = unwrapNestedDuplicateChromeWraps(text, alias);
  return text;
}

/**
 * `<Alias>…<Alias>…</Alias>…</Alias>` → keep outer wrap only.
 * @param {string} source
 * @param {string} alias
 */
export function unwrapNestedDuplicateChromeWraps(source, alias) {
  let text = String(source || '');
  if (!alias) return text;
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nested = new RegExp(
    `(<${esc}\\b[^>]*>)([\\s\\S]*?)(<${esc}\\b[^>]*>)([\\s\\S]*?)(<\\/${esc}>)([\\s\\S]*?)(<\\/${esc}>)`,
  );
  let before;
  let unwrapped = 0;
  do {
    before = text;
    text = text.replace(nested, (_, o1, mid1, _o2, inner, _c2, mid2, c1) => {
      unwrapped += 1;
      return `${o1}${mid1}${inner}${mid2}${c1}`;
    });
  } while (text !== before);
  if (unwrapped > 0) {
    fixupWarn(
      `  ⚠ Codegen fixup: unwrapped nested duplicate <${alias}> (${unwrapped})`,
    );
  }
  return text;
}

/**
 * Collect prop names accepted by companion client chrome.
 * Do NOT seed `fields` by default — data-DTO companions (`Props = { data }`)
 * must not get fields injected/allowed.
 * @param {string} clientTsx
 * @returns {Set<string>}
 */
export function collectClientChromePropNames(clientTsx) {
  /** @type {Set<string>} */
  const names = new Set([
    'children',
    'key',
    'className',
    'suppressHydrationWarning',
    'ref',
  ]);
  const text = String(clientTsx || '');
  if (!text.trim()) return names;

  const typeBlocks = [
    ...text.matchAll(
      /(?:type|interface)\s+\w*Props\b[^{=]*=?\s*\{([^}]*)\}/g,
    ),
  ];
  for (const block of typeBlocks) {
    const body = block[1] || '';
    for (const prop of body.matchAll(
      /(?:^|[;,\n])\s*(?:readonly\s+)?(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*\??\s*:/g,
    )) {
      names.add(prop[1] || prop[2] || prop[3]);
    }
  }

  const destPatterns = [
    /export\s+default\s+function\s+\w+\s*\(\s*\{([^}]*)\}/,
    /(?:export\s+default\s+)?(?:const|function)\s+\w+\s*=\s*\(\s*\{([^}]*)\}\s*:\s*\w*Props/,
    /(?:export\s+default\s+)?(?:const|function)\s+\w+\s*=\s*\(\s*\{([^}]*)\}\s*\)/,
  ];
  for (const re of destPatterns) {
    const dest = text.match(re);
    if (!dest) continue;
    for (const part of dest[1].split(',')) {
      const trimmed = part.trim();
      if (!trimmed || trimmed.startsWith('...')) continue;
      const name = trimmed.match(/^([A-Za-z_$][\w$]*)/);
      if (name) names.add(name[1]);
    }
  }
  return names;
}

/**
 * True when map-entry scope destructures a `fields` binding (not item.fields access).
 * @param {string} before
 * @returns {boolean}
 */
export function mapEntryDestructuresFields(before) {
  const src = String(before || '');
  // ({ fields }) / ({ fields, x }) / ({ fields: renamed })
  if (
    /\(\s*\{\s*(?:[^}]*?,\s*)?fields\s*(?::\s*[A-Za-z_$][\w$]*)?\s*[,}]/.test(
      src,
    )
  ) {
    return true;
  }
  // const { fields } = …
  if (
    /\bconst\s*\{\s*(?:[^}]*?,\s*)?fields\s*(?::\s*[A-Za-z_$][\w$]*)?\s*[,}]/.test(
      src,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Remove fields={…} attributes from a JSX attribute string.
 * @param {string} attrs
 * @returns {string}
 */
function stripFieldsJsxAttribute(attrs) {
  let out = String(attrs || '');
  // fields={…} with nested braces
  out = out.replace(/\sfields\s*=\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  // fields="…" / fields='…'
  out = out.replace(/\sfields\s*=\s*(['"])(?:\\.|(?!\1).)*\1/g, '');
  return out;
}

/**
 * Ensure companion `type/interface Fields` is exported for map-entry imports.
 * @param {string} source
 * @returns {string}
 */
export function ensureFieldsTypeExported(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /^(type|interface)\s+Fields\b/m,
    'export $1 Fields',
  );
  text = text.replace(/^export\s+export\s+/m, 'export ');
  if (text !== before) {
    fixupWarn('  ⚠ Codegen fixup: exported Fields type from companion');
  }
  return text;
}

/**
 * Avoid TS2740: map-entry `fields: Record<string, any>` vs companion `fields: Fields`.
 * Prefer importing Fields from the companion; fall back to `as any` on the JSX prop.
 * @param {string} tsx
 * @param {string|null|undefined} clientTsx
 * @param {string|null|undefined} kebab
 * @returns {string}
 */
export function ensureMapEntryFieldsTypeMatchesCompanion(tsx, clientTsx, kebab) {
  let text = String(tsx || '');
  if (!text.trim() || !String(clientTsx || '').trim()) return text;
  if (!/\bfields\s*:\s*Record\s*<\s*string\s*,\s*any\s*>/.test(text)) {
    return text;
  }
  const clientHasFieldsType =
    /\b(?:export\s+)?(?:type|interface)\s+Fields\b/.test(String(clientTsx));
  const before = text;
  if (clientHasFieldsType && kebab) {
    const stem = String(kebab).replace(/\.client$/i, '');
    if (!new RegExp(`from\\s*['"]\\.\\/${stem}\\.client['"]`).test(text) ||
      !/\bFields\b/.test(
        (text.match(
          new RegExp(
            `import\\s+type\\s*\\{([^}]*)\\}\\s*from\\s*['"]\\.\\/${stem}\\.client['"]`,
          ),
        ) || [])[1] || '',
      )) {
      // Add/merge type import of Fields from companion
      const typeImportRe = new RegExp(
        `^import\\s+type\\s*\\{([^}]*)\\}\\s*from\\s*['"]\\.\\/${stem}\\.client['"];?\\s*$`,
        'm',
      );
      if (typeImportRe.test(text)) {
        text = text.replace(typeImportRe, (full, named) => {
          const existing = named
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (existing.includes('Fields')) return full;
          return `import type { ${[...existing, 'Fields'].join(', ')} } from './${stem}.client';`;
        });
      } else {
        const line = `import type { Fields } from './${stem}.client';\n`;
        if (/^['"]use client['"];?\s*\n/.test(text)) {
          text = text.replace(/^(['"]use client['"];?\s*\n+)/, `$1${line}`);
        } else {
          text = line + text;
        }
      }
    }
    text = text.replace(
      /\bfields\s*:\s*Record\s*<\s*string\s*,\s*any\s*>/g,
      'fields: Fields',
    );
  } else {
    // Cast at call sites
    text = text.replace(
      /\bfields=\{fields\}/g,
      'fields={fields as any}',
    );
    text = text.replace(
      /\bfields=\{props\.fields\}/g,
      'fields={props.fields as any}',
    );
  }
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: map-entry fields type aligned with companion Fields (TS2740)',
    );
  }
  return text;
}

/**
 * Map-entry must pass fields into .client chrome when the companion expects them.
 * Data-DTO companions (`Props = { data }`, no fields) must not get fields injected;
 * stray fields={…} are stripped.
 * @param {string} tsx
 * @param {string|null|undefined} clientTsx
 * @returns {string}
 */
export function ensureMapEntryPassesFieldsToCompanion(tsx, clientTsx) {
  let text = String(tsx || '');
  if (!text.trim() || !String(clientTsx || '').trim()) return text;
  const alias = parseCompanionClientImportAlias(text);
  if (!alias) return text;
  const allowed = collectClientChromePropNames(clientTsx);
  const wantsFields = allowed.has('fields');

  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRe = new RegExp(`<${esc}\\b`, 'g');
  /** @type {{ start: number, end: number, replacement: string }[]} */
  const edits = [];
  let strippedStray = false;
  let injected = false;
  let match;
  while ((match = openRe.exec(text)) !== null) {
    const parsed = parseJsxOpeningTag(text, match.index);
    if (!parsed) continue;
    let attrs = parsed.attrs || '';

    if (!wantsFields) {
      if (!/\bfields\s*=/.test(attrs)) continue;
      attrs = stripFieldsJsxAttribute(attrs);
      strippedStray = true;
      const open = parsed.selfClosing
        ? `<${alias}${attrs} />`
        : `<${alias}${attrs}>`;
      edits.push({ start: match.index, end: parsed.end, replacement: open });
      continue;
    }

    if (/\bfields\s*=/.test(attrs)) continue;
    const dsBind = text.match(
      /\b(?:const|let|var)\s+(\w+)\s*=\s*getDatasource\s*(?:<[^>]*>)?\s*\(/,
    );
    const before = text.slice(Math.max(0, match.index - 400), match.index);
    const fieldsExpr = dsBind
      ? `fields={${dsBind[1]}}`
      : mapEntryDestructuresFields(before)
        ? 'fields={fields}'
        : 'fields={props.fields}';
    attrs = `${attrs} ${fieldsExpr}`;
    injected = true;
    const open = parsed.selfClosing
      ? `<${alias}${attrs} />`
      : `<${alias}${attrs}>`;
    edits.push({ start: match.index, end: parsed.end, replacement: open });
  }
  if (!edits.length) return text;
  for (let i = edits.length - 1; i >= 0; i -= 1) {
    const e = edits[i];
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  }
  if (strippedStray) {
    fixupWarn(
      `  ⚠ Codegen fixup: stripped stray fields prop from <${alias}> (companion is data-DTO, not fields)`,
    );
  }
  if (injected) {
    fixupWarn(
      `  ⚠ Codegen fixup: passed fields into <${alias}> companion`,
    );
  }
  return text;
}

/**
 * Parse a JSX opening tag starting at `start` (index of `<`).
 * Handles nested `{…}` in attribute values.
 * @param {string} text
 * @param {number} start
 * @returns {{ end: number, attrs: string, selfClosing: boolean } | null}
 */
function parseJsxOpeningTag(text, start) {
  if (text[start] !== '<') return null;
  let i = start + 1;
  while (i < text.length && /[\w.$]/.test(text[i])) i += 1;
  const attrsStart = i;
  let depthBrace = 0;
  let quote = /** @type {string|null} */ (null);
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && quote !== '`') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      depthBrace += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depthBrace -= 1;
      i += 1;
      continue;
    }
    if (depthBrace === 0) {
      if (ch === '>') {
        return {
          end: i + 1,
          attrs: text.slice(attrsStart, i),
          selfClosing: false,
        };
      }
      if (ch === '/' && text[i + 1] === '>') {
        return {
          end: i + 2,
          attrs: text.slice(attrsStart, i),
          selfClosing: true,
        };
      }
    }
    i += 1;
  }
  return null;
}

/**
 * Filter JSX attribute string to allowed prop names.
 * @param {string} attrs
 * @param {Set<string>} allowed
 * @returns {{ attrs: string, stripped: string[] }}
 */
function filterJsxAttributeString(attrs, allowed) {
  const s = String(attrs || '');
  /** @type {string[]} */
  const stripped = [];
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      out += s[i];
      i += 1;
      continue;
    }
    if (s[i] === '{' && s.slice(i, i + 4) === '{...') {
      let depth = 0;
      let j = i;
      while (j < s.length) {
        if (s[j] === '{') depth += 1;
        else if (s[j] === '}') {
          depth -= 1;
          if (depth === 0) {
            j += 1;
            break;
          }
        }
        j += 1;
      }
      out += s.slice(i, j);
      i = j;
      continue;
    }
    const nameMatch = s.slice(i).match(/^([A-Za-z_:][\w:.-]*)/);
    if (!nameMatch) {
      out += s[i];
      i += 1;
      continue;
    }
    const name = nameMatch[1];
    let j = i + name.length;
    while (j < s.length && /\s/.test(s[j])) j += 1;
    if (s[j] === '=') {
      j += 1;
      while (j < s.length && /\s/.test(s[j])) j += 1;
      if (s[j] === '"' || s[j] === "'") {
        const q = s[j];
        j += 1;
        while (j < s.length && s[j] !== q) {
          if (s[j] === '\\') j += 1;
          j += 1;
        }
        j += 1;
      } else if (s[j] === '{') {
        let depth = 0;
        let q = /** @type {string|null} */ (null);
        while (j < s.length) {
          const ch = s[j];
          if (q) {
            if (ch === '\\' && q !== '`') {
              j += 2;
              continue;
            }
            if (ch === q) q = null;
            j += 1;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === '`') {
            q = ch;
            j += 1;
            continue;
          }
          if (ch === '{') depth += 1;
          else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
              j += 1;
              break;
            }
          }
          j += 1;
        }
      } else {
        while (j < s.length && !/\s/.test(s[j]) && s[j] !== '/' && s[j] !== '>') {
          j += 1;
        }
      }
    }
    if (allowed.has(name)) {
      out += s.slice(i, j);
    } else {
      stripped.push(name);
    }
    i = j;
  }
  return {
    attrs: out.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+\n/g, '\n'),
    stripped,
  };
}

/**
 * Strip JSX props on the imported Chrome that the companion does not declare.
 * @param {string} tsx
 * @param {string} clientTsx
 */
export function stripUnknownChromeProps(tsx, clientTsx) {
  let text = String(tsx || '');
  const alias = parseCompanionClientImportAlias(text);
  if (!alias || !String(clientTsx || '').trim()) return text;

  const allowed = collectClientChromePropNames(clientTsx);
  const openRe = new RegExp(`<${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  /** @type {string[]} */
  const allStripped = [];
  /** @type {{ start: number, end: number, replacement: string }[]} */
  const edits = [];

  let match;
  while ((match = openRe.exec(text)) !== null) {
    const parsed = parseJsxOpeningTag(text, match.index);
    if (!parsed) continue;
    const { attrs, stripped } = filterJsxAttributeString(parsed.attrs, allowed);
    if (!stripped.length) continue;
    allStripped.push(...stripped);
    const open = parsed.selfClosing
      ? `<${alias}${attrs} />`
      : `<${alias}${attrs}>`;
    edits.push({ start: match.index, end: parsed.end, replacement: open });
  }

  if (!edits.length) return text;
  for (let i = edits.length - 1; i >= 0; i -= 1) {
    const e = edits[i];
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  }
  const unique = [...new Set(allStripped)];
  fixupWarn(
    `  ⚠ Codegen fixup: stripped ${unique.length} unknown Chrome prop(s) (not on companion): ${unique.join(', ')}`,
  );
  return text;
}

/**
 * Rewrite relative `./wrong-stem` imports to `./{kebab}` when name-lock kept the package
 * but AI still imports the preferred (unlocked) stem for types/helpers.
 * @param {string} source
 * @param {string|null|undefined} kebab
 * @returns {string}
 */
export function rewriteRelativeImportsToPackageKebab(source, kebab) {
  const stem = String(kebab || '')
    .trim()
    .replace(/\.client$/i, '');
  if (!stem) return String(source || '');
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;
  text = text.replace(
    /(\bfrom\s+)(['"])(\.\/[^'"]+)\2/g,
    (full, fromKw, quote, spec) => {
      if (spec === `./${stem}` || spec === `./${stem}.client`) return full;
      if (!spec.startsWith('./')) return full;
      // Leave node_modules-style and deep relatives alone.
      if (spec.includes('/', 2)) return full;
      const base = spec.slice(2).replace(/\.client$/i, '');
      if (!base || base === stem) return full;
      // Only remap when it looks like a sibling package stem (kebab/Pascal-ish).
      if (!/^[A-Za-z][\w-]*$/.test(base)) return full;
      const next = spec.endsWith('.client')
        ? `./${stem}.client`
        : `./${stem}`;
      return `${fromKw}${quote}${next}${quote}`;
    },
  );
  if (text !== before) {
    fixupWarn(
      `  ⚠ Codegen fixup: remapped relative imports → './${stem}' (name-lock package)`,
    );
  }
  return text;
}

/**
 * Resolve element type name for `.prop.map` / `ident.map` from file-local types.
 * @param {string} source
 * @param {string} propName
 * @returns {string|null}
 */
function resolveMapElementTypeName(source, propName) {
  const prop = String(propName || '').trim();
  if (!prop) return null;
  const text = String(source || '');
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const arrayAnn = new RegExp(
    `\\b${esc}\\s*:\\s*(?:Array\\s*<\\s*([A-Za-z_$][\\w$]*)\\s*>|([A-Za-z_$][\\w$]*)\\s*\\[\\])`,
  ).exec(text);
  if (arrayAnn) return arrayAnn[1] || arrayAnn[2] || null;

  // const groups = readJson<MenuGroup[]>(…) / as MenuGroup[]
  const genericAnn = new RegExp(
    `\\b(?:const|let|var)\\s+${esc}\\s*=\\s*[^;\\n]{0,120}<\\s*([A-Za-z_$][\\w$]*)\\s*\\[\\s*\\]`,
  ).exec(text);
  if (genericAnn) return genericAnn[1];

  // Singularize simple plurals: columns → Column, links → Link, groups → Group
  let stem = prop;
  if (/ies$/i.test(stem)) stem = `${stem.slice(0, -3)}y`;
  else if (/ses$/i.test(stem)) stem = stem.slice(0, -2);
  else if (/s$/i.test(stem) && !/ss$/i.test(stem)) stem = stem.slice(0, -1);
  const cap = stem.charAt(0).toUpperCase() + stem.slice(1);

  /** @type {string[]} */
  const typeNames = [];
  for (const m of text.matchAll(
    /\b(?:interface|type)\s+([A-Za-z_$][\w$]*)\b/g,
  )) {
    typeNames.push(m[1]);
  }
  const exact = typeNames.find((n) => n === cap || n.endsWith(cap));
  if (exact) return exact;
  const soft = typeNames.find((n) => new RegExp(cap, 'i').test(n));
  return soft || null;
}

/**
 * Add shallow types on common map/filter callback params that TS flags as implicit any.
 * Prefer file-local named element types (MenuColumn, LinkItem); fallback `: any`.
 * @param {string} source
 * @returns {string}
 */
export function ensureImplicitAnyParamsTyped(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  const before = text;

  // Pass 1: `recv.method((a, b) =>` — untyped or `: any` element (`groups.map`, `.columns.map`)
  text = text.replace(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(map|filter|forEach|flatMap|reduce)\(\s*\(\s*([A-Za-z_$][\w$]*)(?:\s*:\s*any)?\s*,\s*([A-Za-z_$][\w$]*)(?:\s*:\s*\w+)?\s*\)\s*=>/g,
    (full, prop, method, a, b) => {
      const elemType = resolveMapElementTypeName(text, prop) || 'any';
      return `${prop}.${method}((${a}: ${elemType}, ${b}: number) =>`;
    },
  );

  // Pass 2: `recv.method((a) =>` / `(a: any) =>`
  text = text.replace(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(map|filter|forEach|flatMap)\(\s*\(\s*([A-Za-z_$][\w$]*)(?:\s*:\s*any)?\s*\)\s*=>/g,
    (full, prop, method, a) => {
      const elemType = resolveMapElementTypeName(text, prop) || 'any';
      return `${prop}.${method}((${a}: ${elemType}) =>`;
    },
  );

  // Pass 3: bare `recv.method(ident =>`
  text = text.replace(
    /\b([A-Za-z_$][\w$]*)\s*\.\s*(map|filter|forEach|flatMap)\(\s*([A-Za-z_$][\w$]*)\s*=>/g,
    (full, prop, method, a) => {
      const elemType = resolveMapElementTypeName(text, prop) || 'any';
      return `${prop}.${method}((${a}: ${elemType}) =>`;
    },
  );

  // Pass 4: leftover bare / parenthesized without resolvable recv (fallback any)
  text = text.replace(
    /\.(map|filter|forEach|flatMap|reduce)\(\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/g,
    (full, method, a, b) => {
      if (/:\s*\S/.test(full) && !/:\s*any\b/.test(full)) return full;
      return `.${method}((${a}: any, ${b}: number) =>`;
    },
  );
  text = text.replace(
    /\.(map|filter|forEach|flatMap)\(\s*\(\s*([A-Za-z_$][\w$]*)(?:\s*:\s*any)?\s*\)\s*=>/g,
    (full, method, a) => {
      if (/:\s*\S/.test(full) && !/:\s*any\b/.test(full)) return full;
      return `.${method}((${a}: any) =>`;
    },
  );
  text = text.replace(
    /\.(map|filter|forEach|flatMap)\(\s*([A-Za-z_$][\w$]*)\s*=>/g,
    (_full, method, a) => `.${method}((${a}: any) =>`,
  );

  if (text !== before) {
    fixupWarn('  ⚠ Codegen fixup: annotated implicit-any callback params');
  }
  return text;
}

/**
 * Fix TS7053: `fields[option.label]` where the index is a string/any.
 * Narrow rewrite → `fields[option.label as keyof typeof fields]`.
 * @param {string} source
 * @returns {string}
 */
export function ensureFieldsIndexedAccessTyped(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (!/\bfields\s*\[\s*[A-Za-z_$]/.test(text)) return text;
  const before = text;
  text = text.replace(
    /\bfields\s*\[\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\s*\]/g,
    (full, expr) => {
      if (/\bas\s+keyof\b/.test(full)) return full;
      return `fields[${expr} as keyof typeof fields]`;
    },
  );
  if (text !== before) {
    fixupWarn(
      '  ⚠ Codegen fixup: typed fields[…] indexed access (TS7053 keyof)',
    );
  }
  return text;
}

/**
 * Force companion chrome imports to `./{kebab}.client` (the path write-component writes).
 * Models sometimes invent short names like `./consent-toggle.client`.
 * @param {string} source
 * @param {string|null|undefined} kebab
 */
export function rewriteCompanionClientImport(source, kebab) {
  const stem = String(kebab || '')
    .trim()
    .replace(/\.client$/i, '');
  if (!stem) return String(source || '');
  let text = String(source || '');
  if (!text.trim()) return text;
  const expected = `./${stem}.client`;
  const before = text;
  text = text.replace(
    /(\bfrom\s+)(['"])(\.\/[^'"]+\.client)\2/g,
    (full, fromKw, quote, spec) => {
      if (spec === expected) return full;
      return `${fromKw}${quote}${expected}${quote}`;
    },
  );
  if (text !== before) {
    fixupWarn(
      `  ⚠ Codegen fixup: rewrote companion .client import → '${expected}'`,
    );
  }
  return text;
}

/**
 * Prefer `export default function XxxChrome` name from companion source.
 * @param {string} clientTsx
 * @returns {string|null}
 */
export function parseDefaultChromeExportName(clientTsx) {
  const text = String(clientTsx || '');
  const m = text.match(
    /\bexport\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/,
  );
  if (m) return m[1];
  const named = text.match(
    /\bfunction\s+([A-Za-z_$][\w$]*Chrome)\s*\([\s\S]*?\bexport\s+default\s+\1\b/,
  );
  if (named) return named[1];
  const constDefault = text.match(
    /\b(?:const|function)\s+([A-Za-z_$][\w$]*Chrome)\b[\s\S]*?\bexport\s+default\s+\1\b/,
  );
  return constDefault ? constDefault[1] : null;
}

/**
 * First undeclared `*Chrome` JSX tag in map-entry source.
 * @param {string} source
 * @returns {string|null}
 */
export function firstUndeclaredChromeJsxTag(source) {
  const text = String(source || '');
  const tagRe = /<\/?([A-Za-z][\w]*Chrome)\b/g;
  /** @type {Set<string>} */
  const seen = new Set();
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    const tag = m[1];
    if (seen.has(tag)) continue;
    seen.add(tag);
    if (!isIdentifierDeclaredInSource(text, tag)) return tag;
  }
  return null;
}

/**
 * When clientTsx exists, ensure map-entry imports `./{kebab}.client` and remaps orphan Chrome JSX.
 * Safety net for validateClean write path (skips normalizeComponentTsx) — FAQ crash pattern:
 * `<FaqChrome …/>` with companion written but no import → ReferenceError at runtime.
 *
 * @param {string} source
 * @param {{ kebab?: string|null, clientTsx?: string|null, componentName?: string|null }} [opts]
 * @returns {string}
 */
export function ensureCompanionClientImport(source, opts = {}) {
  let text = String(source || '');
  const clientTsx = String(opts.clientTsx || '');
  const kebab = String(opts.kebab || '')
    .trim()
    .replace(/\.client$/i, '');
  if (!text.trim() || !clientTsx.trim() || !kebab) return text;

  text = rewriteCompanionClientImport(text, kebab);

  if (!parseCompanionClientImportAlias(text)) {
    const fromClient = parseDefaultChromeExportName(clientTsx);
    const fromJsx = firstUndeclaredChromeJsxTag(text);
    const fromName = String(opts.componentName || '')
      .replace(/[^A-Za-z0-9]/g, '');
    const alias =
      fromClient ||
      fromJsx ||
      (fromName ? `${fromName}Chrome` : 'Chrome');
    const importLine = `import ${alias} from './${kebab}.client';\n`;
    if (/^import\s/m.test(text)) {
      text = text.replace(/^(import\s[^\n]+\n)/m, `${importLine}$1`);
    } else if (/^['"]use client['"];?\s*\n/.test(text)) {
      text = text.replace(
        /^(['"]use client['"];?\s*\n+)/,
        `$1${importLine}`,
      );
    } else {
      text = importLine + text;
    }
    fixupWarn(
      `  ⚠ Codegen fixup: added missing companion import ${alias} from './${kebab}.client'`,
    );
  }

  text = remapOrphanChromeJsxToCompanionImport(text);
  return text;
}

/**
 * Extract kebab AppPlaceholder bases from clientTsx (literal name= or const ident).
 * @param {string} clientTsx
 * @returns {string[]}
 */
export function extractClientAppPlaceholderBases(clientTsx) {
  const text = String(clientTsx || '');
  /** @type {string[]} */
  const bases = [];
  const add = (raw) => {
    const b = String(raw || '')
      .trim()
      .toLowerCase();
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b) && !bases.includes(b)) {
      bases.push(b);
    }
  };
  for (const m of text.matchAll(
    /<AppPlaceholder\b[^>]*\bname=(["'])([^"']+)\1/g,
  )) {
    add(m[2]);
  }
  for (const m of text.matchAll(
    /<AppPlaceholder\b[^>]*\bname=\{\s*(['"])([^'"]+)\1\s*\}/g,
  )) {
    add(m[2]);
  }
  /** @type {Map<string, string>} */
  const consts = new Map();
  for (const m of text.matchAll(
    /\b(?:const|let)\s+([A-Za-z_]\w*)\s*=\s*['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/gi,
  )) {
    consts.set(m[1], m[2]);
  }
  for (const m of text.matchAll(
    /<AppPlaceholder\b[^>]*\bname=\{\s*([A-Za-z_]\w*)\s*\}/g,
  )) {
    if (consts.has(m[1])) add(consts.get(m[1]));
  }
  return bases;
}

/**
 * True when map-entry return is only `<Alias …/>` or empty `<Alias></Alias>` (thin wrapper).
 * @param {string} tsx
 * @param {string} alias
 */
function isThinCompanionClientWrapper(tsx, alias) {
  const text = String(tsx || '');
  const esc = String(alias || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!esc) return false;
  if (/<AppPlaceholder\b/.test(text)) return false;
  const selfClosing = new RegExp(
    `return\\s*(?:\\(\\s*)?<${esc}\\b[^>]*\\/\\s*>\\s*(?:\\)\\s*)?;`,
    's',
  );
  const emptyBody = new RegExp(
    `return\\s*(?:\\(\\s*)?<${esc}\\b[^>]*>\\s*</${esc}>\\s*(?:\\)\\s*)?;`,
    's',
  );
  return selfClosing.test(text) || emptyBody.test(text);
}

/**
 * Strip AppPlaceholder / server component-map from client; leave `{children}` slot.
 * @param {string} clientTsx
 * @returns {string}
 */
function stripClientAppPlaceholderForChildren(clientTsx) {
  let text = String(clientTsx || '');
  text = text.replace(/<AppPlaceholder\b[^>]*\/>/g, '{children}');
  text = text.replace(
    /<AppPlaceholder\b[^>]*>[\s\S]*?<\/AppPlaceholder>/g,
    '{children}',
  );
  // Collapse accidental double children
  text = text.replace(/\{children\}\s*\{children\}/g, '{children}');

  // Drop AppPlaceholder from SDK value imports
  text = text.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]@sitecore-content-sdk\/nextjs['"]/g,
    (full, names) => {
      const next = names
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && !/^AppPlaceholder\b/.test(s))
        .join(', ');
      if (!next.trim()) return '';
      return `import { ${next} } from '@sitecore-content-sdk/nextjs'`;
    },
  );
  text = text.replace(
    /^\s*import\s+componentMap\s+from\s+['"]\.sitecore\/component-map['"];?\s*\n/gm,
    '',
  );
  // Drop unused placeholder const that only fed AppPlaceholder name=
  text = text.replace(
    /^\s*(?:const|let)\s+(?:placeholderBase|contextPlaceholder|phName|phBase|phKey|placeholderKey)\s*=\s*['"][^'"]+['"];?\s*\n/gm,
    '',
  );

  // Ensure children on default-export props
  if (!/\bchildren\s*\??\s*:/.test(text) && !/\bchildren\s*[,}=]/.test(text)) {
    // type Props = … → add children?: ReactNode
    if (/\btype\s+Props\s*=/.test(text) && !/\bchildren\s*\??\s*:/.test(text)) {
      text = text.replace(
        /\btype\s+Props\s*=\s*([^;]+);/,
        (full, rhs) => {
          if (/\bchildren\b/.test(rhs)) return full;
          const trimmed = String(rhs).trim();
          if (/ComponentWithContextProps\s*&/.test(trimmed)) {
            return `type Props = { fields: Fields; children?: ReactNode };`;
          }
          if (/\{[^}]*fields[^}]*\}/.test(trimmed)) {
            return `type Props = ${trimmed.replace(/\}\s*$/, '; children?: ReactNode }')};`.replace(
              /;;/,
              ';',
            );
          }
          return `type Props = (${trimmed}) & { children?: ReactNode };`;
        },
      );
    }
    // Prefer (props: Props) — ensure Props includes children?; do not force destructure
    text = text.replace(
      /export\s+default\s+function\s+(\w+)\s*\(\s*\{\s*([^}]*)\}\s*(?::\s*([^{]+))?\)/,
      (full, name, dest, typeAnn) => {
        const ann = typeAnn ? typeAnn.trim() : 'Props';
        return `export default function ${name}(props: ${ann})`;
      },
    );
    // Already (props: …) — nothing to add to signature; Props type updated above
    if (
      !/export\s+default\s+function\s+\w+\s*\(\s*props\s*:/.test(text) &&
      /export\s+default\s+function\s+\w+\s*\(/.test(text)
    ) {
      text = text.replace(
        /export\s+default\s+function\s+(\w+)\s*\(\s*([^)]*)\s*\)/,
        (full, name, params) => {
          if (/\bprops\b/.test(params) && !/\{/.test(params)) return full;
          return `export default function ${name}(props: Props)`;
        },
      );
    }
    if (
      !/import\s+type\s+\{[^}]*\bReactNode\b/.test(text) &&
      !/import\s+\{[^}]*\btype\s+ReactNode\b/.test(text) &&
      !/import\s+React,\s*\{[^}]*\btype\s+ReactNode\b/.test(text)
    ) {
      if (/from\s+['"]react['"]/.test(text)) {
        text = text.replace(
          /^import\s+React,\s*\{([^}]*)\}\s*from\s*['"]react['"];?/m,
          (full, names) => {
            if (/\bReactNode\b/.test(names)) return full;
            return `import React, { ${names.trim().replace(/,\s*$/, '')}, type ReactNode } from 'react';`;
          },
        );
        if (!/\bReactNode\b/.test(text.split('\n').slice(0, 15).join('\n'))) {
          text = text.replace(
            /^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]react['"];?/m,
            (full, names) => {
              if (/\bReactNode\b/.test(names)) return full;
              return `import type { ${names.trim().replace(/,\s*$/, '')}, ReactNode } from 'react';`;
            },
          );
        }
      } else {
        text = text.replace(
          /^(['"]use client['"];?\s*\n+)/,
          `$1import type { ReactNode } from 'react';\n`,
        );
      }
    }
  }

  // Prefer narrow (props: Props) — drop fat rendering/page destructure
  text = text.replace(
    /export\s+default\s+function\s+(\w+)\s*\(\s*\{\s*fields\s*,\s*rendering\s*,\s*page\s*,\s*children\s*\}\s*(?::\s*[^{]+)?\)/,
    'export default function $1(props: Props)',
  );
  text = text.replace(
    /export\s+default\s+function\s+(\w+)\s*\(\s*\{\s*fields\s*,\s*rendering\s*,\s*page\s*\}\s*(?::\s*[^{]+)?\)/,
    'export default function $1(props: Props)',
  );

  return text;
}

/**
 * Wrap thin `<Alias …/>` map-entry with AppPlaceholder children + ensure imports.
 * @param {string} tsx
 * @param {string} alias
 * @param {string[]} bases
 */
function wrapThinClientWithServerPlaceholders(tsx, alias, bases) {
  let text = String(tsx || '');
  const esc = String(alias || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phJsx = (bases || [])
    .map(
      (b) =>
        `<AppPlaceholder\n        name="${b}"\n        rendering={props.rendering}\n        page={props.page}\n        componentMap={componentMap}\n      />`,
    )
    .join('\n      ');
  if (!phJsx) return text;

  const replacement = `return (\n    <${alias} fields={props.fields}>\n      ${phJsx}\n    </${alias}>\n  );`;

  text = text.replace(
    new RegExp(
      `return\\s*(?:\\(\\s*)?<${esc}\\b[^>]*\\/\\s*>\\s*(?:\\)\\s*)?;`,
      's',
    ),
    replacement,
  );
  text = text.replace(
    new RegExp(
      `return\\s*(?:\\(\\s*)?<${esc}\\b[^>]*>\\s*</${esc}>\\s*(?:\\)\\s*)?;`,
      's',
    ),
    replacement,
  );

  text = ensureAppPlaceholderImports(text);
  text = ensureComponentWithContextProps(text);
  return text;
}

/**
 * Deterministic RSC fixup: hoist AppPlaceholder / server component-map out of
 * clientTsx into map-entry as children when the map-entry is a thin client wrapper.
 * Always-on (not gated by prompt-first) — prevents `{Default: function Default}` crashes.
 *
 * @param {{ tsx?: string, clientTsx?: string|null }} [opts]
 * @returns {{ tsx: string, clientTsx: string|null, changed: boolean }}
 */
export function hoistClientAppPlaceholderToServerChildren(opts = {}) {
  const tsxIn = String(opts.tsx || '');
  const clientIn =
    opts.clientTsx == null ? null : String(opts.clientTsx);
  if (!clientIn || !clientIn.trim()) {
    return { tsx: tsxIn, clientTsx: clientIn, changed: false };
  }

  const clientHasIllegalPh =
    /<AppPlaceholder\b/.test(clientIn) ||
    /from\s+['"]\.sitecore\/component-map['"]/.test(clientIn);
  if (!clientHasIllegalPh) {
    return { tsx: tsxIn, clientTsx: clientIn, changed: false };
  }

  const bases = extractClientAppPlaceholderBases(clientIn);
  if (/<AppPlaceholder\b/.test(clientIn) && bases.length === 0) {
    // Tangled / unextractable name — leave for CONTRACT → AI retry.
    return { tsx: tsxIn, clientTsx: clientIn, changed: false };
  }

  const alias = parseCompanionClientImportAlias(tsxIn);
  if (!alias) {
    return { tsx: tsxIn, clientTsx: clientIn, changed: false };
  }

  // Map-entry already mounts PH under chrome — only strip client.
  if (
    /<AppPlaceholder\b/.test(tsxIn) &&
    new RegExp(
      `<${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\s\\S]{0,1200}<AppPlaceholder\\b`,
    ).test(tsxIn)
  ) {
    const stripped = stripClientAppPlaceholderForChildren(clientIn);
    if (stripped === clientIn) {
      return { tsx: tsxIn, clientTsx: clientIn, changed: false };
    }
    fixupWarn(
      '  ⚠ React Server Components (RSC) fixup: stripped AppPlaceholder/component-map from clientTsx (server already mounts PH as children)',
    );
    return { tsx: tsxIn, clientTsx: stripped, changed: true };
  }

  if (!isThinCompanionClientWrapper(tsxIn, alias)) {
    // Too tangled to rewrite map-entry safely.
    return { tsx: tsxIn, clientTsx: clientIn, changed: false };
  }

  if (!bases.length) {
    // Server map import only — strip from client; nothing to hoist.
    const stripped = stripClientAppPlaceholderForChildren(clientIn);
    if (stripped === clientIn) {
      return { tsx: tsxIn, clientTsx: clientIn, changed: false };
    }
    fixupWarn(
      '  ⚠ React Server Components (RSC) fixup: removed server component-map import from clientTsx',
    );
    return { tsx: tsxIn, clientTsx: stripped, changed: true };
  }

  const nextTsx = wrapThinClientWithServerPlaceholders(tsxIn, alias, bases);
  const nextClient = stripClientAppPlaceholderForChildren(clientIn);
  fixupWarn(
    `  ⚠ React Server Components (RSC) fixup: hoisted AppPlaceholder [${bases.join(', ')}] from clientTsx → server children into ${alias}`,
  );
  return { tsx: nextTsx, clientTsx: nextClient, changed: true };
}

/**
 * Parent TSX imports companions with `import X from './….client'`.
 * Rewrite `export const Default = …` to a default export when no `export default` exists.
 * @param {string} source
 */
export function ensureClientDefaultExport(source) {
  let text = String(source || '');
  if (!text.trim()) return text;
  if (/\bexport\s+default\b/.test(text)) return text;

  // export const Default = (props) => { … };
  if (/\bexport\s+const\s+Default\s*=/.test(text)) {
    text = text.replace(
      /\bexport\s+const\s+Default\s*=\s*/,
      'const Default = ',
    );
    if (!/\bexport\s+default\s+Default\b/.test(text)) {
      text = `${text.replace(/\s*$/, '')}\n\nexport default Default;\n`;
    }
    fixupWarn(
      '  ⚠ Codegen fixup: clientTsx used export const Default — added export default for default import',
    );
    return text;
  }

  // export function Default(...) { … }
  if (/\bexport\s+function\s+Default\b/.test(text)) {
    text = text.replace(/\bexport\s+function\s+Default\b/, 'function Default');
    text = `${text.replace(/\s*$/, '')}\n\nexport default Default;\n`;
    fixupWarn(
      '  ⚠ Codegen fixup: clientTsx used export function Default — added export default for default import',
    );
  }
  return text;
}
