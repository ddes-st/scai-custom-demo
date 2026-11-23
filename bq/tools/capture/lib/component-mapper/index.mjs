/**
 * Deterministic section naming for capture:webpage.
 * Evidence-first Domain+Suffix names; catalogue is soft metadata only.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifySection, classifySections } from './classifier.mjs';
import { nameSectionFromEvidence, toFolderName as namerFolder } from '../component-namer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { classifySection, classifySections };

/**
 * Chrome-only aliases (strong landmarks). Do NOT map generic ContentBand → Content Block.
 */
export const CAPTURE_ALIASES = {
  cookiebanner: 'Consent Banner',
  'cookie banner': 'Consent Banner',
  consentbanner: 'Consent Banner',
  // Landmark header chrome only — do NOT alias mid-page "navigation" bands to Header
  // (that spawned header-2 / header-N collision folders for unrelated sections).
  header: 'Header',
  footer: 'Footer',
  chatwidget: 'Chat Widget',
  floatingactionbutton: 'Floating Action Button',
};

export function toFolderName(name) {
  return namerFolder(name);
}

/**
 * Apply evidence-first naming; keep catalogue classify as soft mapping metadata.
 * @param {object[]} sections
 * @param {{ aliases?: Record<string, string>, minimumScore?: number, ambiguityMargin?: number }} [options]
 */
export function nameDetectedSections(sections, options = {}) {
  const aliases = { ...CAPTURE_ALIASES, ...(options.aliases || {}) };
  const usedFolders = new Map();

  return sections.map((section, index) => {
    const evidence = nameSectionFromEvidence({
      html: section.html || '',
      cmsName: section.cmsName,
      heading: section.heading,
      hints: section.hints || section.root?.hints || [],
      track: section.track,
      className: section.className || section.root?.className || '',
      selector: section.selector || '',
    });

    let cmsName = evidence.cmsName || section.cmsName || 'ContentBlock';
    let folderName = toFolderName(cmsName);
    const namingReasons = [...(evidence.reasons || [])];

    // Soft catalogue classify for diagnostics / optional synonym rewrite on chrome only.
    const detectedName = [cmsName, section.heading].filter(Boolean).join(' — ');
    const result = classifySection(
      {
        id: index + 1,
        detectedName,
        html: section.html || '',
        selector: section.selector || '',
        cmsName,
        heading: section.heading,
        folderName,
        track: section.track,
      },
      {
        aliases,
        minimumScore: options.minimumScore ?? 40,
        ambiguityMargin: options.ambiguityMargin ?? 10,
      },
    );

    // Only adopt catalogue name for strong chrome aliases or high-overlap soft match
    // when evidence was a weak generic fallback.
    const isWeakGeneric =
      /^(ContentBlock|ContentBand|ItemGrid|ItemCarousel|ItemCard|GenericBanner|CtaLinkBlock|CtaLink|CtaStrip|CtaBar|CtaBlock)$/i.test(
        cmsName,
      );
    const aliasHit = (result.primary?.reasons || []).some((r) => /alias/i.test(r));
    const chromeAlias =
      aliasHit &&
      /^(Header|Footer|ConsentBanner|ChatWidget|FloatingActionButton)$/i.test(
        String(result.primary?.name || '').replace(/[^A-Za-z0-9]+/g, ''),
      );

    // Only apply Header chrome alias for true header-track / landmark bands —
    // never for mid-page content that merely matched a navigation synonym.
    const track = String(section.track || '').toLowerCase();
    const isHeaderLandmark =
      track === 'header' ||
      /header|banner/i.test(String(section.selector || '')) ||
      /^(header|top.?bar|site.?header)/i.test(cmsName);
    if (
      chromeAlias &&
      result.primary?.name &&
      (!(/^Header$/i.test(String(result.primary.name).replace(/[^A-Za-z0-9]+/g, ''))) ||
        isHeaderLandmark)
    ) {
      cmsName = result.primary.name.replace(/[^A-Za-z0-9]+/g, '');
      folderName = result.primary.slug || toFolderName(result.primary.name);
      namingReasons.push(`Chrome alias → ${cmsName}`);
    } else if (
      isWeakGeneric &&
      result.status === 'matched' &&
      result.primary?.score >= 60 &&
      result.primary?.name &&
      !/content.?block/i.test(result.primary.name)
    ) {
      // Soft upgrade from ItemGrid etc. only when catalogue is clearly specific
      cmsName = result.primary.name.replace(/[^A-Za-z0-9]+/g, '');
      folderName = result.primary.slug || toFolderName(result.primary.name);
      namingReasons.push(`Soft catalogue upgrade → ${cmsName}`);
    }

    // Deduplicate folder names.
    const base = folderName;
    const n = usedFolders.get(base) || 0;
    usedFolders.set(base, n + 1);
    if (n > 0) folderName = `${base}-${n + 1}`;

    const alternatives = (result.alternatives || []).map((a) => ({
      name: a.name,
      slug: a.slug,
      score: a.score,
      confidence: a.confidence,
    }));

    return {
      ...section,
      index: index + 1,
      cmsName,
      folderName,
      name: folderName,
      detectedName,
      matchStatus: result.status,
      confidence: evidence.confidence ?? result.primary?.confidence ?? 0,
      reasons: namingReasons,
      alternatives,
      naming: {
        source: evidence.source,
        confidence: evidence.confidence,
        reasons: namingReasons,
      },
      mapping: {
        status: result.status,
        primary: result.primary,
        alternatives,
        diagnostics: result.diagnostics || [],
        note: 'Catalogue mapping is diagnostic; cmsName is evidence-first.',
      },
    };
  });
}

export const componentMapperDir = __dirname;
