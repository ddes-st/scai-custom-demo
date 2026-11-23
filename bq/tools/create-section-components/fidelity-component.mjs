/**
 * Run source/visual fidelity for one existing component package (no YAML / pull / push).
 */
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { hostSlugFromUrl } from '../capture/lib/url-utils.mjs';
import { loadPreferredSectionHtml } from './ai-codegen.mjs';
import { createAiLedger } from './ai-ledger.mjs';
import { clearComponentShotFolders } from './clear-component-shot-folders.mjs';
import { applyFidelityCliFlags } from './fidelity-enable.mjs';
import {
  hostToHostSlugFolder,
  normalizeCaptureMetaChild,
  toKebabCase,
  toPascalCase,
} from './naming.mjs';
import { runPostWriteFidelity } from './post-write-fidelity.mjs';
import { resolveCapturePageDir } from './resolve-capture.mjs';
import { componentDir, readCaptureMeta } from './write-component.mjs';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} definitionTs
 * @returns {{ collectionSystem: string, siteSystem: string }}
 */
function parseSystemsFromDefinition(definitionTs) {
  const text = String(definitionTs || '');
  const coll = text.match(/collectionSystem:\s*["']([^"']+)["']/);
  const site = text.match(/siteSystem:\s*["']([^"']+)["']/);
  return {
    collectionSystem: coll?.[1] || 'sitecore',
    siteSystem: site?.[1] || 'sitecore-com',
  };
}

/**
 * Find host folder under src/components that contains ComponentName.
 * @param {string} componentName
 * @param {string|null} preferredHost
 */
async function resolveHostSlug(componentName, preferredHost) {
  if (preferredHost) {
    const slug = hostToHostSlugFolder(preferredHost);
    const dir = componentDir(slug, componentName);
    if (await exists(dir)) return slug;
    throw new Error(`Component not found: bq/src/components/${slug}/${componentName}`);
  }
  const roots = path.join(bqRoot, 'src', 'components');
  const entries = await readdir(roots, { withFileTypes: true });
  /** @type {string[]} */
  const hits = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'sites' || e.name === 'collections' || e.name === 'data' || e.name === 'ui') {
      continue;
    }
    const dir = path.join(roots, e.name, componentName);
    if (await exists(dir)) hits.push(e.name);
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    throw new Error(
      `Component ${componentName} found under multiple hosts: ${hits.join(', ')}. Pass --host or --url.`,
    );
  }
  throw new Error(`Component not found under bq/src/components/*/${componentName}`);
}

/**
 * @param {string} hostSlug
 * @param {string} componentName
 */
async function resolvePackagePaths(hostSlug, componentName) {
  const dir = componentDir(hostSlug, componentName);
  const kebab = toKebabCase(componentName);
  const tsxPath = path.join(dir, `${kebab}.tsx`);
  const clientTsxPath = path.join(dir, `${kebab}.client.tsx`);
  const definitionPath = path.join(dir, `${kebab}.definition.ts`);
  if (!(await exists(tsxPath))) {
    throw new Error(`Missing TSX: ${tsxPath}`);
  }
  if (!(await exists(definitionPath))) {
    throw new Error(`Missing definition: ${definitionPath}`);
  }
  return {
    dir,
    kebab,
    tsxPath,
    clientTsxPath: (await exists(clientTsxPath)) ? clientTsxPath : null,
    definitionPath,
  };
}

/**
 * @param {string|null|undefined} sectionDir
 * @returns {string|null}
 */
function sectionFolderFromMeta(sectionDir) {
  const raw = String(sectionDir || '').replace(/\\/g, '/').trim();
  if (!raw) return null;
  const m = raw.match(/(section-\d+)/i);
  if (m) return m[1];
  const base = path.basename(raw);
  return /^section-\d+/i.test(base) ? base : null;
}

/**
 * @param {object} args
 */
export async function runFidelityComponent(args) {
  const componentName = toPascalCase(String(args.component || '').trim());
  if (!componentName) {
    throw new Error('--component <PascalName> is required');
  }

  const fidelityState = applyFidelityCliFlags(args);
  if (!fidelityState.sourceEnabled && !fidelityState.visualEnabled) {
    throw new Error(
      'No fidelity mode enabled. Pass --visual-fidelity[=N] and/or --source-fidelity[=N], or set BQ_VISUAL_FIDELITY / BQ_SOURCE_FIDELITY (and MAX_ITERS > 0).',
    );
  }

  let hostSlug = args.host ? hostToHostSlugFolder(String(args.host).trim()) : null;
  let meta = hostSlug ? await readCaptureMeta(hostSlug, componentName) : null;

  if (!hostSlug) {
    if (args.url) {
      const fromUrl = hostSlugFromUrl(args.url);
      hostSlug = await resolveHostSlug(componentName, fromUrl);
    } else {
      hostSlug = await resolveHostSlug(componentName, null);
    }
    meta = await readCaptureMeta(hostSlug, componentName);
  }

  const paths = await resolvePackagePaths(hostSlug, componentName);
  meta = meta || (await readCaptureMeta(hostSlug, componentName)) || {};

  const url = String(args.url || meta.url || '').trim();
  if (!url) {
    throw new Error(
      `No capture URL. Pass --url or ensure ${paths.kebab}.capture-meta.json has a url field.`,
    );
  }

  const capture = await resolveCapturePageDir(url);
  const sectionFolder = sectionFolderFromMeta(meta.sectionDir);
  if (!sectionFolder) {
    throw new Error(
      `Cannot resolve section folder from capture-meta sectionDir="${meta.sectionDir || ''}". Re-run create for this component or pass a package with sectionDir like sections/section-08.`,
    );
  }

  const sectionAbs = path.join(capture.pageDir, 'sections', sectionFolder);
  const infoPath = path.join(sectionAbs, 'section-information.json');
  if (!(await exists(infoPath))) {
    throw new Error(`Missing section-information.json: ${infoPath}`);
  }
  const info = JSON.parse(await readFile(infoPath, 'utf8'));
  info.sectionHtml = info.sectionHtml || `sections/${sectionFolder}/section.html`;

  const preferredHtml = await loadPreferredSectionHtml(capture.pageDir, sectionFolder, info);
  const sectionHtml = preferredHtml.html || '';

  let designMd = '';
  try {
    designMd = await readFile(path.join(capture.pageDir, 'ai-derived-design.md'), 'utf8');
  } catch {
    /* optional */
  }

  const definitionTs = await readFile(paths.definitionPath, 'utf8');
  const systems = parseSystemsFromDefinition(definitionTs);
  const definitionKey = String(meta.definitionKey || toKebabCase(componentName));
  const role = meta.role === 'child' ? 'child' : 'section';
  const placeholderKey = meta.placeholderKey || null;

  /** @type {string[]} */
  const childComponentNames = (Array.isArray(meta.children) ? meta.children : [])
    .map((entry) => normalizeCaptureMetaChild(entry)?.componentName)
    .filter((n) => n && toPascalCase(n) !== componentName);

  const plan = {
    mode: meta.mode || (childComponentNames.length ? 'composite' : 'single'),
    role,
    reason: 'fidelity:component',
    section: {
      componentName,
      placeholderKey,
    },
    children: childComponentNames.map((name) => ({ componentName: name })),
  };

  const ledger = createAiLedger();

  console.log(`Component: ${componentName}`);
  console.log(`Host:      ${hostSlug}`);
  console.log(`Capture:   ${capture.pageDir}`);
  console.log(`Section:   ${sectionFolder}`);
  console.log(`TSX:       ${path.relative(bqRoot, paths.tsxPath)}`);
  if (childComponentNames.length) {
    console.log(`Children:  ${childComponentNames.join(', ')}`);
  }

  if (!args.dryRun) {
    await clearComponentShotFolders({
      pageDir: capture.pageDir,
      sectionFolder,
      componentNames: [componentName, ...childComponentNames],
    });
  }

  const result = await runPostWriteFidelity({
    pageDir: capture.pageDir,
    sectionFolder,
    info,
    sectionHtml,
    hostSlug,
    componentName,
    definitionKey,
    tsxPath: paths.tsxPath,
    clientTsxPath: paths.clientTsxPath,
    definitionPath: paths.definitionPath,
    childComponentNames,
    placeholderKey,
    plan,
    role,
    parent: null,
    collectionSystem: systems.collectionSystem,
    siteSystem: systems.siteSystem,
    designMd,
    sharedDesignPrefix: '',
    ledger,
    dryRun: Boolean(args.dryRun),
    sourceMinScore: args.sourceFidelityMinScore ?? null,
    visualMinScore: args.visualFidelityMinScore ?? null,
    kebab: paths.kebab,
    captureMeta: {
      ...meta,
      url,
      sectionDir: meta.sectionDir || `sections/${sectionFolder}`,
      role,
      mode: plan.mode,
      placeholderKey,
      children: childComponentNames,
      definitionKey,
    },
    finalizeDefinition: async (generated) => generated.definitionTs,
  });

  ledger.printFidelityTotals({
    section: sectionFolder,
    componentName,
    scoreHistory: result.scoreHistory,
    minScore: result.minScore,
  });

  console.log(
    `Done: score=${result.percent ?? result.score ?? 'n/a'} pass=${result.pass ?? false} applied=${result.applied ?? false} iterations=${result.iterations ?? 0}`,
  );
  if (result.notes) console.log(`Notes: ${result.notes}`);
  return result;
}
