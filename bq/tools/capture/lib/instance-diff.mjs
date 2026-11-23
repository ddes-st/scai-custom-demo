/**
 * Compare content across registry instance refs (page section paths).
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { extensionScore, structureFromHtml } from './structure-fingerprint.mjs';
import { readOriginalSectionHtml } from './section-html-files.mjs';
import { resolveRegistryInstanceDir } from './section-registry-paths.mjs';

function contentHash(html) {
  const normalized = String(html || '')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 16);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(String(await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    return null;
  }
}

/**
 * Load instance refs from instances.json or legacy instances/ dirs.
 * Supports combined shape `{ identical, differences, instances }` and legacy
 * separate `instance-diff.json`.
 * @param {string} domainSectionDir
 * @param {string} [projectRoot]
 */
async function loadInstanceRefs(domainSectionDir, projectRoot) {
  void projectRoot;
  const jsonPath = path.join(domainSectionDir, 'instances.json');
  const fromJson = await readJsonIfExists(jsonPath);
  if (fromJson) {
    const list = Array.isArray(fromJson.instances)
      ? fromJson.instances
      : Array.isArray(fromJson)
        ? fromJson
        : [];
    if (list.length) return list;
  }

  // Legacy materialized instances/
  const instancesRoot = path.join(domainSectionDir, 'instances');
  /** @type {object[]} */
  const legacy = [];
  try {
    const entries = await readdir(instancesRoot, { withFileTypes: true });
    for (const e of entries.filter((d) => d.isDirectory())) {
      legacy.push({
        pageSlug: e.name,
        // Will resolve via absolute path fallback below
        _legacyDir: path.join(instancesRoot, e.name),
      });
    }
  } catch {
    /* none */
  }
  return legacy;
}

/**
 * @param {string} domainSectionDir — absolute …/section-registry/{folder}
 * @param {{ canonicalPageSlug?: string, projectRoot?: string, instances?: object[] }} [opts]
 */
export async function buildInstanceDiff(domainSectionDir, opts = {}) {
  const projectRoot =
    opts.projectRoot || path.dirname(path.dirname(domainSectionDir));
  const refs = opts.instances || (await loadInstanceRefs(domainSectionDir, projectRoot));
  /** @type {Array<object>} */
  const instances = [];

  for (const ref of refs) {
    let instDir = null;
    if (ref._legacyDir) {
      instDir = ref._legacyDir;
    } else {
      instDir = resolveRegistryInstanceDir(projectRoot, ref);
    }
    if (!instDir) continue;

    const original = await readOriginalSectionHtml(instDir);
    const html = original?.html || '';
    const struct = structureFromHtml(html);
    const info = await readJsonIfExists(path.join(instDir, 'section-information.json'));
    instances.push({
      pageSlug: ref.pageSlug,
      sectionFolder: ref.sectionFolder || ref.sourceFolder || null,
      sourcePath: ref.sourcePath || null,
      contentHash: contentHash(html),
      structureFingerprint: struct.structureFingerprint,
      extensionScore: extensionScore(html),
      htmlLength: html.length,
      tagCount: (html.match(/<[a-zA-Z]/g) || []).length,
      heading: info?.heading ?? null,
    });
  }

  instances.sort((a, b) => String(a.pageSlug).localeCompare(String(b.pageSlug)));

  const canonicalPageSlug =
    opts.canonicalPageSlug ||
    instances.slice().sort((a, b) => b.extensionScore - a.extensionScore)[0]?.pageSlug ||
    null;

  /** @type {Array<object>} */
  const differences = [];
  if (instances.length >= 2) {
    const hashes = new Set(instances.map((i) => i.contentHash));
    if (hashes.size > 1) {
      differences.push({
        kind: 'contentHash',
        pages: instances.map((i) => i.pageSlug),
        detail: 'original section HTML content differs across instances',
      });
    }
    const fps = new Set(instances.map((i) => i.structureFingerprint).filter(Boolean));
    if (fps.size > 1) {
      differences.push({
        kind: 'structureFingerprint',
        pages: instances.map((i) => i.pageSlug),
        detail: 'structure fingerprints differ (unexpected for same component)',
      });
    }
    const scores = instances.map((i) => i.extensionScore);
    if (new Set(scores).size > 1) {
      differences.push({
        kind: 'extensionScore',
        pages: instances.map((i) => i.pageSlug),
        detail: scores.join(' vs '),
      });
    }
    const headings = instances.map((i) => i.heading).filter((h) => h != null && String(h).trim());
    if (headings.length >= 2 && new Set(headings.map(String)).size > 1) {
      differences.push({
        kind: 'heading',
        pages: instances.filter((i) => i.heading).map((i) => i.pageSlug),
        detail: headings.join(' | '),
      });
    }
  }

  const identical =
    instances.length <= 1 || new Set(instances.map((i) => i.contentHash)).size === 1;

  return {
    identical,
    canonicalPageSlug,
    instanceCount: instances.length,
    instances,
    differences: identical
      ? differences.filter((d) => d.kind === 'structureFingerprint')
      : differences,
  };
}

/**
 * @param {string} domainSectionDir
 * @param {object} entry — manifest component entry
 * @param {{ projectRoot?: string }} [opts]
 */
export async function writeComponentMetadataFiles(domainSectionDir, entry, opts = {}) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(domainSectionDir, { recursive: true });

  const projectRoot =
    opts.projectRoot || path.dirname(path.dirname(domainSectionDir));
  const instanceList = entry.instances || [];
  const canonicalPageSlug =
    entry.canonicalPageSlug ||
    entry.canonicalRef?.pageSlug ||
    instanceList[0]?.pageSlug ||
    null;
  const canonicalRef =
    entry.canonicalRef ||
    (canonicalPageSlug
      ? instanceList.find((i) => i.pageSlug === canonicalPageSlug) || {
          pageSlug: canonicalPageSlug,
          sectionFolder: instanceList[0]?.sectionFolder || null,
          sourcePath: instanceList[0]?.sourcePath || null,
        }
      : null);

  const componentJson = {
    cmsName: entry.cmsName,
    folderName: entry.folderName,
    structureFingerprint: entry.structureFingerprint || null,
    contentHash: entry.contentHash || null,
    contentHashes: Array.isArray(entry.contentHashes)
      ? entry.contentHashes
      : entry.contentHash
        ? [entry.contentHash]
        : [],
    // Required for merge/skip gates across runs (must survive disk reload).
    enrichStructureFingerprint: entry.enrichStructureFingerprint || null,
    enrichStructurePayload: entry.enrichStructurePayload || null,
    layout: entry.layout || null,
    purpose: entry.purpose || null,
    canonicalPageSlug,
    canonicalRef,
    canonicalInstance: canonicalRef?.sourcePath || entry.canonicalInstance || null,
    instances: instanceList.map((i) => ({
      pageSlug: i.pageSlug,
      sectionFolder: i.sectionFolder || i.sourceFolder || null,
      sourcePath: i.sourcePath || null,
      contentHash: i.contentHash || null,
      sourceCmsName: i.sourceCmsName || null,
      extensionScore: i.extensionScore ?? null,
    })),
    alsoKnownAs: entry.alsoKnownAs || [],
    definitionKey: entry.definitionKey || null,
    componentName: entry.componentName || null,
    status: entry.status || null,
    contentFamilyId: entry.contentFamilyId || null,
    contentFamilyRole: entry.contentFamilyRole || null,
  };

  await writeFile(
    path.join(domainSectionDir, 'component.json'),
    `${JSON.stringify(componentJson, null, 2)}\n`,
    'utf8',
  );

  const diff = await buildInstanceDiff(domainSectionDir, {
    canonicalPageSlug,
    projectRoot,
    instances: instanceList,
  });

  // Single instances.json: refs + identical/differences (no separate instance-diff.json).
  const instancesPayload = {
    identical: diff.identical,
    canonicalPageSlug: diff.canonicalPageSlug || canonicalPageSlug,
    instanceCount: diff.instanceCount ?? instanceList.length,
    differences: Array.isArray(diff.differences) ? diff.differences : [],
    instances: instanceList.length ? instanceList : diff.instances || [],
  };
  await writeFile(
    path.join(domainSectionDir, 'instances.json'),
    `${JSON.stringify(instancesPayload, null, 2)}\n`,
    'utf8',
  );

  // Drop legacy sibling if present.
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(path.join(domainSectionDir, 'instance-diff.json'));
  } catch {
    /* none */
  }

  return { componentJson, diff, instancesPayload };
}
