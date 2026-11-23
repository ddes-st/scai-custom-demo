/**
 * Resolve componentResults for a skip/wire-only section pass.
 * Prefer this-run shared codegen over stale page conversion logs.
 */
import { hydrateSiblingConversionComponents } from './content-item-names-hydrate.mjs';

/**
 * @param {{
 *   priorComponents?: object[],
 *   sharedBuiltThisRun?: Map<string, object>|null,
 *   registryFolder?: string|null,
 *   sharedReuse?: { componentFolder?: string, componentName?: string, definitionKey?: string, components?: object[], layoutSketch?: object|null }|null,
 *   stubFromReuse?: (reuse: object) => object[],
 * }} opts
 * @returns {{ componentResults: object[], layoutSketch: object|null, source: 'sharedBuiltThisRun'|'sharedReuse'|'prior' }}
 */
export function resolveWireComponentResults(opts) {
  const priorComponents = Array.isArray(opts.priorComponents)
    ? opts.priorComponents
    : [];
  const sharedReuse = opts.sharedReuse || null;
  const regFolder =
    opts.registryFolder || sharedReuse?.componentFolder || null;
  const built =
    regFolder && opts.sharedBuiltThisRun
      ? opts.sharedBuiltThisRun.get(regFolder)
      : null;

  if (built?.components?.length) {
    return {
      componentResults: built.components.map((c) => ({
        ...c,
        emitted: [],
      })),
      layoutSketch: built.layoutSketch || null,
      source: 'sharedBuiltThisRun',
    };
  }

  if (Array.isArray(sharedReuse?.components) && sharedReuse.components.length) {
    return {
      componentResults: sharedReuse.components.map((c) => ({
        ...c,
        emitted: [],
      })),
      layoutSketch: sharedReuse.layoutSketch || null,
      source: 'sharedReuse',
    };
  }

  if (
    sharedReuse?.componentName &&
    sharedReuse?.definitionKey &&
    typeof opts.stubFromReuse === 'function'
  ) {
    return {
      componentResults: opts.stubFromReuse(sharedReuse).map((c) => ({
        ...c,
        emitted: Array.isArray(c?.emitted) ? c.emitted : [],
      })),
      layoutSketch: sharedReuse.layoutSketch || null,
      source: 'sharedReuse',
    };
  }

  return {
    componentResults: hydrateSiblingConversionComponents(priorComponents),
    layoutSketch: null,
    source: 'prior',
  };
}
