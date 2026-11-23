/**
 * Read-only diagnosis: Sitecoreize AI dump vs written packages vs existing
 * VF preview-props / shots. Does not rebuild, re-emit, or run fidelity repair.
 *
 * Usage:
 *   node --import tsx tools/create-section-components/diagnose-sitecoreize-preview.mjs \
 *     --component CrelanLocalServicesAndNavigation \
 *     --url "https://www.crelan.be/nl/particulieren"
 */
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { bqRoot } from '../capture/paths.mjs';
import { hostSlugFromUrl } from '../capture/lib/url-utils.mjs';
import { hostToHostSlugFolder, toKebabCase, toPascalCase } from './naming.mjs';
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

function printHelp() {
  console.log(`Usage: node --import tsx tools/create-section-components/diagnose-sitecoreize-preview.mjs --component <PascalName> [options]

Read-only checklist comparing Sitecoreize AI dumps, written packages, and
existing visual-fidelity preview-props/shots. No rebuild / no fidelity repair.

Required:
  --component <Name>    PascalCase component folder (e.g. CrelanLocalServicesAndNavigation)

Optional:
  --url <https://…>     Capture page URL (default: *.capture-meta.json)
  --host <hostSlug>     Host under src/components
  --section <section-NN>
  --help
`);
}

function parseArgs(argv) {
  const out = {
    component: null,
    url: null,
    host: null,
    section: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--component') out.component = argv[++i];
    else if (a.startsWith('--component=')) out.component = a.slice(12);
    else if (a === '--url') out.url = argv[++i];
    else if (a.startsWith('--url=')) out.url = a.slice(6);
    else if (a === '--host') out.host = argv[++i];
    else if (a.startsWith('--host=')) out.host = a.slice(7);
    else if (a === '--section') out.section = argv[++i];
    else if (a.startsWith('--section=')) out.section = a.slice(10);
  }
  return out;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractPlaceholderKeys(text) {
  const keys = [];
  const re = /key\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    keys.push(m[1]);
  }
  return [...new Set(keys)];
}

/**
 * Find Image-like seed problems in definition / JSON field blobs.
 * @param {string} text
 * @returns {{ field: string, issue: string }[]}
 */
function findBadImageSeeds(text) {
  /** @type {{ field: string, issue: string }[]} */
  const issues = [];
  const re =
    /['"]([^'"]+)['"]\s*:\s*\{\s*value\s*:\s*['"]([^'"]+)['"]\s*,\s*alt\s*:/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const field = m[1];
    const val = m[2];
    if (/map|image|img|photo|media/i.test(field) || /\.(png|jpe?g|webp|gif|svg)/i.test(val)) {
      issues.push({
        field,
        issue: `value is a string path ("${val.slice(0, 80)}"), not { src, alt }`,
      });
    }
  }
  return issues;
}

/**
 * @param {string} tsx
 */
function detectPageGuard(tsx) {
  const text = String(tsx || '');
  const hasAppPlaceholder = /AppPlaceholder/.test(text);
  const guardsOnPage =
    /if\s*\(\s*!rendering\s*\|\|\s*!page\s*\)/.test(text) ||
    /if\s*\(\s*!page\s*\|\|\s*!rendering\s*\)/.test(text) ||
    /if\s*\(\s*!page\s*\)/.test(text);
  const braceDyn = /`[^`]*-\{\$\{[^}]+\}\}[^`]*`/.test(text) || /-\{\$\{/.test(text);
  const braceLiteral = /-\{\$\{|-\{\d+\}|navigation-cards-\{/.test(text);
  return {
    hasAppPlaceholder,
    guardsOnPage,
    usesBraceDynamicName: braceDyn || braceLiteral || /-\{\$\{placeholderId\}\}/.test(text) || /`[^`]*-\{\$\{/.test(text),
  };
}

/**
 * Prefer newest attempt-* that still has preview-props or shots (skip empty stubs).
 * @param {string} vfComponentDir
 */
async function latestAttemptDir(vfComponentDir) {
  if (!(await exists(vfComponentDir))) return null;
  const entries = await readdir(vfComponentDir, { withFileTypes: true });
  const attempts = entries
    .filter((e) => e.isDirectory() && /^attempt-\d+$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const na = Number(a.replace(/\D/g, '')) || 0;
      const nb = Number(b.replace(/\D/g, '')) || 0;
      return nb - na;
    });
  for (const name of attempts) {
    const dir = path.join(vfComponentDir, name);
    const props = path.join(dir, 'preview', 'preview-props.json');
    const shot = path.join(dir, 'shots', 'candidate-desktop.png');
    if ((await exists(props)) || (await exists(shot))) return dir;
  }
  return attempts.length ? path.join(vfComponentDir, attempts[0]) : null;
}

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
    if (['sites', 'collections', 'data', 'ui'].includes(e.name)) continue;
    if (await exists(path.join(roots, e.name, componentName))) hits.push(e.name);
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    throw new Error(
      `Component ${componentName} under multiple hosts: ${hits.join(', ')}. Pass --host.`,
    );
  }
  throw new Error(`Component not found under bq/src/components/*/${componentName}`);
}

function sectionFolderFromMeta(sectionDir) {
  const raw = String(sectionDir || '').replace(/\\/g, '/').trim();
  if (!raw) return null;
  const m = raw.match(/(section-\d+)/i);
  if (m) return m[1];
  const base = path.basename(raw);
  return /^section-\d+/i.test(base) ? base : null;
}

/**
 * @param {object} props
 */
function summarizePreviewProps(props) {
  const parent = props?.parent || {};
  const children = Array.isArray(props?.children) ? props.children : [];
  /** @type {Record<string, number>} */
  const byKey = {};
  for (const c of children) {
    const k = String(c?.placeholderKey || '(none)');
    byKey[k] = (byKey[k] || 0) + 1;
  }
  const office =
    parent.fields?.['Office Map'] ||
    parent.fields?.OfficeMap ||
    parent.fields?.Image ||
    null;
  let officeSrc = null;
  let officeValueType = null;
  if (office) {
    const v = office.value;
    officeValueType = v == null ? 'null' : typeof v;
    if (v && typeof v === 'object') {
      officeSrc = v.src || v.Src || null;
    } else if (typeof v === 'string') {
      officeSrc = null;
    }
  }
  return {
    childCount: children.length,
    childrenByPlaceholderKey: byKey,
    hasPage: parent.page != null,
    dynamicPlaceholderId:
      parent.params?.DynamicPlaceholderId ??
      parent.rendering?.params?.DynamicPlaceholderId ??
      null,
    officeMapValueType: officeValueType,
    officeMapSrc: officeSrc,
    officeMapPresent: Boolean(office),
  };
}

/**
 * Find newest sitecoreize raw dump under ai-debug.
 * Prefer sanitized → *.raw.ai.json → legacy *.raw.json.ai.
 * @param {string} aiDebugRoot
 * @returns {Promise<string|null>}
 */
export async function findSitecoreizeRaw(aiDebugRoot) {
  if (!(await exists(aiDebugRoot))) return null;
  const entries = await readdir(aiDebugRoot);
  const pickNewest = (re) => {
    const hits = entries.filter((n) => re.test(n)).sort();
    return hits.length ? path.join(aiDebugRoot, hits[hits.length - 1]) : null;
  };
  return (
    pickNewest(/codegen-sitecoreize.*\.sanitized\.raw\.ai\.json$/i) ||
    pickNewest(/codegen-sitecoreize.*\.raw\.ai\.json$/i) ||
    pickNewest(/codegen-sitecoreize.*\.raw\.json\.ai$/i)
  );
}

export async function diagnoseSitecoreizePreview(args) {
  const componentName = toPascalCase(String(args.component || '').trim());
  if (!componentName) throw new Error('--component <PascalName> is required');

  let hostSlug = args.host ? hostToHostSlugFolder(String(args.host).trim()) : null;
  let meta = hostSlug ? await readCaptureMeta(hostSlug, componentName) : null;
  if (!hostSlug) {
    if (args.url) {
      hostSlug = await resolveHostSlug(componentName, hostSlugFromUrl(args.url));
    } else {
      hostSlug = await resolveHostSlug(componentName, null);
    }
    meta = await readCaptureMeta(hostSlug, componentName);
  }
  meta = meta || {};

  const url = String(args.url || meta.url || '').trim();
  if (!url) {
    throw new Error('Pass --url or ensure capture-meta has url');
  }
  const capture = await resolveCapturePageDir(url);
  const sectionFolder =
    String(args.section || '').trim() ||
    sectionFolderFromMeta(meta.sectionDir);
  if (!sectionFolder) {
    throw new Error('Cannot resolve section folder; pass --section section-NN');
  }

  const sectionAbs = path.join(capture.pageDir, 'sections', sectionFolder);
  const aiDebugRoot = path.join(sectionAbs, 'ai-debug');
  const kebab = toKebabCase(componentName);
  const pkgDir = componentDir(hostSlug, componentName);
  const defPath = path.join(pkgDir, `${kebab}.definition.ts`);
  const tsxPath = path.join(pkgDir, `${kebab}.tsx`);

  const checklist = [];
  /** @type {Record<string, unknown>} */
  const report = {
    componentName,
    hostSlug,
    pageDir: capture.pageDir,
    sectionFolder,
    paths: {},
    checks: checklist,
  };

  // --- shots (pre-sitecoreize writes under visual-fidelity/attempt-*) ---
  const legacyV3Desktop = path.join(
    aiDebugRoot,
    'visual-shots',
    'candidate-desktop.png',
  );
  const vfRootFlat = path.join(sectionAbs, 'visual-fidelity');
  // Prefer flat layout; fall back to leftover nested visual-fidelity/<Name>/ trees.
  const vfRootCandidates = [
    vfRootFlat,
    ...[
      ...new Set(
        [
          componentName,
          componentName.replace(/^Crelan/i, ''),
        ].filter(Boolean),
      ),
    ].map((name) => path.join(vfRootFlat, name)),
  ];
  /** @type {string|null} */
  let attemptDir = null;
  /** @type {string|null} */
  let vfRootUsed = null;
  for (const root of vfRootCandidates) {
    const latest = await latestAttemptDir(root);
    if (latest) {
      attemptDir = latest;
      vfRootUsed = root;
      break;
    }
  }
  const vfDesktop = attemptDir
    ? path.join(attemptDir, 'shots', 'candidate-desktop.png')
    : null;
  const shotCheck = {
    id: 'shot-parity',
    vfAttemptDesktop: {
      path: vfDesktop,
      exists: vfDesktop ? await exists(vfDesktop) : false,
      attemptDir,
      vfRoot: vfRootUsed,
    },
    legacyV3VisualDesktop: {
      path: legacyV3Desktop,
      exists: await exists(legacyV3Desktop),
    },
  };
  checklist.push(shotCheck);
  report.paths.vfAttemptDesktop = vfDesktop;
  report.paths.legacyV3VisualDesktop = legacyV3Desktop;

  // --- AI dump ---
  const sitecoreizeRawPath = await findSitecoreizeRaw(aiDebugRoot);
  report.paths.sitecoreizeRaw = sitecoreizeRawPath;
  /** @type {string[]} */
  let aiPlaceholderKeys = [];
  /** @type {{ field: string, issue: string }[]} */
  let aiImageIssues = [];
  let aiPackageCount = 0;
  if (sitecoreizeRawPath) {
    try {
      const raw = JSON.parse(await readFile(sitecoreizeRawPath, 'utf8'));
      const packages = Array.isArray(raw?.packages) ? raw.packages : [];
      aiPackageCount = packages.length;
      for (const pkg of packages) {
        const def = String(pkg.definitionTs || '');
        aiPlaceholderKeys.push(...extractPlaceholderKeys(def));
        aiImageIssues.push(...findBadImageSeeds(def));
      }
      aiPlaceholderKeys = [...new Set(aiPlaceholderKeys)];
    } catch (err) {
      checklist.push({
        id: 'ai-dump-parse',
        ok: false,
        error: err?.message || String(err),
      });
    }
  } else {
    checklist.push({
      id: 'ai-dump',
      ok: false,
      error:
        'no codegen-sitecoreize*.raw.ai.json (or sanitized/legacy) under ai-debug',
    });
  }

  // --- disk packages ---
  const diskDef = (await exists(defPath)) ? await readFile(defPath, 'utf8') : '';
  const diskTsx = (await exists(tsxPath)) ? await readFile(tsxPath, 'utf8') : '';
  const diskPlaceholderKeys = extractPlaceholderKeys(diskDef);
  const diskImageIssues = findBadImageSeeds(diskDef);
  const tsxGuard = detectPageGuard(diskTsx);
  report.paths.definition = defPath;
  report.paths.tsx = tsxPath;

  const phCheck = {
    id: 'ai-vs-disk-placeholders',
    aiKeys: aiPlaceholderKeys,
    diskKeys: diskPlaceholderKeys,
    aiPackageCount,
    collapsed:
      aiPlaceholderKeys.length > 1 &&
      diskPlaceholderKeys.length === 1 &&
      aiPlaceholderKeys.some((k) => !diskPlaceholderKeys.includes(k)),
  };
  checklist.push(phCheck);

  checklist.push({
    id: 'ai-vs-disk-image-seeds',
    aiIssues: aiImageIssues,
    diskIssues: diskImageIssues,
  });

  checklist.push({
    id: 'tsx-page-guard',
    ...tsxGuard,
    note: tsxGuard.guardsOnPage
      ? 'AppPlaceholder gated on page — VF preview-props without page will render empty placeholders'
      : null,
  });

  // --- existing preview-props ---
  const previewPropsPath = attemptDir
    ? path.join(attemptDir, 'preview', 'preview-props.json')
    : null;
  report.paths.previewProps = previewPropsPath;
  if (previewPropsPath && (await exists(previewPropsPath))) {
    const props = JSON.parse(await readFile(previewPropsPath, 'utf8'));
    const summary = summarizePreviewProps(props);
    const dyn = summary.dynamicPlaceholderId;
    const braceNameSample = dyn != null ? `navigation-cards-{${dyn}}` : null;
    const dashNameSample = dyn != null ? `navigation-cards-${dyn}` : null;
    checklist.push({
      id: 'preview-props',
      ...summary,
      braceNameSample,
      dashNameSample,
      nameMismatchRisk:
        tsxGuard.usesBraceDynamicName && dyn != null
          ? `TSX likely uses ${braceNameSample}; preview-server registers ${dashNameSample}`
          : null,
      verdictHints: [
        !summary.hasPage && tsxGuard.guardsOnPage
          ? 'FAIL: parent.page missing + TSX guards on page → placeholders null'
          : null,
        summary.officeMapPresent &&
        summary.officeMapValueType === 'string'
          ? 'FAIL: Office Map value is string (needs value.src)'
          : null,
        summary.officeMapPresent &&
        summary.officeMapValueType === 'object' &&
        !summary.officeMapSrc
          ? 'FAIL: Office Map object missing src'
          : null,
        Object.keys(summary.childrenByPlaceholderKey).length === 1 &&
        aiPlaceholderKeys.length > 1
          ? 'WARN: all children under one placeholderKey; AI had multiple slots'
          : null,
      ].filter(Boolean),
    });
  } else {
    checklist.push({
      id: 'preview-props',
      ok: false,
      error: previewPropsPath
        ? `missing ${previewPropsPath}`
        : 'no visual-fidelity attempt-* folder',
    });
  }

  // --- console ---
  console.log(`\n=== diagnose sitecoreize vs preview ===`);
  console.log(`Component: ${componentName}`);
  console.log(`Host:      ${hostSlug}`);
  console.log(`Section:   ${sectionFolder}`);
  console.log(`Page:      ${capture.pageDir}`);
  console.log('');

  console.log(`1) Shot parity`);
  console.log(
    `   vf-attempt: ${shotCheck.vfAttemptDesktop.exists ? 'YES' : 'NO '} ${
      vfDesktop
        ? path.relative(capture.pageDir, vfDesktop).replace(/\\/g, '/')
        : '(none)'
    }`,
  );
  console.log(
    `   legacy visual-shots: ${shotCheck.legacyV3VisualDesktop.exists ? 'YES' : 'NO '} ${path.relative(capture.pageDir, legacyV3Desktop).replace(/\\/g, '/')}`,
  );

  console.log(`2) AI vs disk placeholders`);
  console.log(`   AI keys:   [${aiPlaceholderKeys.join(', ') || '—'}] (packages=${aiPackageCount})`);
  console.log(`   Disk keys: [${diskPlaceholderKeys.join(', ') || '—'}]`);
  if (phCheck.collapsed) {
    console.log(`   → COLLAPSED after write/fixup (AI had more slots than disk)`);
  }

  console.log(`3) Image seeds`);
  if (!aiImageIssues.length && !diskImageIssues.length) {
    console.log(`   OK (no string-path Image seeds detected)`);
  } else {
    for (const i of aiImageIssues) console.log(`   AI:   ${i.field}: ${i.issue}`);
    for (const i of diskImageIssues) console.log(`   Disk: ${i.field}: ${i.issue}`);
  }

  console.log(`4) preview-props (existing attempt)`);
  const pp = checklist.find((c) => c.id === 'preview-props');
  if (pp?.error) {
    console.log(`   ${pp.error}`);
  } else if (pp) {
    console.log(`   children=${pp.childCount} byKey=${JSON.stringify(pp.childrenByPlaceholderKey)}`);
    console.log(`   hasPage=${pp.hasPage} DynamicPlaceholderId=${pp.dynamicPlaceholderId}`);
    console.log(
      `   OfficeMap: present=${pp.officeMapPresent} valueType=${pp.officeMapValueType} src=${pp.officeMapSrc || '—'}`,
    );
    if (pp.nameMismatchRisk) console.log(`   ${pp.nameMismatchRisk}`);
    for (const h of pp.verdictHints || []) console.log(`   ${h}`);
  }

  console.log(`5) TSX page guard`);
  console.log(
    `   AppPlaceholder=${tsxGuard.hasAppPlaceholder} guardsOnPage=${tsxGuard.guardsOnPage} braceDynName=${tsxGuard.usesBraceDynamicName}`,
  );
  if (tsxGuard.note) console.log(`   ${tsxGuard.note}`);

  console.log('');
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.component) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  await diagnoseSitecoreizePreview(args);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]).replace(/\\/g, '/').endsWith(
    'diagnose-sitecoreize-preview.mjs',
  );

if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
}
