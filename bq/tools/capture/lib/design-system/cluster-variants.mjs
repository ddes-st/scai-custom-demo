/**
 * Cluster style snapshots → weighted main variants.
 */
import { clusterKey, compactVariant, modeValue } from './style-utils.mjs';
import { nameVariant, uniquifyNames } from './variant-name.mjs';
import { MIN_SHARE } from './constants.mjs';

function pickRepresentative(members) {
  // Prefer node with median padding area / first
  return members[0];
}

function emitStyle(snap) {
  const style = compactVariant({
    color: snap.color === 'transparent' ? null : snap.color,
    backgroundColor: snap.backgroundColor === 'transparent' ? null : snap.backgroundColor,
    borderColor: snap.borderColor === 'transparent' ? null : snap.borderColor,
    borderWidth: snap.borderWidth === '0px' ? null : snap.borderWidth,
    borderStyle: !snap.borderStyle || snap.borderStyle === 'none' ? null : snap.borderStyle,
    fontFamily: snap.fontFamily,
    fontSize: snap.fontSize,
    fontWeight: snap.fontWeight,
    fontStyle: snap.fontStyle === 'normal' ? null : snap.fontStyle,
    lineHeight: snap.lineHeight,
    letterSpacing: snap.letterSpacing === 'normal' ? null : snap.letterSpacing,
    textTransform: snap.textTransform === 'none' ? null : snap.textTransform,
    textDecoration: !snap.textDecoration || snap.textDecoration === 'none' ? null : snap.textDecoration,
    textAlign: snap.textAlign,
    borderRadius: snap.borderRadius === '0px' ? null : snap.borderRadius,
    padding: meaningfulBox(snap.padding),
    margin: meaningfulBox(snap.margin),
    gap: snap.gap === '0px' || snap.gap === 'normal' ? null : snap.gap,
    boxShadow: !snap.boxShadow || snap.boxShadow === 'none' ? null : snap.boxShadow,
    display: snap.display,
    alignItems: snap.alignItems === 'normal' ? null : snap.alignItems,
    justifyContent: snap.justifyContent === 'normal' ? null : snap.justifyContent,
    maxWidth: snap.maxWidth,
    whiteSpace: snap.whiteSpace === 'normal' ? null : snap.whiteSpace,
  });
  return style;
}

function meaningfulBox(box) {
  if (!box) return null;
  const vals = [box.top, box.right, box.bottom, box.left];
  if (vals.every((v) => !v || v === '0px')) return null;
  return box;
}

/**
 * @param {object[]} snapshots
 * @param {{ kind: string, cap: number }} opts
 */
export function clusterToMainVariants(snapshots, { kind, cap }) {
  if (!snapshots?.length) return [];

  const groups = new Map();
  for (const snap of snapshots) {
    const key = clusterKey(snap);
    const list = groups.get(key) ?? [];
    list.push(snap);
    groups.set(key, list);
  }

  const total = snapshots.length;
  let variants = [...groups.values()]
    .map((members) => {
      const rep = pickRepresentative(members);
      const count = members.length;
      return {
        ...emitStyle(rep),
        name: nameVariant(rep, { kind }),
        weight: { count, share: Math.round((count / total) * 1000) / 1000 },
        _selectors: members.map((m) => m.selector).filter(Boolean).slice(0, 5),
        _filled: Boolean(rep.backgroundColor && rep.backgroundColor !== 'transparent'),
      };
    })
    .sort((a, b) => {
      // Prefer filled / CTA-looking variants for buttons
      if (kind === 'button' && a._filled !== b._filled) return a._filled ? -1 : 1;
      return b.weight.count - a.weight.count;
    });

  // Drop rare one-offs when stronger exist (keep filled buttons even at count 1)
  if (variants.length > 1) {
    variants = variants.filter((v, i) => {
      if (i === 0) return true;
      if (kind === 'button' && v._filled) return true;
      if (v.weight.count < 2 && variants.length > 1) return false;
      if (v.weight.share < MIN_SHARE && variants.filter((x) => x.weight.share >= MIN_SHARE).length >= 1) {
        return false;
      }
      return true;
    });
  }

  variants = variants.slice(0, cap);
  variants = uniquifyNames(variants);

  // Strip internal fields
  return variants.map(({ _selectors, _filled, ...rest }) => rest);
}

/**
 * Mode of horizontal inset / padding from section-like snapshots.
 */
export function inferSectionRhythm(sectionSnaps) {
  if (!sectionSnaps?.length) {
    return {
      horizontalInset: null,
      verticalSpacing: null,
      padding: null,
    };
  }

  const preferNonZero = (values) => {
    const all = values.filter(Boolean);
    const nz = all.filter((v) => v !== '0px');
    return modeValue(nz.length ? nz : all);
  };

  const leftPads = sectionSnaps.map((s) => s.padding?.left).filter(Boolean);
  const rightPads = sectionSnaps.map((s) => s.padding?.right).filter(Boolean);
  const topPads = sectionSnaps.map((s) => s.padding?.top).filter(Boolean);
  const bottomPads = sectionSnaps.map((s) => s.padding?.bottom).filter(Boolean);
  const marginTops = sectionSnaps.map((s) => s.margin?.top).filter(Boolean);
  const marginBottoms = sectionSnaps.map((s) => s.margin?.bottom).filter(Boolean);

  const insetL = preferNonZero(leftPads);
  const insetR = preferNonZero(rightPads);
  const horizontalInset = insetL || insetR || null;

  return {
    horizontalInset,
    verticalSpacing: compactVariant({
      marginTop: preferNonZero(marginTops),
      marginBottom: preferNonZero(marginBottoms),
    }),
    padding: compactVariant({
      top: preferNonZero(topPads),
      right: preferNonZero(rightPads),
      bottom: preferNonZero(bottomPads),
      left: preferNonZero(leftPads),
    }),
  };
}

export { modeValue };
