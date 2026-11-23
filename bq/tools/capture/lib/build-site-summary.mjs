/**
 * Aggregate per-page design tokens into a concise site-level summary.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isGradientValue,
  isHexValue,
  normalizeColorRole,
  rgbToHex,
} from './extract-page-design.mjs';

const SYSTEM_FONTS = new Set([
  '-apple-system',
  'system-ui',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Arial',
  'sans-serif',
]);

function mergeFonts(pageSummaries) {
  const map = new Map();
  for (const page of pageSummaries) {
    for (const font of page.detectedFonts?.fonts ?? []) {
      if (SYSTEM_FONTS.has(font.family)) continue;
      const key = font.family;
      const existing = map.get(key) ?? { family: key, weight: 0, sources: new Set() };
      existing.weight += font.count ?? 1;
      for (const url of font.sources ?? []) {
        if (url) existing.sources.add(url);
      }
      for (const file of font.files ?? []) {
        if (file?.href) existing.sources.add(file.href);
      }
      for (const sheet of font.stylesheets ?? []) {
        if (sheet) existing.sources.add(sheet);
      }
      map.set(key, existing);
    }
    // Also collect from legacy design guide typography / actions if present
    const walk = (variants) => {
      for (const v of variants || []) {
        const family = v.fontFamily;
        if (!family || SYSTEM_FONTS.has(family)) continue;
        const existing = map.get(family) ?? { family, weight: 0, sources: new Set() };
        existing.weight += v.weight?.count ?? 1;
        map.set(family, existing);
      }
    };
    const typo = page.design?.typography || {};
    for (const block of Object.values(typo)) walk(block?.variants);
    walk(page.design?.actions?.button?.variants);
    walk(page.design?.links?.variants);
  }
  return [...map.values()]
    .sort((a, b) => b.weight - a.weight)
    .map(({ family, weight, sources }) => ({
      family,
      weight,
      sources: preferFontUrlsFromSet(sources),
    }));
}

function preferFontUrlsFromSet(urlSet) {
  const FONT_FILE_EXT = /\.(woff2?|ttf|otf|eot|svg)(\?|#|$)/i;
  const score = (url) => {
    if (/\.woff2(\?|#|$)/i.test(url)) return 5;
    if (/\.woff(\?|#|$)/i.test(url)) return 4;
    if (/\.ttf(\?|#|$)/i.test(url)) return 3;
    if (/\.otf(\?|#|$)/i.test(url)) return 2;
    if (/\.eot(\?|#|$)/i.test(url)) return 1;
    return 0;
  };
  const urls = [...urlSet];
  const fileUrls = urls.filter((u) => FONT_FILE_EXT.test(u)).sort((a, b) => score(b) - score(a) || a.localeCompare(b));
  const otherUrls = urls.filter((u) => !FONT_FILE_EXT.test(u)).sort();
  return [...fileUrls, ...otherUrls];
}

/** Summarize colors from page design objects when present (legacy guides). */
function mergeColorsFromGuide(pageSummaries) {
  const buttons = new Map();
  const links = new Map();
  const surfaces = new Map();
  const text = new Map();

  const add = (map, hex, weight = 1) => {
    if (!hex || !String(hex).startsWith('#')) return;
    const key = hex.toLowerCase();
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  for (const page of pageSummaries) {
    const d = page.design;
    if (!d) continue;
    for (const v of d.actions?.button?.variants || []) {
      add(buttons, v.backgroundColor, v.weight?.count ?? 1);
      add(buttons, v.color, v.weight?.count ?? 1);
      add(text, v.color, v.weight?.count ?? 1);
    }
    for (const v of d.links?.variants || []) {
      add(links, v.color, v.weight?.count ?? 1);
      add(buttons, v.backgroundColor, v.weight?.count ?? 1);
    }
    for (const v of d.layout?.section?.surfaces || []) {
      add(surfaces, v.backgroundColor, v.weight?.count ?? 1);
      add(text, v.color, v.weight?.count ?? 1);
    }
    for (const block of Object.values(d.typography || {})) {
      for (const v of block?.variants || []) {
        add(text, v.color, v.weight?.count ?? 1);
      }
    }
    // Legacy colors.primary support
    const { hex: primaryHex } = normalizeColorRole(d.colors?.primary);
    for (const h of primaryHex) add(buttons, h, 1);
  }

  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([hex]) => hex);

  return {
    buttons: top(buttons, 6),
    links: top(links, 4),
    surfaces: top(surfaces, 6),
    text: top(text, 8),
  };
}

function mergeStylesheets(pageSummaries) {
  const files = new Set();
  for (const page of pageSummaries) {
    const cssFiles = page.detectedCss?.files ?? page.design?.css?.files ?? [];
    for (const file of cssFiles) {
      const name = path.basename(file.file || file.href || '');
      if (name) files.add(name);
    }
  }
  return [...files].sort();
}

function summarizeSectionNames(sectionsManifest) {
  const site = [];
  const content = [];
  for (const c of Object.values(sectionsManifest?.components ?? {})) {
    if (c.scope === 'site' || c.isStickyOverlay) site.push(c.cmsName);
    else if (c.type !== 'card' || c.captureScreenshot) content.push(c.cmsName);
  }
  return {
    site: [...new Set(site)].sort(),
    content: [...new Set(content)].sort(),
  };
}

function summarizeDetectedSections(detected) {
  const site = [];
  const content = [];
  for (const s of detected?.sections ?? []) {
    if (s.track === 'overlay') site.push(s.cmsName);
    else content.push(s.cmsName);
  }
  return {
    site: [...new Set(site)].sort(),
    content: [...new Set(content)].sort(),
  };
}

async function readPageManifests(projectRoot) {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const pages = [];
  const allDetectedSections = { components: {} };

  for (const entry of entries) {
    if (
      !entry.isDirectory() ||
      entry.name === 'sections' ||
      entry.name === 'section-registry' ||
      entry.name === 'section-registry-ai' ||
      entry.name === 'shared-sections' ||
      entry.name === 'shared-sections-ai' ||
      entry.name === 'ai-sections' ||
      entry.name === 'sections'
    ) {
      continue;
    }
    const pageDir = path.join(projectRoot, entry.name);

    let url = null;
    let slug = entry.name;
    let design = null;

    try {
      const raw = JSON.parse(await readFile(path.join(pageDir, 'page-manifest.json'), 'utf8'));
      url = raw.url ?? null;
      slug = raw.slug ?? entry.name;
      design = raw.design ?? null;
    } catch {
      /* prefer detectedSections / source-url */
    }

    try {
      const detected = JSON.parse(
        await readFile(path.join(pageDir, 'detected-sections.json'), 'utf8'),
      );
      url = url || detected.url || null;
      for (const s of detected.sections || []) {
        if (!s?.cmsName) continue;
        allDetectedSections.components[s.cmsName] = {
          cmsName: s.cmsName,
          scope: s.track === 'overlay' ? 'site' : 'page',
          isStickyOverlay: s.track === 'overlay',
          type: s.track === 'overlay' ? 'overlay' : 'section',
          captureScreenshot: true,
        };
      }
    } catch {
      /* no detectedSections yet */
    }

    try {
      url = url || (await readFile(path.join(pageDir, 'source-url.txt'), 'utf8')).trim();
    } catch {
      /* no source url */
    }

    if (!design) {
      // Prefer page-manifest.design; optional legacy JSON guides are best-effort only.
      try {
        design = JSON.parse(await readFile(path.join(pageDir, 'derived-design-guide.json'), 'utf8'));
      } catch {
        try {
          design = JSON.parse(await readFile(path.join(pageDir, 'detected-design-information.json'), 'utf8'));
        } catch {
          try {
            design = JSON.parse(await readFile(path.join(pageDir, 'captured-design-information.json'), 'utf8'));
          } catch {
            /* ai-derived-design.md is the canonical design artifact now */
          }
        }
      }
    }

    let detectedFonts = null;
    try {
      detectedFonts = JSON.parse(await readFile(path.join(pageDir, 'detected-fonts.json'), 'utf8'));
    } catch {
      /* no detected fonts yet */
    }

    let detectedCss = null;
    try {
      detectedCss = JSON.parse(await readFile(path.join(pageDir, 'detected-css.json'), 'utf8'));
    } catch {
      /* no detected css yet */
    }

    if (!url && !design && !detectedFonts && !detectedCss) continue;
    pages.push({ slug, url, design, detectedFonts, detectedCss });
  }

  return {
    pages: pages.sort((a, b) => a.slug.localeCompare(b.slug)),
    detectedManifest: allDetectedSections,
  };
}

/**
 * @param {string} projectRoot — design-screenshots/{domain}
 * @param {object} [sectionsManifest] — parsed sections/manifest.json (optional, legacy)
 */
export async function buildSiteSummary(projectRoot, sectionsManifest = null) {
  const { pages, detectedManifest } = await readPageManifests(projectRoot);

  if (!sectionsManifest) {
    try {
      sectionsManifest = JSON.parse(
        await readFile(path.join(projectRoot, 'section-registry', 'manifest.json'), 'utf8'),
      );
    } catch {
      try {
        sectionsManifest = JSON.parse(
          await readFile(path.join(projectRoot, 'shared-sections', 'manifest.json'), 'utf8'),
        );
      } catch {
        try {
          sectionsManifest = JSON.parse(
            await readFile(path.join(projectRoot, 'sections', 'manifest.json'), 'utf8'),
          );
        } catch {
          sectionsManifest = detectedManifest;
        }
      }
    }
  }

  const pagesWithDesign = pages.filter((p) => p.design);
  const sectionNames =
    Object.keys(sectionsManifest?.components || {}).length > 0
      ? summarizeSectionNames(sectionsManifest)
      : summarizeDetectedSections({
          sections: Object.values(detectedManifest.components || {}).map((c) => ({
            cmsName: c.cmsName,
            track: c.isStickyOverlay ? 'overlay' : 'content',
          })),
        });

  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    project: path.basename(projectRoot),
    urls: pages.map((p) => p.url).filter(Boolean),
    sections: sectionNames,
    fonts: mergeFonts(pagesWithDesign),
    colors: mergeColorsFromGuide(pagesWithDesign),
    stylesheets: mergeStylesheets(pagesWithDesign),
  };

  const outPath = path.join(projectRoot, 'site-summary.json');
  await writeFile(outPath, JSON.stringify(summary, null, 2), 'utf8');
  return { path: outPath, summary };
}
