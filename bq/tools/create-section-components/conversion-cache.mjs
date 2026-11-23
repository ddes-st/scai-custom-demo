/**
 * Skip Azure visual/sitecoreize when section conversion inputs are unchanged.
 */
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, bqRoot } from '../capture/paths.mjs';
import { loadLocalEnvFiles } from '../capture/lib/design-system/load-env.mjs';

/** Bump to invalidate all conversion skips (prompt/evidence pipeline changes). */
export const CONVERSION_PIPELINE_VERSION =
  'create-section-components/v14-field-types-from-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, 'prompts');

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

async function fileHash(absPath) {
  try {
    const text = await readFile(absPath, 'utf8');
    return sha256Hex(text);
  } catch {
    return sha256Hex('');
  }
}

/**
 * Hash preferred section HTML for cache (styled-desktop → styled → section.html).
 * @param {string} pageDir
 * @param {string} sectionFolder
 * @param {object} info
 */
async function preferredSectionHtmlHash(pageDir, sectionFolder, info) {
  const sectionDir = path.join(pageDir, 'sections', sectionFolder);
  const candidates = [
    'section.styled-desktop.html',
    'section.styled.html',
    'section.styled-tablet.html',
    'section.styled-mobile.html',
  ];
  for (const file of candidates) {
    const abs = path.join(sectionDir, file);
    try {
      const text = await readFile(abs, 'utf8');
      if (text.trim()) return sha256Hex(`${file}\n${text}`);
    } catch {
      /* next */
    }
  }
  const fallbackRel = info?.sectionHtml || `sections/${sectionFolder}/section.html`;
  return fileHash(path.join(pageDir, fallbackRel));
}

/**
 * Stable subset of section-information.json that affects AI outputs.
 * @param {object} info
 */
export function stableSectionInfoForHash(info) {
  const states = Array.isArray(info?.interactionStates)
    ? info.interactionStates.map((s) => ({
        kind: s?.kind ?? null,
        slug: s?.slug ?? null,
        folder: s?.folder ?? null,
      }))
    : [];
  return {
    cmsName: info?.cmsName ?? null,
    purpose: info?.purpose ?? null,
    description: info?.description ?? null,
    layout: info?.layout ?? null,
    repeats: info?.repeats ?? null,
    track: info?.track ?? null,
    suggestedFields: info?.suggestedFields ?? null,
    interactionStates: states,
  };
}

/**
 * @param {{
 *   info: object,
 *   designMdPath: string,
 *   collectionSystem: string,
 *   pageDir?: string,
 *   sectionFolder?: string,
 *   sharedDesignPrefix?: string,
 * }} opts
 */
export async function computeConversionSourceHash(opts) {
  const {
    info,
    designMdPath,
    collectionSystem,
    pageDir,
    sectionFolder,
    sharedDesignPrefix,
  } = opts;
  const [
    designHash,
    visualPromptHash,
    sitecoreizePromptHash,
    conversionBridgeHash,
    sdkExampleHash,
  ] = await Promise.all([
    fileHash(designMdPath),
    fileHash(path.join(PROMPTS_DIR, 'system-codegen-visual.md')),
    // Sitecoreize system prompt (v3 compact) + FieldCatalog (project contract).
    // Bridge is hashed for other pipelines; sitecoreize no longer appends it.
    fileHash(path.join(PROMPTS_DIR, 'system-codegen-sitecoreize.md')),
    fileHash(path.join(PROMPTS_DIR, 'content-sdk-conversion-bridge.md')),
    fileHash(
      path.join(PROMPTS_DIR, 'references', 'FieldCatalog.reference.tsx'),
    ),
  ]);
  const folder = sectionFolder || info?.folderName || '';
  const htmlHash =
    pageDir && folder
      ? await preferredSectionHtmlHash(pageDir, folder, info)
      : sha256Hex('');
  const prefixHash = sha256Hex(sharedDesignPrefix || '');
  loadLocalEnvFiles({ root: bqRoot });
  const conversionModel = (
    process.env.AZURE_OPENAI_SCREENSHOT_CONVERSION_MODEL ||
    process.env.AZURE_OPENAI_DEFAULT_MODEL ||
    ''
  ).trim();
  const payload = [
    `pipeline:${CONVERSION_PIPELINE_VERSION}`,
    `contentHash:${info?.contentHash || ''}`,
    `info:${JSON.stringify(stableSectionInfoForHash(info))}`,
    `designMd:${designHash}`,
    `sharedPrefix:${prefixHash}`,
    `sectionHtml:${htmlHash}`,
    `prompt-visual:${visualPromptHash}`,
    `prompt-sitecoreize:${sitecoreizePromptHash}`,
    `prompt-conversion-bridge:${conversionBridgeHash}`,
    `prompt-sdk-example:${sdkExampleHash}`,
    `collection:${collectionSystem || ''}`,
    `model:${conversionModel}`,
  ].join('\n');
  return sha256Hex(payload);
}

/**
 * @param {object|null|undefined} prior
 */
export async function conversionOutputsExist(prior) {
  const components = prior?.components;
  if (!Array.isArray(components) || components.length === 0) return false;
  for (const c of components) {
    const sources = c?.sources || {};
    for (const key of ['tsx', 'definition', 'captureMeta']) {
      const rel = sources[key];
      if (!rel || typeof rel !== 'string') return false;
      const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
      try {
        await access(abs);
      } catch {
        return false;
      }
    }
    if (sources.clientTsx) {
      const rel = sources.clientTsx;
      const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
      try {
        await access(abs);
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * @param {{
 *   force?: boolean,
 *   prior: object|null,
 *   conversionSourceHash: string,
 *   contentHash?: string,
 *   sharedSkip?: { skip: boolean, reason: string|null, reuse?: object }|null,
 * }} opts
 * @returns {Promise<{ skip: boolean, reason: string|null, legacyContentHashMatch?: boolean, sharedReuse?: object }>}
 */
export async function canSkipSectionConversion(opts) {
  const { force, prior, conversionSourceHash, contentHash, sharedSkip } = opts;

  // Cross-page shared registry reuse (including --force after first build this run).
  // Under force, canSkipViaSharedSection only returns reuse for sharedBuiltThisRun,
  // not package-exists — so this does not defeat change-detection bypass.
  if (sharedSkip?.skip && sharedSkip.reuse) {
    return {
      skip: true,
      reason: sharedSkip.reason,
      sharedReuse: sharedSkip.reuse,
    };
  }

  // --force: ignore conversionSourceHash / contentHash (screenshots/html unchanged).
  if (force) {
    return { skip: false, reason: 'force' };
  }

  if (!prior || typeof prior !== 'object') {
    return { skip: false, reason: 'no prior conversion' };
  }
  if (!(await conversionOutputsExist(prior))) {
    return { skip: false, reason: 'missing component outputs' };
  }

  if (
    prior.conversionSourceHash &&
    prior.conversionSourceHash === conversionSourceHash
  ) {
    return { skip: true, reason: 'conversionSourceHash match' };
  }

  // One-time fallback for older logs that only stored contentHash.
  if (
    !prior.conversionSourceHash &&
    contentHash &&
    prior.contentHash &&
    prior.contentHash === contentHash
  ) {
    return {
      skip: true,
      reason: 'contentHash match (legacy)',
      legacyContentHashMatch: true,
    };
  }

  return { skip: false, reason: 'hash mismatch' };
}
