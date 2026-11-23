/**
 * Ensure collection + site *.definition.ts exist for the capture host.
 *
 * Naming is URL-derived:
 * - Collection: brand estate (`axa` / "AXA Web Estate")
 * - Site: brand + market TLD (`axa-be` / "AXA Belgium")
 *
 * Descriptions use deterministic templates from the hostname.
 * Azure is only a fallback when brand parse is too weak to template.
 * Existing `descriptionSource: "manual"` is never overwritten.
 */
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import {
  collectionDefinitionPath,
  hostComponentsDir,
  legacyCollectionDefinitionPath,
  legacySiteDefinitionPath,
  siteDefinitionPath,
} from './definition-paths.mjs';
import {
  deriveCollectionDescription,
  deriveCollectionDisplayName,
  deriveSiteDescription,
  deriveSiteDisplayName,
  hostToHostSlugFolder,
  hostToSystemName,
  parseHostnameBrandMarket,
  sanitizeSingleLineText,
} from './naming.mjs';
import {
  buildCollectionWebsitesContext,
  generateCollectionDescription,
  generateCollectionDisplayName,
  generateSiteDescription,
  shouldGenerateCollectionDisplayName,
  shouldGenerateDescription,
  shouldGenerateSiteDisplayName,
} from './collection-description.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function escapeTsString(value) {
  return sanitizeSingleLineText(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function collectionDefinitionBody({
  url,
  collectionKey,
  display,
  collectionSystem,
  description,
  descriptionSource,
  previousSystemName,
}) {
  const previousLine = previousSystemName
    ? `\n  previousSystemName: "${escapeTsString(previousSystemName)}",`
    : '';
  const safeDisplay = sanitizeSingleLineText(display);
  const safeDescription = sanitizeSingleLineText(description);
  return `import type { CollectionDefinition } from "../../../tools/definitions/types";

/** Auto-created by create:sectioncomponents for ${url} */
export const ${camel(collectionKey)} = {
  kind: "collection",
  definitionKey: "${collectionKey}",
  name: "${escapeTsString(safeDisplay)}",
  systemName: "${collectionSystem}",${previousLine}
  description: "${escapeTsString(safeDescription)}",
  descriptionSource: "${descriptionSource}",
} satisfies CollectionDefinition;
`;
}

/** Sitecore site languages: always include `en`, then extras (deduped). */
function normalizeSiteApiLanguages(languages = []) {
  const seen = new Set();
  const out = [];
  const add = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return;
    const lower = t.toLowerCase();
    const value = lower === 'en' || lower.startsWith('en-') ? 'en' : t;
    if (seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    out.push(value);
  };
  add('en');
  for (const l of Array.isArray(languages) ? languages : []) add(l);
  return out;
}

function siteDefinitionBody({
  url,
  siteKey,
  display,
  siteSystem,
  collectionSystem,
  description,
  descriptionSource,
  previousSystemName,
  languages = [],
  thumbnail,
}) {
  const previousLine = previousSystemName
    ? `\n  previousSystemName: "${escapeTsString(previousSystemName)}",`
    : '';
  // Sites API requires default language (`en`) to be listed in `languages`.
  const langs = normalizeSiteApiLanguages(languages);
  const apiBlock = `\n  api: {\n    languages: ${JSON.stringify(langs)},\n  },`;
  const thumb =
    thumbnail &&
    (thumbnail.path || thumbnail.url || thumbnail.base64)
      ? thumbnail
      : { path: 'screenshots/desktop-clean.png' };
  const thumbnailLine = `\n  thumbnail: ${JSON.stringify(thumb)},`;
  const safeDisplay = sanitizeSingleLineText(display);
  const safeDescription = sanitizeSingleLineText(description);
  return `import type { SiteDefinition } from "../../../tools/definitions/types";

/** Auto-created by create:sectioncomponents for ${url} */
export const ${camel(siteKey)} = {
  kind: "site",
  definitionKey: "${siteKey}",
  name: "${escapeTsString(safeDisplay)}",
  systemName: "${siteSystem}",${previousLine}
  description: "${escapeTsString(safeDescription)}",
  descriptionSource: "${descriptionSource}",
  collectionSystem: "${collectionSystem}",${apiBlock}${thumbnailLine}
} satisfies SiteDefinition;
`;
}

function readDescriptionFromDefinitionTs(text) {
  const descMatch = text.match(/description:\s*"((?:\\.|[^"\\])*)"/);
  return descMatch ? descMatch[1].replace(/\\"/g, '"') : '';
}

function readNameFromDefinitionTs(text) {
  const m = text.match(/^\s*name:\s*"((?:\\.|[^"\\])*)"/m);
  return m ? m[1].replace(/\\"/g, '"') : '';
}

function readSystemNameFromDefinitionTs(text) {
  const m = text.match(/^\s*systemName:\s*"((?:\\.|[^"\\])*)"/m);
  return m ? m[1].replace(/\\"/g, '"').trim().toLowerCase() : '';
}

/** Best-effort read of `thumbnail: { … }` from a site definition .ts body. */
function readThumbnailFromDefinitionTs(text) {
  const m = String(text || '').match(/thumbnail:\s*(\{[\s\S]*?\})/);
  if (!m?.[1]) return undefined;
  try {
    // Definition uses JSON-compatible object literals.
    return JSON.parse(m[1].replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":'));
  } catch {
    return undefined;
  }
}

function readDescriptionSourceFromDefinitionTs(text) {
  const m = text.match(/descriptionSource:\s*"((?:\\.|[^"\\])*)"/);
  return m ? m[1].replace(/\\"/g, '"').trim().toLowerCase() : '';
}

/**
 * @param {{
 *   url: string,
 *   hostSlug: string,
 *   collectionSystem?: string,
 *   siteSystem?: string,
 *   dryRun?: boolean,
 *   designMd?: string,
 *   siteScope?: string,
 *   ledger?: { record: (entry: object) => unknown },
 *   languages?: string[],
 * }} opts
 */
export async function ensureCollectionAndSite({
  url,
  hostSlug,
  collectionSystem: collectionOverride,
  siteSystem: siteOverride,
  dryRun = false,
  designMd = '',
  siteScope = '',
  ledger,
  languages = [],
}) {
  let hostname = hostSlug;
  try {
    hostname = new URL(url).hostname;
  } catch {
    /* keep slug */
  }

  const brandMarket = parseHostnameBrandMarket(url || hostname);
  const hostSystem = hostToSystemName(hostname);
  const hostFolder = hostToHostSlugFolder(hostSlug || hostname);
  const hostDir = hostComponentsDir(hostFolder);

  const created = [];
  const derivedCollectionName = deriveCollectionDisplayName(brandMarket);
  const derivedCollectionDesc = deriveCollectionDescription(brandMarket);
  const derivedSiteName = deriveSiteDisplayName(brandMarket);
  const derivedSiteDesc = deriveSiteDescription(brandMarket);

  const websites = buildCollectionWebsitesContext({
    url,
    hostname,
    designMd,
  });

  async function resolveCollectionDisplayName() {
    if (brandMarket.brandSystem && brandMarket.brandSystem !== 'site') {
      console.log(`  URL collection display name: ${derivedCollectionName}`);
      return sanitizeSingleLineText(derivedCollectionName);
    }
    const ai = await generateCollectionDisplayName({
      hostname,
      websites,
      ledger,
    });
    if (ai.displayName) {
      console.log(`  AI collection display name (${ai.source}): ${ai.displayName}`);
      return sanitizeSingleLineText(ai.displayName);
    }
    console.warn(
      `  ⚠ collection display name fallback: ${derivedCollectionName}`,
    );
    return sanitizeSingleLineText(derivedCollectionName);
  }

  async function resolveCollectionDescription(collectionName) {
    if (brandMarket.brandSystem && brandMarket.brandSystem !== 'site') {
      console.log(
        `  URL collection description: ${derivedCollectionDesc.slice(0, 120)}…`,
      );
      return {
        description: sanitizeSingleLineText(derivedCollectionDesc),
        descriptionSource: 'ai',
      };
    }
    const ai = await generateCollectionDescription({
      collectionName: collectionName || derivedCollectionName,
      websites,
      ledger,
    });
    if (ai.description) {
      console.log(`  AI collection description (${ai.source}): ${ai.description.slice(0, 120)}…`);
      return {
        description: sanitizeSingleLineText(ai.description),
        descriptionSource: 'ai',
      };
    }
    return {
      description: sanitizeSingleLineText(derivedCollectionDesc),
      descriptionSource: 'capture',
    };
  }

  async function resolveSiteDisplayName() {
    if (brandMarket.brandSystem && brandMarket.brandSystem !== 'site') {
      console.log(`  URL site display name: ${derivedSiteName}`);
      return sanitizeSingleLineText(derivedSiteName);
    }
    return sanitizeSingleLineText(derivedSiteName);
  }

  async function resolveSiteDescription(siteName) {
    if (brandMarket.brandSystem && brandMarket.brandSystem !== 'site') {
      console.log(`  URL site description: ${derivedSiteDesc.slice(0, 120)}…`);
      return {
        description: sanitizeSingleLineText(derivedSiteDesc),
        descriptionSource: 'ai',
      };
    }
    const ai = await generateSiteDescription({
      siteName: siteName || derivedSiteName,
      siteScope,
      websites,
      ledger,
    });
    if (ai.description) {
      console.log(`  AI site description (${ai.source}): ${ai.description.slice(0, 120)}…`);
      return {
        description: sanitizeSingleLineText(ai.description),
        descriptionSource: 'ai',
      };
    }
    return {
      description: sanitizeSingleLineText(derivedSiteDesc),
      descriptionSource: 'capture',
    };
  }

  // --- Collection systemName from brand (not display name, not host squeeze) ---
  const desiredCollectionSystem =
    (collectionOverride && String(collectionOverride).trim().toLowerCase()) ||
    brandMarket.collectionSystemName;

  // Legacy candidates: hostSystem-named file under host folder, or anything under collections/
  const hostSystemCollectionFile = collectionDefinitionPath(
    hostFolder,
    hostSystem,
  );
  const bucketCollectionFile = legacyCollectionDefinitionPath(
    desiredCollectionSystem,
  );
  const bucketHostSystemCollectionFile =
    legacyCollectionDefinitionPath(hostSystem);

  let collectionSystem = desiredCollectionSystem;
  let collectionKey = `${collectionSystem}-collection`;
  let collectionFile = collectionDefinitionPath(hostFolder, collectionSystem);
  let collectionPreviousSystemName;
  let display = derivedCollectionName;
  let description = derivedCollectionDesc;
  let descriptionSource = 'ai';

  const legacyCollectionCandidates = [
    hostSystemCollectionFile,
    bucketCollectionFile,
    bucketHostSystemCollectionFile,
  ].filter(
    (p, i, arr) =>
      path.resolve(p) !== path.resolve(collectionFile) &&
      arr.findIndex((q) => path.resolve(q) === path.resolve(p)) === i,
  );

  let legacyCollectionFile = null;
  for (const candidate of legacyCollectionCandidates) {
    if (await exists(candidate)) {
      legacyCollectionFile = candidate;
      break;
    }
  }
  const legacyCollectionExists = Boolean(legacyCollectionFile);
  const targetCollectionExists = await exists(collectionFile);

  if (targetCollectionExists || legacyCollectionExists) {
    const existingPath = targetCollectionExists
      ? collectionFile
      : legacyCollectionFile;
    const existing = await readFile(existingPath, 'utf8');
    const currentName = readNameFromDefinitionTs(existing);
    const currentSystem =
      readSystemNameFromDefinitionTs(existing) || hostSystem;
    const currentSource = readDescriptionSourceFromDefinitionTs(existing);
    const currentDesc = readDescriptionFromDefinitionTs(existing);

    display = sanitizeSingleLineText(currentName || derivedCollectionName);
    description = sanitizeSingleLineText(
      currentDesc || derivedCollectionDesc,
    );
    descriptionSource = currentSource || 'capture';

    if (
      shouldGenerateCollectionDisplayName({
        name: currentName,
        hostnameOrUrl: url,
        descriptionSource: currentSource,
      })
    ) {
      display = await resolveCollectionDisplayName();
    }

    if (
      shouldGenerateDescription({
        kind: 'collection',
        description: currentDesc,
        descriptionSource: currentSource,
        hostname,
        hostnameOrUrl: url,
      })
    ) {
      const resolved = await resolveCollectionDescription(display);
      description = resolved.description;
      descriptionSource = resolved.descriptionSource;
    } else if (!currentSource && currentDesc) {
      descriptionSource = 'ai';
    }

    if (!collectionOverride && currentSystem !== desiredCollectionSystem) {
      collectionPreviousSystemName = currentSystem;
      collectionSystem = desiredCollectionSystem;
      console.log(
        `  · collection systemName ${currentSystem} → ${desiredCollectionSystem} (URL brand)`,
      );
    } else if (collectionOverride) {
      collectionSystem = desiredCollectionSystem;
    } else {
      collectionSystem = desiredCollectionSystem;
    }

    collectionKey = `${collectionSystem}-collection`;
    collectionFile = collectionDefinitionPath(hostFolder, collectionSystem);
  } else {
    display = await resolveCollectionDisplayName();
    collectionSystem = desiredCollectionSystem;
    collectionKey = `${collectionSystem}-collection`;
    collectionFile = collectionDefinitionPath(hostFolder, collectionSystem);
    const resolved = await resolveCollectionDescription(display);
    description = resolved.description;
    descriptionSource = resolved.descriptionSource;
  }

  // --- Site systemName from brand-tld (not collection systemName) ---
  const desiredSiteSystem =
    (siteOverride && String(siteOverride).trim().toLowerCase()) ||
    brandMarket.siteSystemName;

  let siteSystem = desiredSiteSystem;
  let siteKey = `${siteSystem}-site`;
  let siteFile = siteDefinitionPath(hostFolder, siteSystem);
  const hostSystemSiteFile = siteDefinitionPath(hostFolder, hostSystem);
  const bucketSiteFile = legacySiteDefinitionPath(desiredSiteSystem);
  const bucketHostSystemSiteFile = legacySiteDefinitionPath(hostSystem);
  const legacySiteCandidates = [
    hostSystemSiteFile,
    bucketSiteFile,
    bucketHostSystemSiteFile,
  ].filter(
    (p, i, arr) =>
      path.resolve(p) !== path.resolve(siteFile) &&
      arr.findIndex((q) => path.resolve(q) === path.resolve(p)) === i,
  );
  let legacySiteFile = null;
  for (const candidate of legacySiteCandidates) {
    if (await exists(candidate)) {
      legacySiteFile = candidate;
      break;
    }
  }

  async function unlinkLegacyCollectionFiles() {
    for (const candidate of legacyCollectionCandidates) {
      if (
        path.resolve(candidate) === path.resolve(collectionFile) ||
        !(await exists(candidate))
      ) {
        continue;
      }
      await unlink(candidate).catch(() => {});
      console.log(
        `  - removed legacy collection definition: ${path.relative(bqRoot, candidate)}`,
      );
    }
  }

  // Write / update collection definition
  const collectionExistsAtTarget = await exists(collectionFile);
  const legacyExists = legacyCollectionExists;

  if (!collectionExistsAtTarget) {
    const body = collectionDefinitionBody({
      url,
      collectionKey,
      display,
      collectionSystem,
      description: description || derivedCollectionDesc,
      descriptionSource: descriptionSource || 'ai',
      previousSystemName: collectionPreviousSystemName,
    });
    if (!dryRun) {
      await mkdir(hostDir, { recursive: true });
      await writeFile(collectionFile, body, 'utf8');
      if (legacyExists) await unlinkLegacyCollectionFiles();
    }
    created.push(collectionFile);
    console.log(`  + collection definition: ${path.relative(bqRoot, collectionFile)}`);
  } else {
    const existing = await readFile(collectionFile, 'utf8');
    const currentName = readNameFromDefinitionTs(existing);
    const currentSystem = readSystemNameFromDefinitionTs(existing);
    const currentDesc = readDescriptionFromDefinitionTs(existing);
    const currentSource = readDescriptionSourceFromDefinitionTs(existing);

    const nameChanged = display !== currentName;
    const systemChanged = collectionSystem !== currentSystem;
    const descChanged =
      description !== currentDesc ||
      (descriptionSource || '') !== (currentSource || '');
    const needsPrevious = Boolean(collectionPreviousSystemName);

    if (nameChanged || systemChanged || descChanged || needsPrevious || legacyExists) {
      const body = collectionDefinitionBody({
        url,
        collectionKey,
        display,
        collectionSystem,
        description: description || currentDesc || derivedCollectionDesc,
        descriptionSource: descriptionSource || currentSource || 'ai',
        previousSystemName:
          collectionPreviousSystemName ||
          (systemChanged && currentSystem !== collectionSystem
            ? currentSystem
            : undefined),
      });
      if (!dryRun) {
        await writeFile(collectionFile, body, 'utf8');
        if (legacyExists) await unlinkLegacyCollectionFiles();
      }
      created.push(collectionFile);
      console.log(
        `  ~ collection definition updated: ${path.relative(bqRoot, collectionFile)}`,
      );
    } else {
      console.log(`  · collection exists: ${path.relative(bqRoot, collectionFile)}`);
    }
  }

  // --- Site ---
  let sitePreviousSystemName;
  let siteDisplay = derivedSiteName;
  let siteDesc = derivedSiteDesc;
  let siteDescSource = 'ai';

  const siteLegacyExists = Boolean(legacySiteFile);

  async function unlinkLegacySiteFiles(extraPaths = []) {
    const toRemove = [...legacySiteCandidates, ...extraPaths];
    const seen = new Set();
    for (const candidate of toRemove) {
      const key = path.resolve(candidate);
      if (seen.has(key) || key === path.resolve(siteFile)) continue;
      seen.add(key);
      if (!(await exists(candidate))) continue;
      await unlink(candidate).catch(() => {});
      console.log(
        `  - removed legacy site definition: ${path.relative(bqRoot, candidate)}`,
      );
    }
  }

  if (siteLegacyExists) {
    const legacyText = await readFile(legacySiteFile, 'utf8');
    const legacySystem = readSystemNameFromDefinitionTs(legacyText) || hostSystem;
    if (legacySystem !== siteSystem) {
      sitePreviousSystemName = legacySystem;
    }
  }

  // Prefer reading existing site from host folder; else migrate from legacy path
  const siteReadPath = (await exists(siteFile))
    ? siteFile
    : siteLegacyExists
      ? legacySiteFile
      : null;

  if (siteReadPath) {
    const existing = await readFile(siteReadPath, 'utf8');
    const currentName = readNameFromDefinitionTs(existing);
    const currentDesc = readDescriptionFromDefinitionTs(existing);
    const currentSource = readDescriptionSourceFromDefinitionTs(existing);
    const currentSiteSystem = readSystemNameFromDefinitionTs(existing);

    siteDisplay = sanitizeSingleLineText(currentName || derivedSiteName);
    siteDesc = sanitizeSingleLineText(currentDesc || derivedSiteDesc);
    siteDescSource = currentSource || 'capture';

    if (
      shouldGenerateSiteDisplayName({
        name: currentName,
        hostnameOrUrl: url,
        descriptionSource: currentSource,
      })
    ) {
      siteDisplay = await resolveSiteDisplayName();
    }

    if (
      shouldGenerateDescription({
        kind: 'site',
        description: currentDesc,
        descriptionSource: currentSource,
        hostname,
        hostnameOrUrl: url,
      })
    ) {
      const resolved = await resolveSiteDescription(siteDisplay);
      siteDesc = resolved.description;
      siteDescSource = resolved.descriptionSource;
    } else if (!currentSource && currentDesc) {
      siteDescSource = 'ai';
    }

    if (!siteOverride && currentSiteSystem && currentSiteSystem !== desiredSiteSystem) {
      sitePreviousSystemName = sitePreviousSystemName || currentSiteSystem;
      siteSystem = desiredSiteSystem;
      siteKey = `${siteSystem}-site`;
      siteFile = siteDefinitionPath(hostFolder, siteSystem);
      console.log(
        `  · site systemName ${currentSiteSystem} → ${desiredSiteSystem} (URL brand-tld)`,
      );
    }

    const collectionRefChanged = !existing.includes(
      `collectionSystem: "${collectionSystem}"`,
    );
    const nameChanged = siteDisplay !== currentName;
    const descChanged =
      siteDesc !== currentDesc ||
      (siteDescSource || '') !== (currentSource || '');
    const systemChanged = currentSiteSystem && currentSiteSystem !== siteSystem;
    const targetMoved =
      path.resolve(siteReadPath) !== path.resolve(siteFile);
    const desiredLangs = normalizeSiteApiLanguages(languages);
    const existingLangMatch = existing.match(
      /api:\s*\{[\s\S]*?languages:\s*(\[[^\]]*\])/,
    );
    let existingLangs = [];
    if (existingLangMatch?.[1]) {
      try {
        existingLangs = JSON.parse(existingLangMatch[1]);
      } catch {
        existingLangs = [];
      }
    }
    const languagesChanged =
      JSON.stringify([...desiredLangs].sort()) !==
      JSON.stringify(
        [...normalizeSiteApiLanguages(existingLangs || [])].sort(),
      );
    const existingThumbnail = readThumbnailFromDefinitionTs(existing);
    const thumbnailMissing = !existingThumbnail;

    if (
      nameChanged ||
      descChanged ||
      collectionRefChanged ||
      systemChanged ||
      sitePreviousSystemName ||
      targetMoved ||
      siteLegacyExists ||
      languagesChanged ||
      thumbnailMissing
    ) {
      const body = siteDefinitionBody({
        url,
        siteKey,
        display: siteDisplay,
        siteSystem,
        collectionSystem,
        description: siteDesc || derivedSiteDesc,
        descriptionSource: siteDescSource || 'ai',
        previousSystemName:
          sitePreviousSystemName ||
          (systemChanged ? currentSiteSystem : undefined),
        languages: desiredLangs,
        thumbnail: existingThumbnail,
      });
      if (!dryRun) {
        await mkdir(hostDir, { recursive: true });
        await writeFile(siteFile, body, 'utf8');
        const extras = [];
        if (currentSiteSystem && currentSiteSystem !== siteSystem) {
          extras.push(siteDefinitionPath(hostFolder, currentSiteSystem));
          extras.push(legacySiteDefinitionPath(currentSiteSystem));
        }
        await unlinkLegacySiteFiles(extras);
      }
      created.push(siteFile);
      console.log(`  ~ site definition updated: ${path.relative(bqRoot, siteFile)}`);
    } else {
      console.log(`  · site exists: ${path.relative(bqRoot, siteFile)}`);
    }
  } else {
    if (
      shouldGenerateSiteDisplayName({
        name: siteDisplay,
        hostnameOrUrl: url,
        descriptionSource: siteDescSource,
      })
    ) {
      siteDisplay = await resolveSiteDisplayName();
    }

    if (
      shouldGenerateDescription({
        kind: 'site',
        description: siteDesc,
        descriptionSource: siteDescSource,
        hostname,
        hostnameOrUrl: url,
      })
    ) {
      const resolved = await resolveSiteDescription(siteDisplay);
      siteDesc = resolved.description;
      siteDescSource = resolved.descriptionSource;
    } else {
      const resolved = await resolveSiteDescription(siteDisplay);
      siteDesc = resolved.description;
      siteDescSource = resolved.descriptionSource;
    }

    const body = siteDefinitionBody({
      url,
      siteKey,
      display: siteDisplay,
      siteSystem,
      collectionSystem,
      description: siteDesc || derivedSiteDesc,
      descriptionSource: siteDescSource || 'ai',
      previousSystemName: sitePreviousSystemName,
      languages: normalizeSiteApiLanguages(languages),
    });
    if (!dryRun) {
      await mkdir(hostDir, { recursive: true });
      await writeFile(siteFile, body, 'utf8');
      await unlinkLegacySiteFiles();
    }
    created.push(siteFile);
    console.log(`  + site definition: ${path.relative(bqRoot, siteFile)}`);
  }

  return {
    collectionSystem,
    siteSystem,
    collectionKey,
    siteKey,
    collectionFile,
    siteFile,
    created,
  };
}

function camel(kebab) {
  return String(kebab)
    .split(/-+/)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('')
    .replace(/[^a-zA-Z0-9_$]/g, '');
}
