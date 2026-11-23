/**
 * Deterministic variant names from style traits.
 */
import { appearanceClass, colorLabel, isTransparent } from './style-utils.mjs';

export function nameVariant(snap, { kind = 'generic' } = {}) {
  if (kind === 'surface' || kind === 'section') {
    const bg = colorLabel(snap.backgroundColor);
    const fg = colorLabel(snap.color);
    if (isTransparent(snap.backgroundColor)) return `SurfaceOn${fg}`;
    return `${bg}Band`;
  }

  if (kind === 'heading' || kind === 'body') {
    const fg = colorLabel(snap.color);
    const size = snap.fontSize ? String(snap.fontSize).replace('px', '') : '';
    const weight = snap.fontWeight === '700' || Number(snap.fontWeight) >= 600 ? 'Bold' : '';
    return `${weight}${fg}${size ? size : ''}`.replace(/^\d/, 'Size$&') || 'Text';
  }

  if (kind === 'link') {
    const fg = colorLabel(snap.color);
    const deco = snap.textDecoration && snap.textDecoration !== 'none' ? 'Underline' : '';
    return `${fg}${deco}Link` || 'DefaultLink';
  }

  // button / action
  const appearance = appearanceClass(snap);
  const fill = isTransparent(snap.backgroundColor)
    ? colorLabel(snap.color)
    : colorLabel(snap.backgroundColor);
  const bw = snap.borderWidth && snap.borderWidth !== '0px';
  const outline =
    bw && snap.borderColor && snap.borderColor !== 'transparent'
      ? `Outline${colorLabel(snap.borderColor)}`
      : '';
  if (appearance === 'Ghost') return `Ghost${colorLabel(snap.color)}`;
  if (appearance === 'Outline') return `Outline${colorLabel(snap.borderColor || snap.color)}`;
  return `Filled${fill}${outline && !fill.includes(outline.replace('Outline', '')) ? outline : ''}`;
}

export function uniquifyNames(variants) {
  const seen = new Map();
  return variants.map((v) => {
    let name = v.name || 'Variant';
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n > 1) name = `${name}Alt${n}`;
    return { ...v, name };
  });
}
