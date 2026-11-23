#!/usr/bin/env node
/**
 * URL-based site merge: promote all page sections into {project}/section-registry/
 * (one component + instances.json refs) and synthesize ai-website-design.md.
 *
 *   npm run capture:merge-sections -- --url https://nl.renault.be/
 *   npm run capture:merge-sections -- --url https://nl.renault.be/ --ai
 *   npm run capture:merge-sections -- --url https://nl.renault.be/ --use-ai
 *   npm run capture:merge-sections -- https://nl.renault.be/ --force design
 */
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mergePageSectionsIntoDomain,
  loadGlobalManifest,
  saveGlobalManifest,
  writeSharedSectionBacklink,
} from './lib/merge-domain-sections.mjs';
import { writeSectionPlans } from './lib/section-plan.mjs';
import { buildSiteSummary } from './lib/build-site-summary.mjs';
import { defaultCapturesDir } from './paths.mjs';
import { hostSlugFromUrl, validateUrl } from './lib/url-utils.mjs';
import { loadLocalEnvFiles } from './lib/design-system/load-env.mjs';
import { consumeForceArg, forceHelpLine } from './lib/force-kinds.mjs';
import {
  AI_WEBSITE_DESIGN_MD,
  mergeAiWebsiteDesign,
} from './lib/design-system/ai/merge-ai-website-design.mjs';
import { buildAiDecideSections } from './lib/design-system/ai/aidecide-sections.mjs';
import {
  HOST_NON_PAGE_DIRS,
  SECTION_REGISTRY_AI_DIR,
  SECTION_REGISTRY_DIR,
  resolveSectionRegistryRoot,
  registryPath,
} from './lib/section-registry-paths.mjs';
import { applyBestNamesToManifest } from './lib/shared-section-naming.mjs';
import { applyContentFamilies } from './lib/content-families.mjs';

function printHelp() {
  console.log(`Usage:
  node merge-page-sections.mjs --url <https://…> [--ai] [--use-ai] [--force[=kinds]]
  node merge-page-sections.mjs <https://…> [--ai] [--use-ai] [--force[=kinds]]

Resolves project root .bq/captures/{hostSlug} (e.g. www-dom-security-com).
Merges every page folder's sections/ into {project}/${SECTION_REGISTRY_DIR}/ as a
layout component catalog: one folder per unique layout, instances.json refs to
page sections (no full copies); root holds component.json + instance-diff.json + section-plan.json.

Dedup: contentHash → structure fingerprint → skeleton / desc+HTML soft match
(cmsName assist only when structure agrees). Optional --ai for unsure pairs.
Optional --use-ai: Azure clusters ALL page section HTMLs → {project}/${SECTION_REGISTRY_AI_DIR}/.
Writes registrySection back into each page section-information.json.
Detects content families (e.g. news-article) → content-families.json.

Then writes section plans, site-summary, and ${AI_WEBSITE_DESIGN_MD}.
${forceHelpLine()}
Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY|AZURE_FOUNDRY_API_KEY, AZURE_OPENAI_DEFAULT_MODEL
Optional: AZURE_AI_DECIDE_MAX_CHARS (batch budget for --use-ai)`);
}

function parseArgs(argv) {
  let url = null;
  let force = null;
  let ai = false;
  let useAi = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const forced = consumeForceArg(argv, i);
    if (forced) {
      force = forced.force;
      i = forced.nextIndex - 1;
      continue;
    }
    if (a === '--url') url = argv[++i];
    else if (a === '--ai') ai = true;
    else if (a === '--use-ai') useAi = true;
    else if (a === '--aidecide') {
      throw new Error('--aidecide was renamed to --use-ai');
    } else if (a === '--page-dir') {
      throw new Error(
        '--page-dir removed — pass --url (or a bare https URL); merges all pages under .bq/captures/{host}',
      );
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a.startsWith('http://') || a.startsWith('https://')) {
      url = a.trim();
    }
  }
  return { url, force, ai, useAi };
}

function resolveProject(url) {
  if (!url) throw new Error('Provide --url <https://…> or a bare https URL');
  validateUrl(url);
  const host = hostSlugFromUrl(url);
  const projectRoot = path.join(defaultCapturesDir, host);
  return { projectRoot, host, url };
}

async function pathExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export async function discoverPageDirs(projectRoot) {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || HOST_NON_PAGE_DIRS.has(entry.name)) continue;
    const pageDir = path.join(projectRoot, entry.name);
    const hasSource = await pathExists(path.join(pageDir, 'source-url.txt'));
    const hasSections = await isDirectory(path.join(pageDir, 'sections'));
    if (hasSource || hasSections) pages.push(pageDir);
  }
  pages.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
  return pages;
}

function parseJsonText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

async function loadPageSections(pageDir) {
  const indexPath = path.join(pageDir, 'detected-sections.json');
  if (await pathExists(indexPath)) {
    const index = parseJsonText(await readFile(indexPath, 'utf8'));
    return { source: 'detected-sections.json', sections: index.sections || [] };
  }
  const manifestPath = path.join(pageDir, 'new-sections-manifest.json');
  if (await pathExists(manifestPath)) {
    const manifest = parseJsonText(await readFile(manifestPath, 'utf8'));
    return { source: 'new-sections-manifest.json', sections: manifest.sections || [] };
  }
  return { source: 'none', sections: [] };
}

/**
 * Programmatic merge entry (used by create:sectioncomponents step 0).
 * @param {{
 *   url: string,
 *   ai?: boolean,
 *   useAi?: boolean,
 *   force?: unknown,
 *   skipWebsiteDesign?: boolean,
 * }} opts
 */
export async function runHostSharedSectionsMerge(opts) {
  loadLocalEnvFiles();
  const { projectRoot, host, url } = resolveProject(opts.url);

  if (!(await pathExists(projectRoot))) {
    throw new Error(`Project folder not found: ${projectRoot} (run capture:webpage first)`);
  }

  const pageDirs = await discoverPageDirs(projectRoot);
  if (!pageDirs.length) {
    throw new Error(`No page folders under ${projectRoot}`);
  }

  const { sectionRegistryRoot, migratedFromLegacy } =
    await resolveSectionRegistryRoot(projectRoot);
  let globalManifest = await loadGlobalManifest(sectionRegistryRoot);
  if (!globalManifest.components) globalManifest.components = {};

  const aiStats = {
    called: 0,
    sureSame: 0,
    sureDifferent: 0,
    unsureNoAi: 0,
    failed: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };

  console.log(
    `Merging ${pageDirs.length} page(s) → ${host}/${SECTION_REGISTRY_DIR}/` +
      (migratedFromLegacy ? ' (migrated from legacy registry)' : '') +
      (opts.ai ? ' (--ai)' : '') +
      (opts.useAi ? ` (+--use-ai → ${SECTION_REGISTRY_AI_DIR}/)` : ''),
  );

  /** @type {object[]} */
  const pageReports = [];
  let totalSlots = 0;
  let totalNew = 0;
  let totalReuse = 0;

  for (const pageDir of pageDirs) {
    const pageSlug = path.basename(pageDir);
    const { source, sections: pageSections } = await loadPageSections(pageDir);
    if (!pageSections.length) {
      console.warn(`  Skip ${pageSlug}: no section metadata (${source})`);
      continue;
    }

    const report = await mergePageSectionsIntoDomain({
      pageDir,
      domainSectionsRoot: sectionRegistryRoot,
      pageSlug,
      globalManifest,
      pageSections,
      ai: Boolean(opts.ai),
      aiStats,
    });
    pageReports.push(report);

    const reused = report.sections.filter((s) => s.action === 'reuse').length;
    totalSlots += pageSections.length;
    totalNew += report.componentsToBuild.length;
    totalReuse += reused;
    console.log(
      `  ${pageSlug} [${source}]: ${report.componentsToBuild.length} new, ${reused} reused (${pageSections.length} listed)`,
    );
  }

  const { renames } = await applyBestNamesToManifest(globalManifest, sectionRegistryRoot);
  if (renames.length) {
    console.log(`  Best-name folder renames: ${renames.length}`);
    for (const r of renames) {
      console.log(`    ${r.from} → ${r.to} (${r.cmsName})`);
    }
  }

  // Migrate any leftover materialized instances/ trees (orphaned / skipped slots)
  const { loadOrMigrateInstances } = await import('./lib/merge-domain-sections.mjs');
  for (const entry of Object.values(globalManifest.components || {})) {
    if (!entry?.folderName) continue;
    const dir = path.join(sectionRegistryRoot, entry.folderName);
    const migrated = await loadOrMigrateInstances(dir, projectRoot);
    if (migrated.length && (!entry.instances || entry.instances.length < migrated.length)) {
      entry.instances = migrated;
    }
  }

  const familyResult = await applyContentFamilies(
    globalManifest,
    sectionRegistryRoot,
    projectRoot,
  );
  if (familyResult.families.length) {
    console.log(`  Content families: ${familyResult.families.length}`);
    for (const f of familyResult.families) {
      console.log(
        `    ${f.id}: ${f.memberFolders.join(', ')} (owner=${f.sharedItemTemplateOwner}, conf=${f.confidence})`,
      );
    }
  }
  if (familyResult.renames.length) {
    console.log(`  Family-role renames: ${familyResult.renames.length}`);
    for (const r of familyResult.renames) {
      console.log(`    ${r.from} → ${r.to} (${r.role})`);
    }
  }

  // Re-backlink pages after renames / family assign
  for (const report of pageReports) {
    for (const sec of report.sections || []) {
      const entry = Object.values(globalManifest.components || {}).find(
        (e) =>
          e.folderName === sec.domainFolder ||
          (sec.registrySection && e.folderName === sec.registrySection.componentFolder) ||
          (sec.sharedSection && e.folderName === sec.sharedSection.componentFolder) ||
          renames.some((r) => r.from === sec.domainFolder && e.folderName === r.to) ||
          familyResult.renames.some(
            (r) => r.from === sec.domainFolder && e.folderName === r.to,
          ),
      );
      if (!entry) continue;
      const pageSectionDir = path.join(
        projectRoot,
        report.pageDir,
        'sections',
        path.basename(sec.pageSectionFolder || ''),
      );
      await writeSharedSectionBacklink({
        pageSectionDir,
        registrySection: {
          registryPath: registryPath(entry.folderName),
          componentFolder: entry.folderName,
          contentHash: sec.contentHash || entry.contentHash || null,
          matchedBy: sec.matchedBy || entry.matchedBy || 'merged',
          canonicalPageSlug: entry.canonicalPageSlug,
          sourcePath: sec.sourcePath || entry.canonicalRef?.sourcePath || null,
          sectionFolder: path.basename(sec.pageSectionFolder || ''),
          definitionKey: entry.definitionKey || null,
          componentName: entry.componentName || null,
          status: entry.definitionKey ? entry.status || 'created' : 'merged',
          contentFamilyId: entry.contentFamilyId || null,
        },
      });
    }
  }

  globalManifest.updatedAt = new Date().toISOString();
  globalManifest.stats = {
    pages: pageDirs.length,
    slotsListed: totalSlots,
    uniqueComponents: Object.keys(globalManifest.components || {}).length,
    promoted: totalNew,
    reused: totalReuse,
    contentFamilies: familyResult.families.length,
  };
  await saveGlobalManifest(sectionRegistryRoot, globalManifest);
  await writeSectionPlans(projectRoot, globalManifest, { sectionsRoot: sectionRegistryRoot });
  await buildSiteSummary(projectRoot, globalManifest);

  try {
    const { writeComponentInventory } = await import(
      '../create-section-components/component-inventory.mjs'
    );
    const inventory = await writeComponentInventory(projectRoot, globalManifest);
    console.log(
      `  → component-inventory.json (${inventory.stats.uniqueComponents} components, ${inventory.stats.needsCodegen} needs-codegen)`,
    );
  } catch (err) {
    console.warn(
      `  ⚠ component-inventory.json: ${err?.message || err}`,
    );
  }


  // Remove orphaned registry folders not in the manifest (e.g. header-1 after rename)
  try {
    const { readdir, rm } = await import('node:fs/promises');
    const known = new Set(
      Object.values(globalManifest.components || {}).map((e) => e.folderName).filter(Boolean),
    );
    known.add('manifest.json');
    const names = await readdir(sectionRegistryRoot, { withFileTypes: true });
    for (const ent of names) {
      if (!ent.isDirectory()) continue;
      if (known.has(ent.name)) continue;
      if (ent.name === 'node_modules') continue;
      await rm(path.join(sectionRegistryRoot, ent.name), { recursive: true, force: true });
      console.log(`  … removed orphaned registry folder ${ent.name}/`);
    }
  } catch {
    /* best-effort */
  }

  console.log(`  → ${sectionRegistryRoot}`);
  console.log(
    `  Dedup: ${globalManifest.stats.uniqueComponents} unique / ${totalSlots} listed slots (${totalReuse} reuse actions this pass)`,
  );

  if (opts.ai || aiStats.called || aiStats.unsureNoAi) {
    const cost =
      aiStats.costUsd > 0 ? `~$${Math.round(aiStats.costUsd * 1e6) / 1e6}` : 'cost n/a';
    console.log(
      `  AI merge pairs: called=${aiStats.called}, unsureNoAi=${aiStats.unsureNoAi}, failed=${aiStats.failed}, tokens in=${aiStats.promptTokens} out=${aiStats.completionTokens} total=${aiStats.totalTokens} ${cost}`,
    );
  }

  if (opts.useAi) {
    await buildAiDecideSections({ projectRoot, pageDirs, url });
  }

  if (!opts.skipWebsiteDesign) {
    await mergeAiWebsiteDesign(projectRoot, { force: opts.force, url });
  }

  return {
    projectRoot,
    host,
    sectionRegistryRoot,
    sharedSectionsRoot: sectionRegistryRoot,
    globalManifest,
    aiStats,
    pageReports,
    contentFamilies: familyResult.families,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runHostSharedSectionsMerge({
    url: args.url,
    ai: args.ai,
    useAi: args.useAi,
    force: args.force,
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
