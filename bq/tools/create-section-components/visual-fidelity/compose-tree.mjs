/**
 * Compose parent + children for AppPlaceholder mock during visual fidelity.
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { componentDir } from '../write-component.mjs';
import { toKebabCase } from '../naming.mjs';
import { ensureNavigationReferenceForTsxFile } from '../ensure-navigation-reference.mjs';
import { buildPreviewProps } from './build-preview-props.mjs';
import { hydrateDirectMappedJsonBagFields } from '../json-bag-field-map.mjs';
import { placeholderKeyForHeterogeneousChild } from '../placeholder-contract.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse placeholders: [{ key, allowedControls }] from a parent definition.ts.
 * @param {string} definitionTs
 * @returns {Array<{ key: string, allowedControls: string[] }>}
 */
export function parsePlaceholderSlotsFromDefinition(definitionTs) {
  const text = String(definitionTs || '');
  const slots = [];
  const phBlock = text.match(/placeholders\s*:\s*\[([\s\S]*?)\]\s*,?\s*(?:content|variants|satisfies)/);
  const body = phBlock ? phBlock[1] : '';
  const re =
    /\{\s*key\s*:\s*["']([^"']+)["']\s*,\s*allowedControls\s*:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(body || text))) {
    const key = m[1];
    const ctrls = [...m[2].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
    slots.push({ key, allowedControls: ctrls });
  }
  if (!slots.length) {
    const single = text.match(
      /placeholders\s*:\s*\[\s*\{\s*key\s*:\s*["']([^"']+)["']/,
    );
    if (single) slots.push({ key: single[1], allowedControls: [] });
  }
  return slots;
}

/**
 * @param {string} definitionKeyOrName
 * @param {string[]} allowed
 */
function allowedMatchesPackage(definitionKeyOrName, allowed) {
  const oKey = String(definitionKeyOrName || '').trim();
  if (!oKey || !allowed?.length) return false;
  if (allowed.includes(oKey)) return true;
  const short = oKey.includes('-') ? oKey.split('-').slice(1).join('-') : oKey;
  if (short && allowed.includes(short)) return true;
  const kebab = toKebabCase(oKey);
  for (const a of allowed) {
    if (oKey === a || oKey.endsWith(`-${a}`) || a.endsWith(`-${oKey}`)) return true;
    if (short && (a === short || a.endsWith(`-${short}`))) return true;
    if (kebab && (a === kebab || kebab.endsWith(a) || a.endsWith(kebab))) return true;
  }
  return false;
}

/**
 * Resolve which parent placeholder a child package mounts into.
 * @param {{
 *   componentName: string,
 *   definitionKey?: string,
 *   slots: Array<{ key: string, allowedControls: string[] }>,
 *   fallbackKey: string,
 * }} opts
 */
export function resolveChildMountPlaceholder(opts) {
  const { componentName, definitionKey, slots, fallbackKey } = opts;
  const key =
    String(definitionKey || '').trim() ||
    toKebabCase(componentName);
  if (slots.length > 1) {
    for (const slot of slots) {
      if (allowedMatchesPackage(key, slot.allowedControls)) return slot.key;
      if (
        allowedMatchesPackage(toKebabCase(componentName), slot.allowedControls)
      ) {
        return slot.key;
      }
    }
    const inferred = placeholderKeyForHeterogeneousChild(
      { componentName, definitionKey: key },
      key,
    );
    if (inferred && slots.some((s) => s.key === inferred)) return inferred;
  }
  return slots[0]?.key || fallbackKey || 'main';
}

/**
 * @param {{
 *   hostSlug: string,
 *   parentComponentName: string,
 *   childComponentNames?: string[],
 *   instancePlan?: Array<{ componentName: string, datasourceItem?: string, placeholder?: string }>|null,
 *   layoutSketch?: object|null,
 *   placeholderKey?: string|null,
 * }} opts
 */
export async function loadComponentPackages(opts) {
  const {
    hostSlug,
    parentComponentName,
    childComponentNames = [],
    placeholderKey = null,
  } = opts;
  const parentDir = componentDir(hostSlug, parentComponentName);
  const parentKebab = toKebabCase(parentComponentName);
  const parentTsx = path.join(parentDir, `${parentKebab}.tsx`);
  const parentDef = path.join(parentDir, `${parentKebab}.definition.ts`);
  const parentClient = path.join(parentDir, `${parentKebab}.client.tsx`);

  if (!(await exists(parentTsx)) || !(await exists(parentDef))) {
    throw new Error(`Missing parent package for ${parentComponentName}`);
  }

  // Materialize prompt-only Navigation.reference beside packages that import it
  // so esbuild/Next can resolve helpers on already-written disk packages.
  await ensureNavigationReferenceForTsxFile(parentTsx);
  if (await exists(parentClient)) {
    await ensureNavigationReferenceForTsxFile(parentClient);
  }

  const parentDefinitionTs = await readFile(parentDef, 'utf8');
  const parentProps = buildPreviewProps(parentDefinitionTs);
  const slots = parsePlaceholderSlotsFromDefinition(parentDefinitionTs);

  /** @type {Array<{ componentName: string, datasourceItem?: string, placeholder?: string }>} */
  let instancePlan = Array.isArray(opts.instancePlan) ? opts.instancePlan : [];
  if (!instancePlan.length && opts.layoutSketch) {
    const { collectLayoutSketchInstancePlan } = await import(
      '../html-multi-band-contract.mjs'
    );
    instancePlan = collectLayoutSketchInstancePlan(opts.layoutSketch);
  }

  /**
   * @param {string} name
   */
  async function loadChildPackage(name) {
    const dir = componentDir(hostSlug, name);
    const kebab = toKebabCase(name);
    const tsx = path.join(dir, `${kebab}.tsx`);
    const def = path.join(dir, `${kebab}.definition.ts`);
    if (!(await exists(tsx)) || !(await exists(def))) {
      return null;
    }
    await ensureNavigationReferenceForTsxFile(tsx);
    const childClient = path.join(dir, `${kebab}.client.tsx`);
    if (await exists(childClient)) {
      await ensureNavigationReferenceForTsxFile(childClient);
    }
    const definitionTs = await readFile(def, 'utf8');
    const childTsxSource = await readFile(tsx, 'utf8');
    const defKeyMatch = definitionTs.match(/definitionKey\s*:\s*["']([^"']+)["']/);
    const definitionKey = defKeyMatch?.[1] || kebab;
    return { name, tsx, def, definitionTs, childTsxSource, definitionKey };
  }

  /**
   * @param {object} pkg
   * @param {string|null} itemName
   * @param {string} mountPh
   * @param {number} index
   * @param {object[]} childrenOut
   */
  async function pushMount(pkg, itemName, mountPh, index, childrenOut) {
    const {
      buildFlatFieldsProps,
      mergePreviewFieldsForItem,
      buildPreviewProps: buildProps,
    } = await import('./build-preview-props.mjs');
    const itemProps = buildProps(pkg.definitionTs, itemName || null);
    const flat = buildFlatFieldsProps(pkg.definitionTs, itemName || null);
    const mergedFields = mergePreviewFieldsForItem(
      itemProps.fields,
      flat.fields,
      pkg.definitionTs,
    );
    childrenOut.push({
      componentName: pkg.name,
      tsxPath: pkg.tsx,
      definitionPath: pkg.def,
      placeholderKey: mountPh,
      props: {
        ...itemProps,
        // Per-item fields win; Image omitted on an item must not inherit the first item's Image.
        // Hydrate Multi-LineText JSON bags when TSX does fields.X.map (avoids blank proof shots).
        fields: hydrateDirectMappedJsonBagFields(mergedFields, pkg.childTsxSource),
        params: {
          ...itemProps.params,
          RenderingIdentifier: `bq-child-${index}`,
        },
      },
      datasourceItem: itemName || pkg.name,
    });
  }

  /** @type {object[]} */
  const children = [];

  if (instancePlan.length) {
    let mountIndex = 0;
    /** @type {Map<string, object>} */
    const pkgCache = new Map();
    for (const row of instancePlan) {
      const name = String(row?.componentName || '').trim();
      if (!name) continue;
      let pkg = pkgCache.get(name);
      if (!pkg) {
        pkg = await loadChildPackage(name);
        if (!pkg) {
          console.warn(`  ⚠ Visual fidelity: child package missing for ${name}`);
          continue;
        }
        pkgCache.set(name, pkg);
      }
      const mountPh =
        String(row?.placeholder || '').trim() ||
        resolveChildMountPlaceholder({
          componentName: name,
          definitionKey: pkg.definitionKey,
          slots,
          fallbackKey: placeholderKey || slots[0]?.key || 'main',
        });
      const itemName = String(row?.datasourceItem || '').trim() || null;
      await pushMount(pkg, itemName, mountPh, mountIndex++, children);
    }
  } else {
    for (const name of childComponentNames) {
      const pkg = await loadChildPackage(name);
      if (!pkg) {
        console.warn(`  ⚠ Visual fidelity: child package missing for ${name}`);
        continue;
      }
      const mountPh = resolveChildMountPlaceholder({
        componentName: name,
        definitionKey: pkg.definitionKey,
        slots,
        fallbackKey: placeholderKey || slots[0]?.key || 'main',
      });
      const { parseContentItemsFromDefinition } = await import(
        '../content-family-apply.mjs'
      );
      const items = parseContentItemsFromDefinition(pkg.definitionTs);
      const mounts = items.length ? items : [{ name }];
      for (let i = 0; i < mounts.length; i++) {
        await pushMount(pkg, mounts[i].name || name, mountPh, i, children);
      }
    }
  }

  let phKey = placeholderKey;
  if (!phKey) {
    phKey = slots[0]?.key || null;
  }

  return {
    parent: {
      componentName: parentComponentName,
      tsxPath: parentTsx,
      clientTsxPath: (await exists(parentClient)) ? parentClient : null,
      definitionPath: parentDef,
      props: parentProps,
    },
    children,
    placeholderKey: phKey || 'main',
    placeholderSlots: slots,
  };
}
