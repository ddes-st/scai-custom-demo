/**
 * Presentation contract for create:sectioncomponents.
 * Phase A (codegenOnly) must not look "done" without a presentation def;
 * final generate/push must fail closed when presentation is missing.
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { presentationDefinitionPath } from './definition-paths.mjs';

/**
 * Resolve presentationDefinition for page-conversion.json.
 * codegenOnly never stamps null (preserves prior path or omits the field).
 *
 * @param {{
 *   codegenOnly?: boolean,
 *   presentationRel?: string|null,
 *   existingPresentationDefinition?: string|null,
 * }} opts
 * @returns {{ presentationDefinition?: string|null, omit?: boolean }}
 */
export function resolvePageConversionPresentationField(opts) {
  const rel = opts.presentationRel != null ? String(opts.presentationRel).trim() : '';
  if (rel) return { presentationDefinition: rel };

  if (opts.codegenOnly) {
    const prior =
      opts.existingPresentationDefinition != null
        ? String(opts.existingPresentationDefinition).trim()
        : '';
    if (prior) return { presentationDefinition: prior };
    return { omit: true };
  }

  return { presentationDefinition: null };
}

/**
 * Build page-conversion payload with codegenOnly-safe presentation field.
 *
 * @param {object} basePayload
 * @param {{
 *   codegenOnly?: boolean,
 *   existing?: { presentationDefinition?: string|null }|null,
 * }} [opts]
 */
export function buildPageConversionPayload(basePayload, opts = {}) {
  const resolved = resolvePageConversionPresentationField({
    codegenOnly: Boolean(opts.codegenOnly),
    presentationRel: basePayload?.presentationDefinition,
    existingPresentationDefinition: opts.existing?.presentationDefinition,
  });
  const out = { ...basePayload };
  if (resolved.omit) {
    delete out.presentationDefinition;
  } else {
    out.presentationDefinition = resolved.presentationDefinition;
  }
  return out;
}

/**
 * Read existing page-conversion.json if present.
 * @param {string} pageDir
 */
export async function readExistingPageConversion(pageDir) {
  try {
    return JSON.parse(
      await readFile(path.join(pageDir, 'page-conversion.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

/**
 * True when create has section conversion work that expects presentation wiring.
 * Note: `skipped: true` means AI was skipped (e.g. --wire-only) — still needs presentation.
 * @param {Array<{ folderName?: string, definitionKeys?: string[], skipped?: boolean }>|null|undefined} pageSections
 */
export function pageSectionsExpectPresentation(pageSections) {
  if (!Array.isArray(pageSections) || !pageSections.length) return false;
  return pageSections.some((s) => {
    if (!s) return false;
    const keys = s.definitionKeys;
    return Array.isArray(keys) ? keys.length > 0 : Boolean(s.folderName);
  });
}

/**
 * Absolute path to site presentation definition (or null if args incomplete).
 * @param {{ hostSlug?: string, siteSystem?: string }} opts
 */
export function sitePresentationDefinitionAbs(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  const siteSystem = String(opts.siteSystem || '').trim();
  if (!hostSlug || !siteSystem) return null;
  return presentationDefinitionPath(hostSlug, siteSystem);
}

/**
 * Fail closed before final authoring:generate / push when presentation is required but missing.
 *
 * @param {{
 *   hostSlug: string,
 *   siteSystem: string,
 *   pageSections?: Array<object>|null,
 *   requireWhenNoSections?: boolean,
 * }} opts
 */
export async function assertPresentationReadyForGenerate(opts) {
  const needs =
    opts.requireWhenNoSections === true ||
    pageSectionsExpectPresentation(opts.pageSections);
  if (!needs) return { required: false, path: null };

  const abs = sitePresentationDefinitionAbs(opts);
  if (!abs) {
    throw new Error(
      '[bq:create:sectioncomponents] Cannot verify site presentation (hostSlug/siteSystem missing).',
    );
  }
  try {
    await access(abs);
    return { required: true, path: abs };
  } catch {
    const name = path.basename(abs);
    throw new Error(
      `[bq:create:sectioncomponents] Missing ${name} but page sections were converted. ` +
        `Phase A codegen alone does not wire Partial Designs / page __Renderings. ` +
        `Re-run with --wire-only (or full create so Phase B completes) before authoring:generate / push.`,
    );
  }
}

/**
 * Fail closed: every nested presentation child must target a parent placeholder
 * that exists with non-empty allowedControls including the child definitionKey.
 *
 * @param {{
 *   hostSlug: string,
 *   pages?: Record<string, { renderings?: object[] }>|null,
 *   partials?: object[]|null,
 *   resolveSlots?: (definitionKey: string) => Promise<Array<{ key: string, allowedControls: string[] }>>,
 * }} opts
 */
export async function assertNestedPresentationPlaceholderParity(opts) {
  const hostSlug = String(opts.hostSlug || '').trim();
  if (!hostSlug) {
    throw new Error(
      '[bq:create:sectioncomponents] assertNestedPresentationPlaceholderParity: hostSlug required',
    );
  }

  const { extractPlaceholderSlotsFromDefinition, resolveDefinitionTsPath } =
    await import('./presentation.mjs');
  const { readFile } = await import('node:fs/promises');
  /** @type {Map<string, Array<{ key: string, allowedControls: string[] }>>} */
  const cache = new Map();

  /**
   * @param {string} definitionKey
   */
  async function slotsFor(definitionKey) {
    const key = String(definitionKey || '').trim();
    if (!key) return [];
    if (typeof opts.resolveSlots === 'function') {
      return opts.resolveSlots(key);
    }
    if (cache.has(key)) return cache.get(key) || [];
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
    cache.set(key, slots);
    return slots;
  }

  /** @type {string[]} */
  const errors = [];

  /**
   * @param {object[]} nodes
   * @param {string} parentKey
   * @param {string} ctx
   */
  async function walk(nodes, parentKey, ctx) {
    if (!parentKey || !Array.isArray(nodes) || !nodes.length) return;
    const slots = await slotsFor(parentKey);
    const byKey = new Map(slots.map((s) => [s.key, s]));
    for (const child of nodes) {
      const childKey = String(child?.definitionKey || '').trim();
      const ph = String(child?.placeholder || '').trim();
      if (!childKey) continue;
      if (!ph) {
        errors.push(
          `${ctx}: child "${childKey}" under "${parentKey}" has no placeholder`,
        );
        continue;
      }
      const slot = byKey.get(ph);
      if (!slot) {
        errors.push(
          `${ctx}: child "${childKey}" placeholder "${ph}" not on parent "${parentKey}" (keys: [${slots.map((s) => s.key).join(', ')}])`,
        );
        continue;
      }
      if (!slot.allowedControls.length) {
        errors.push(
          `${ctx}: child "${childKey}" placeholder "${ph}" on "${parentKey}" has empty allowedControls`,
        );
        continue;
      }
      if (!slot.allowedControls.includes(childKey)) {
        errors.push(
          `${ctx}: child "${childKey}" not in allowedControls for "${parentKey}" / "${ph}" (allowed: [${slot.allowedControls.join(', ')}])`,
        );
        continue;
      }
      if (Array.isArray(child.children) && child.children.length) {
        await walk(child.children, childKey, ctx);
      }
    }
  }

  for (const [pageKey, page] of Object.entries(opts.pages || {})) {
    for (const r of page?.renderings || []) {
      const parentKey = String(r?.definitionKey || '').trim();
      if (Array.isArray(r?.children) && r.children.length) {
        await walk(r.children, parentKey, `pages.${pageKey}`);
      }
    }
  }

  for (const partial of opts.partials || []) {
    const parentKey = String(partial?.definitionKey || '').trim();
    const sig = String(partial?.signature || parentKey || 'partial');
    if (Array.isArray(partial?.children) && partial.children.length) {
      await walk(partial.children, parentKey, `partial.${sig}`);
    }
  }

  if (errors.length) {
    throw new Error(
      `[bq:create:sectioncomponents] Nested placeholder parity failed:\n` +
        errors.map((e) => `  • ${e}`).join('\n'),
    );
  }
  return { ok: true, errors: [] };
}
