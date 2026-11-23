/**
 * Build typography / actions / links / layout from samples.
 */
import { VARIANT_CAPS } from './constants.mjs';
import { clusterToMainVariants, inferSectionRhythm } from './cluster-variants.mjs';
import { probeHoverAndPseudos } from './probe-states.mjs';
import { compactVariant } from './style-utils.mjs';

async function attachStates(page, variants) {
  if (!variants?.length || !page) return variants;
  const out = [];
  for (const v of variants) {
    const selectors = v._selectors || [];
    const states = await probeHoverAndPseudos(page, selectors);
    const { _selectors, ...rest } = v;
    out.push(
      compactVariant({
        ...rest,
        hover: states.hover,
        before: states.before,
        after: states.after,
      }),
    );
  }
  return out;
}

function stripInternal(variants) {
  return (variants || []).map(({ _selectors, ...rest }) => rest);
}

/**
 * Keep _selectors on variants for probing.
 */
export function buildGuideParts(sample) {
  const typography = {
    h1: { variants: clusterToMainVariants(sample.h1, { kind: 'heading', cap: VARIANT_CAPS.h1 }) },
    h2: { variants: clusterToMainVariants(sample.h2, { kind: 'heading', cap: VARIANT_CAPS.h2 }) },
    h3: { variants: clusterToMainVariants(sample.h3, { kind: 'heading', cap: VARIANT_CAPS.h3 }) },
    body: { variants: clusterToMainVariants(sample.body, { kind: 'body', cap: VARIANT_CAPS.body }) },
  };

  // Re-cluster with selectors preserved — update cluster module usage
  // clusterToMainVariants currently strips selectors; patch by re-adding from sample match
  for (const key of ['h1', 'h2', 'h3', 'body']) {
    typography[key].variants = withSelectors(typography[key].variants, sample[key === 'body' ? 'body' : key]);
  }

  const buttonVariants = withSelectors(
    clusterToMainVariants(sample.buttons, { kind: 'button', cap: VARIANT_CAPS.button }),
    sample.buttons,
  );
  const linkVariants = withSelectors(
    clusterToMainVariants(sample.links, { kind: 'link', cap: VARIANT_CAPS.link }),
    sample.links,
  );

  const surfaces = clusterToMainVariants(sample.sections, {
    kind: 'surface',
    cap: VARIANT_CAPS.surface,
  })
    .filter((v) => v.backgroundColor)
    .map((v) =>
      compactVariant({
        name: v.name,
        weight: v.weight,
        backgroundColor: v.backgroundColor,
        color: v.color,
      }),
    );

  const rhythm = inferSectionRhythm(sample.sections);

  return {
    typography,
    actions: { button: { variants: buttonVariants } },
    links: { variants: linkVariants },
    layout: {
      section: {
        ...rhythm,
        surfaces,
      },
      contentMaxWidth: inferMaxWidth(sample.sections),
    },
  };
}

function withSelectors(variants, snaps) {
  if (!variants?.length) return [];
  return variants.map((v) => {
    const matches = (snaps || []).filter((s) => styleMatchesVariant(s, v));
    return {
      ...v,
      _selectors: matches.map((m) => m.selector).filter(Boolean).slice(0, 6),
    };
  });
}

function styleMatchesVariant(snap, variant) {
  return (
    (snap.color || null) === (variant.color || null) &&
    (snap.backgroundColor || null) === (variant.backgroundColor || null) &&
    (snap.fontSize || null) === (variant.fontSize || null) &&
    (snap.fontWeight || null) === (variant.fontWeight || null)
  );
}

function inferMaxWidth(sections) {
  const widths = (sections || [])
    .map((s) => s.maxWidth)
    .filter((w) => w && w !== 'none');
  if (!widths.length) return null;
  const counts = new Map();
  for (const w of widths) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export async function finalizeGuideParts(page, parts) {
  const typography = { ...parts.typography };
  for (const key of ['h1', 'h2', 'h3', 'body']) {
    typography[key] = {
      variants: stripInternal(await attachStates(page, typography[key].variants)),
    };
    if (!typography[key].variants.length) delete typography[key];
  }

  const buttons = stripInternal(await attachStates(page, parts.actions.button.variants));
  const links = stripInternal(await attachStates(page, parts.links.variants));

  return {
    typography,
    actions: { button: { variants: buttons } },
    links: { variants: links },
    layout: parts.layout,
  };
}

/**
 * Diff base vs other viewport samples → responsive deltas on typography + layout.
 */
export function applyResponsiveDeltas(baseParts, width, otherSample) {
  const otherParts = buildGuideParts(otherSample);

  // Typography fontSize deltas by best name/weight match
  for (const key of ['h1', 'h2', 'h3', 'body']) {
    const baseVars = baseParts.typography[key]?.variants || [];
    const otherVars = otherParts.typography[key]?.variants || [];
    if (!baseVars.length || !otherVars.length) continue;
    for (const bv of baseVars) {
      const ov = otherVars[0]; // highest weight at that viewport
      if (ov?.fontSize && ov.fontSize !== bv.fontSize) {
        bv.responsive = bv.responsive || {};
        bv.responsive[String(width)] = compactVariant({ fontSize: ov.fontSize });
      }
      if (ov?.padding && JSON.stringify(ov.padding) !== JSON.stringify(bv.padding)) {
        bv.responsive = bv.responsive || {};
        bv.responsive[String(width)] = {
          ...(bv.responsive[String(width)] || {}),
          ...compactVariant({ padding: ov.padding }),
        };
      }
    }
  }

  // Button padding deltas
  const baseBtns = baseParts.actions?.button?.variants || [];
  const otherBtns = otherParts.actions?.button?.variants || [];
  if (baseBtns.length && otherBtns.length) {
    const ov = otherBtns[0];
    for (const bv of baseBtns) {
      if (ov.padding && JSON.stringify(ov.padding) !== JSON.stringify(bv.padding)) {
        bv.responsive = bv.responsive || {};
        bv.responsive[String(width)] = compactVariant({ padding: ov.padding });
      }
    }
  }

  // Layout section rhythm
  const otherRhythm = otherParts.layout?.section;
  if (otherRhythm) {
    const section = baseParts.layout.section;
    section.responsive = section.responsive || {};
    section.responsive[String(width)] = compactVariant({
      horizontalInset: otherRhythm.horizontalInset,
      verticalSpacing: otherRhythm.verticalSpacing,
      padding: otherRhythm.padding,
    });
  }

  return baseParts;
}
