/**
 * Persist pre-fixup AI request/response artifacts under the page section
 * being codegenned:
 * `.bq/captures/{host}/{pageSlug}/sections/section-NN/ai-debug/`
 * (children: `…/ai-debug/{childStem}/`).
 *
 * Opt out: BQ_AI_DEBUG_DUMP=0 | BQ_SKIP_AI_DEBUG=1 | --skip-ai-debug
 *
 * Before the first dump for a section in a process, the ai-debug/
 * directory is cleared so only the latest decompose/codegen run remains.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAiUsageEntry } from '../shared/ai-usage-meta.mjs';
import { SECTION_REGISTRY_DIR } from '../capture/lib/section-registry-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Same package root `loadPrompt` uses for `prompts/*`. */
export const CREATE_SECTION_COMPONENTS_DIR = __dirname;
export const CREATE_SECTION_PROMPTS_DIR = path.join(__dirname, 'prompts');

/** @type {boolean|null} */
let skipOverride = null;

/** Absolute ai-debug dirs already cleared this process. */
const clearedAiDebugDirs = new Set();

/**
 * @param {boolean} skip
 */
export function setSkipAiDebugDump(skip) {
  skipOverride = Boolean(skip);
}

export function isAiDebugDumpEnabled() {
  if (skipOverride === true) return false;
  if (skipOverride === false) return true;
  const v = String(process.env.BQ_AI_DEBUG_DUMP || '').trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  if (String(process.env.BQ_SKIP_AI_DEBUG || '').trim() === '1') return false;
  return true;
}

/**
 * Kebab stem for nested child package folders under a section registry root.
 * @param {string} name
 * @returns {string}
 */
export function registryChildFolderStem(name) {
  return (
    String(name || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 64) || 'child'
  );
}

/**
 * Resolve dump directory: explicit aiDebugRoot, else page section dir:
 * pageSectionDir/ai-debug[/childFolder].
 * Legacy fallback: projectRoot/section-registry/{componentFolder}/…
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   projectRoot?: string,
 *   componentFolder?: string,
 *   childFolder?: string,
 * }} opts
 * @returns {string}
 */
export function resolveAiDebugOutDir(opts = {}) {
  const explicit = String(opts.aiDebugRoot || '').trim();
  if (explicit) return path.resolve(explicit);
  const pageSectionDir = String(opts.pageSectionDir || '').trim();
  const childFolder = String(opts.childFolder || '').trim();
  if (pageSectionDir) {
    const parts = [pageSectionDir, 'ai-debug'];
    if (childFolder) parts.push(childFolder);
    return path.join(...parts);
  }
  // Legacy registry path (prefer pageSectionDir for new runs).
  const projectRoot = String(opts.projectRoot || '').trim();
  const componentFolder = String(opts.componentFolder || '').trim();
  if (projectRoot && componentFolder) {
    const parts = [projectRoot, SECTION_REGISTRY_DIR, componentFolder];
    if (childFolder) parts.push(childFolder);
    parts.push('ai-debug');
    return path.join(...parts);
  }
  return '';
}

/**
 * Delete ai-debug/ contents once per dir so a new codegen run starts clean.
 * Always wipes even when dumps are disabled (stale files must not linger).
 * @param {string} outDir
 * @param {{ recreate?: boolean, force?: boolean }} [opts]
 *   recreate — recreate empty dir when dumps enabled (default true)
 *   force — wipe again even if already cleared this process
 */
export async function clearAiDebugDumpDir(outDir, opts = {}) {
  const dir = String(outDir || '').trim();
  if (!dir) return;
  const abs = path.resolve(dir);
  if (clearedAiDebugDirs.has(abs) && opts.force !== true) return;
  await rm(abs, { recursive: true, force: true });
  const recreate = opts.recreate !== false && isAiDebugDumpEnabled();
  if (recreate) {
    await mkdir(abs, { recursive: true });
  }
  clearedAiDebugDirs.add(abs);
}

/**
 * Wipe every ai-debug tree under a section registry folder (parent + nested children).
 * Recreates the section-root ai-debug/ when dumps are enabled so the next write succeeds.
 * @param {string} sectionRegistryDir — …/section-registry/{folder}
 */
export async function clearSectionRegistryAiDebugTrees(sectionRegistryDir) {
  const root = String(sectionRegistryDir || '').trim();
  if (!root) return;
  const { readdir } = await import('node:fs/promises');
  const rootDebug = path.join(root, 'ai-debug');
  /** @type {string[]} */
  const childTargets = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'ai-debug' || e.name === 'instances') continue;
      childTargets.push(path.join(root, e.name, 'ai-debug'));
    }
  } catch {
    /* missing */
  }
  // Wipe nested child ai-debug trees without marking them "cleared" — child
  // codegen will clearAiDebugDumpDir(+recreate) right before its first dump.
  for (const t of childTargets) {
    await rm(t, { recursive: true, force: true }).catch(() => {});
    clearedAiDebugDirs.delete(path.resolve(t));
  }
  // Parent last: wipe + recreate empty dir for this run's dumps.
  await clearAiDebugDumpDir(rootDebug, {
    recreate: isAiDebugDumpEnabled(),
    force: true,
  });
}

/** @internal test helper */
export function _resetAiDebugClearedDirsForTests() {
  clearedAiDebugDirs.clear();
}

/**
 * Safe filesystem stem from purpose + component name.
 * @param {string} purpose
 * @param {string} [componentName]
 * @param {{ iteration?: number|string|null }} [extra]
 */
export function aiDebugStem(purpose, componentName = '', extra = {}) {
  const p = String(purpose || 'ai')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ai';
  const c = String(componentName || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const iter =
    extra.iteration != null && String(extra.iteration).trim() !== ''
      ? `-i${String(extra.iteration).replace(/[^a-zA-Z0-9_-]+/g, '')}`
      : '';
  return c ? `${p}${iter}-${c}` : `${p}${iter}`;
}

/**
 * Observability only: persist post-lean definitionTs when parse assert fails.
 * Sync so it lands before the thrown error unwinds the codegen stack.
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   childFolder?: string,
 *   componentName?: string,
 *   definitionKey?: string,
 *   source: string,
 * }} opts
 * @returns {{ outDir: string, path: string, stem: string }|null}
 */
export function writeDefinitionAfterFixupsDump(opts) {
  if (!isAiDebugDumpEnabled()) return null;
  const outDir = resolveAiDebugOutDir(opts);
  if (!outDir) return null;
  const nameHint =
    String(opts.componentName || '').trim() ||
    String(opts.definitionKey || '').trim() ||
    'definition';
  const stem = aiDebugStem('definition-after-fixups', nameHint);
  try {
    mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `${stem}.ts.ai`);
    const body = String(opts.source || '');
    writeFileSync(filePath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
    return { outDir, path: filePath, stem };
  } catch {
    return null;
  }
}

/**
 * Observability: when definition seed sanitize rewrote content, write
 * `{stem}.ai-sanitize.meta.json` + `{stem}.sanitized.raw.ai.json`.
 * No-op when dumps disabled or sanitize made no changes.
 *
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   childFolder?: string,
 *   stem?: string,
 *   purpose?: string,
 *   componentName?: string,
 *   componentNames?: string[],
 *   changed?: number,
 *   changes?: object[],
 *   beforeSource?: string,
 *   afterSource?: string,
 *   packagesJson?: object|null,
 * }} opts
 * @returns {{ outDir: string, stem: string, metaPath: string, sanitizedPath: string }|null}
 */
export function writeDefinitionSanitizeDump(opts) {
  if (!isAiDebugDumpEnabled()) return null;
  const changes = Array.isArray(opts.changes) ? opts.changes : [];
  const changed = Number(opts.changed ?? changes.length) || 0;
  if (changed <= 0 && changes.length === 0) return null;

  const outDir = resolveAiDebugOutDir(opts);
  if (!outDir) return null;

  const nameHint =
    String(opts.componentName || '').trim() ||
    (Array.isArray(opts.componentNames) && opts.componentNames[0]) ||
    'definition';
  const stem =
    String(opts.stem || '').trim() ||
    aiDebugStem(opts.purpose || 'definition-sanitize', nameHint);

  try {
    mkdirSync(outDir, { recursive: true });
    const meta = {
      purpose: opts.purpose || 'definition-sanitize',
      componentName: opts.componentName || nameHint || '',
      componentNames: Array.isArray(opts.componentNames)
        ? opts.componentNames
        : undefined,
      changed: changed || changes.length,
      writtenAt: new Date().toISOString(),
      stem,
      changes,
    };
    const metaPath = path.join(outDir, `${stem}.ai-sanitize.meta.json`);
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

    let sanitizedBody;
    if (opts.packagesJson != null && typeof opts.packagesJson === 'object') {
      sanitizedBody = `${JSON.stringify(opts.packagesJson, null, 2)}\n`;
    } else if (opts.afterSource != null) {
      sanitizedBody = formatRawAiJsonDump(
        JSON.stringify({
          definitionTs: String(opts.afterSource || ''),
          beforeDefinitionTs:
            opts.beforeSource != null ? String(opts.beforeSource) : undefined,
        }),
      );
    } else {
      sanitizedBody = `${JSON.stringify({ changes }, null, 2)}\n`;
    }
    const sanitizedPath = path.join(outDir, `${stem}.sanitized.raw.ai.json`);
    writeFileSync(sanitizedPath, sanitizedBody, 'utf8');

    return { outDir, stem, metaPath, sanitizedPath };
  } catch {
    return null;
  }
}

/**
 * Rel path stamped on multimodal image parts for debug dumps (not sent as text).
 * @param {object} part
 * @returns {string}
 */
export function imagePartRelPath(part) {
  if (!part || typeof part !== 'object') return '';
  const raw =
    part._bqRelPath ||
    part.bqRelPath ||
    part.image_url?._bqRelPath ||
    part.image?._bqRelPath ||
    '';
  return String(raw || '')
    .replace(/\\/g, '/')
    .trim();
}

/**
 * Build 1-based image labels in **message appearance order**.
 * Prefer per-part `_bqRelPath`, then `imageRelsInOrder` (evidence attach order).
 * Do **not** derive labels from alphabetically sorted attachment lists.
 *
 * @param {object[]} messages
 * @param {{ imageRelsInOrder?: string[] }} [opts]
 * @returns {Map<number, string>}
 */
export function buildImageLabelByIndexFromMessages(messages, opts = {}) {
  const ordered = (opts.imageRelsInOrder || [])
    .map((p) => String(p || '').replace(/\\/g, '/').trim())
    .filter(Boolean);
  /** @type {Map<number, string>} */
  const map = new Map();
  let imageSeq = 0;
  let orderIdx = 0;
  for (const msg of messages || []) {
    const content = msg?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const isImage =
        part.type === 'image_url' ||
        part.type === 'image' ||
        Boolean(part.image_url) ||
        Boolean(part.image);
      if (!isImage) continue;
      imageSeq += 1;
      const fromPart = imagePartRelPath(part);
      const fromOrder = ordered[orderIdx] || '';
      orderIdx += 1;
      map.set(imageSeq, fromPart || fromOrder || `(unnamed image #${imageSeq})`);
    }
  }
  return map;
}

/**
 * Annotate prior-step input blocks so dumps are not mistaken for this call's model output.
 * Does not remove content — fidelity to the live request is preserved.
 * @param {string} text
 * @returns {string}
 */
export function annotatePriorStepInputsInPromptDump(text) {
  let out = String(text || '');
  out = out.replace(
    /=== VISUAL TSX \(authoritative structure\/classes\) ===/g,
    [
      '=== VISUAL TSX (authoritative structure/classes) ===',
      '(DUMP NOTE: prior visual-step INPUT inlined in this request — not this call\'s model response.',
      ' Model response for this call is in sibling .raw.ai.json / package dumps.)',
    ].join('\n'),
  );
  return out;
}

/**
 * Pretty-print JSON for ai-debug raw dumps when content parses; else return body as-is.
 * @param {string} raw
 */
export function formatRawAiJsonDump(raw) {
  const text = String(raw ?? '');
  try {
    const parsed = JSON.parse(text);
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return text.endsWith('\n') ? text : `${text}\n`;
  }
}

/**
 * Serialize chat messages for `.prompt.ai` (request input only; no base64 images).
 * Skips assistant/tool/function roles so model responses never land in this dump.
 * @param {object[]} messages
 * @param {{ imageLabelByIndex?: Map<number, string>, imageRelsInOrder?: string[] }} [opts]
 */
export function serializeMessagesForPromptDump(messages, opts = {}) {
  const lines = [
    '=== AI REQUEST (input only) ===',
    'This file dumps the Azure chat messages that were SENT (system/user).',
    'It does NOT include the model response — see sibling .raw.ai.json / .tsx.ai / .definition.ts.ai.',
    '',
  ];
  let imageSeq = 0;
  let messageNo = 0;
  const labelMap =
    opts.imageLabelByIndex ||
    buildImageLabelByIndexFromMessages(messages, {
      imageRelsInOrder: opts.imageRelsInOrder,
    });

  for (let mi = 0; mi < (messages || []).length; mi++) {
    const msg = messages[mi] || {};
    const role = String(msg.role || 'user').toLowerCase();
    // Request dump only — never serialize model / tool turns.
    if (role === 'assistant' || role === 'tool' || role === 'function') {
      continue;
    }
    messageNo += 1;
    lines.push(`===== MESSAGE ${messageNo} role=${role} =====`);
    const content = msg.content;
    if (typeof content === 'string') {
      lines.push(annotatePriorStepInputsInPromptDump(content));
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const isImage =
          part.type === 'image_url' ||
          part.type === 'image' ||
          part.image_url ||
          part.image;
        // Prefer image handling when the part is an image (even if text sneaks in).
        if (isImage) {
          imageSeq += 1;
          const fromPart = imagePartRelPath(part);
          const label =
            fromPart ||
            labelMap.get(imageSeq) ||
            `(unnamed image #${imageSeq})`;
          lines.push(`[image attachment: ${label}]`);
          continue;
        }
        if (part.type === 'text' || typeof part.text === 'string') {
          lines.push(annotatePriorStepInputsInPromptDump(String(part.text || '')));
          continue;
        }
        lines.push(`[unserialized content part type=${part.type || typeof part}]`);
      }
    } else if (content != null) {
      lines.push(annotatePriorStepInputsInPromptDump(String(content)));
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Best-effort extract tsx / clientTsx / definitionTs from raw model JSON text
 * without normalizeAiSource / fixups.
 * @param {string} rawContent
 * @returns {{ tsx?: string, clientTsx?: string, definitionTs?: string, notes?: string }|null}
 */
export function tryParseRawCodegenFields(rawContent) {
  let text = String(rawContent || '').trim();
  if (!text) return null;
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    /** @type {{ tsx?: string, clientTsx?: string, definitionTs?: string, notes?: string }} */
    const out = {};
    if (typeof parsed.tsx === 'string') out.tsx = parsed.tsx;
    if (parsed.clientTsx != null && String(parsed.clientTsx).trim()) {
      out.clientTsx = String(parsed.clientTsx);
    }
    if (typeof parsed.definitionTs === 'string') out.definitionTs = parsed.definitionTs;
    if (parsed.notes != null) out.notes = String(parsed.notes);
    return out;
  } catch {
    return null;
  }
}

/**
 * Derive capture pageDir from an ai-debug outDir when it ends with
 * `sections/<folder>/ai-debug` (optionally `…/ai-debug/<child>`).
 * @param {string} outDir
 * @returns {string|null}
 */
export function derivePageDirFromAiDebugOutDir(outDir) {
  const abs = path.resolve(String(outDir || ''));
  const norm = abs.replace(/\\/g, '/');
  const m = norm.match(/^(.*)\/sections\/[^/]+\/ai-debug(?:\/[^/]+)?$/i);
  return m?.[1] ? path.resolve(m[1]) : null;
}

/**
 * Resolve a logical dump path (page-relative `sections/…`, package `prompts/…`,
 * or already dump-local) to an absolute filesystem path.
 * @param {string} logicalRel
 * @param {{ outDir: string, pageDir?: string|null }} ctx
 * @returns {string}
 */
export function resolveAiDebugIndexAbsPath(logicalRel, ctx) {
  const rel = String(logicalRel || '').replace(/\\/g, '/').trim();
  const outDir = path.resolve(ctx.outDir || '');
  const pageDir =
    (ctx.pageDir && path.resolve(ctx.pageDir)) ||
    derivePageDirFromAiDebugOutDir(outDir);

  if (!rel) return outDir;

  if (/^prompts\//i.test(rel)) {
    return path.resolve(CREATE_SECTION_COMPONENTS_DIR, rel);
  }

  // Dump-local sibling (e.g. visual-*.tsx.ai listed without sections/ prefix)
  if (!rel.includes('/') && !rel.includes('\\')) {
    return path.join(outDir, rel);
  }

  if (pageDir) {
    if (/^sections\//i.test(rel) || /^ai-debug\//i.test(rel)) {
      return path.resolve(pageDir, rel);
    }
    // Capture artifacts (PNG/HTML) are page-relative.
    return path.resolve(pageDir, rel);
  }

  return path.resolve(outDir, rel);
}

/**
 * Markdown index body with Ctrl-clickable links relative to outDir.
 * @param {string} title
 * @param {string[]} logicalRels
 * @param {{ outDir: string, pageDir?: string|null }} ctx
 * @returns {string}
 */
export function formatAiDebugIndexMarkdown(title, logicalRels, ctx) {
  const lines = [`# ${title}`, ''];
  const list = Array.isArray(logicalRels) ? logicalRels : [];
  if (!list.length) {
    lines.push('_(none)_', '');
    return `${lines.join('\n')}`;
  }
  for (const logical of list) {
    const logicalRel = String(logical || '').replace(/\\/g, '/');
    // Display basename (plan example); resolve from full logical path.
    const label = path.posix.basename(logicalRel) || logicalRel;
    const abs = resolveAiDebugIndexAbsPath(logicalRel, ctx);
    let href = path.relative(ctx.outDir, abs).replace(/\\/g, '/');
    if (!href || href === '.') href = path.basename(abs);
    // Markdown-safe: angle-bracket targets when spaces / odd chars
    const needsBrackets = /[\s()]/.test(href);
    const target = needsBrackets ? `<${href}>` : href;
    lines.push(`- [${label}](${target})`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

/**
 * @param {{
 *   aiDebugRoot?: string,
 *   pageSectionDir?: string,
 *   pageDir?: string,
 *   projectRoot?: string,
 *   componentFolder?: string,
 *   sectionFolder?: string,
 *   purpose: string,
 *   componentName?: string,
 *   iteration?: number|string|null,
 *   messages: object[],
 *   result: { content?: string, ok?: boolean, model?: string, usage?: object, costEstimate?: object, skipReason?: string },
 *   attachments?: string[],
 *   imageRelsInOrder?: string[],
 *   sources?: string[],
 *   extraSources?: string[],
 *   extraAttachments?: string[],
 *     @deprecated Prefer `sources` / `extraSources`. Non-image paths are written to
 *     `.sources.md`; image paths still fold into `.attachments.md` only when
 *     `imageRelsInOrder` is empty.
 *   evidenceMode?: 'html'|'png'|string,
 *   clearBeforeWrite?: boolean,
 * }} opts
 * Page-relative `imageRelsInOrder` must match message image order (unsorted).
 * `.attachments.md` = multimodal image crops actually sent (png evidence mode).
 * `.sources.md` = inlined prompt sources (HTML / system md) — not file uploads.
 */
export async function writeAiDebugDump(opts) {
  if (!isAiDebugDumpEnabled()) return null;
  const outDir = resolveAiDebugOutDir(opts);
  if (!outDir) return null;

  if (opts.clearBeforeWrite !== false) {
    await clearAiDebugDumpDir(outDir);
  } else {
    await mkdir(outDir, { recursive: true });
  }

  const stem = aiDebugStem(opts.purpose, opts.componentName, {
    iteration: opts.iteration,
  });

  const normalizeRel = (p) => String(p || '').replace(/\\/g, '/').trim();
  const isImageRel = (p) => /\.(png|jpe?g|gif|webp)$/i.test(p);

  const imageRelsInOrder = (opts.imageRelsInOrder || [])
    .map(normalizeRel)
    .filter(isImageRel);

  const fromAttachments = (opts.attachments || [])
    .map(normalizeRel)
    .filter(Boolean);
  // Multimodal attachments = image parts only (prefer ordered list used for labels).
  const attachmentList = [
    ...new Set(
      imageRelsInOrder.length > 0
        ? imageRelsInOrder
        : fromAttachments.filter(isImageRel),
    ),
  ].sort();

  // Inlined prompt sources (HTML, system prompts) — never presented as uploads.
  const sourceList = [
    ...new Set(
      [
        ...(opts.sources || []),
        ...(opts.extraSources || []),
        ...fromAttachments.filter((p) => !isImageRel(p)),
        ...(opts.extraAttachments || []),
      ]
        .map(normalizeRel)
        .filter(Boolean),
    ),
  ].sort();

  const imageLabelByIndex = buildImageLabelByIndexFromMessages(
    opts.messages || [],
    { imageRelsInOrder },
  );

  const promptText = serializeMessagesForPromptDump(opts.messages || [], {
    imageLabelByIndex,
    imageRelsInOrder,
  });
  const raw = String(opts.result?.content ?? '');
  const parsed = tryParseRawCodegenFields(raw);

  const pageDir =
    (opts.pageDir && String(opts.pageDir).trim()) ||
    derivePageDirFromAiDebugOutDir(outDir);
  const indexCtx = { outDir, pageDir };

  await mkdir(outDir, { recursive: true });
  const base = path.join(outDir, stem);
  await writeFile(`${base}.prompt.ai`, promptText, 'utf8');
  await writeFile(
    `${base}.attachments.md`,
    formatAiDebugIndexMarkdown(
      'Attachments (multimodal images sent)',
      attachmentList,
      indexCtx,
    ),
    'utf8',
  );
  await writeFile(
    `${base}.sources.md`,
    formatAiDebugIndexMarkdown(
      'Sources (inlined in the request)',
      sourceList,
      indexCtx,
    ),
    'utf8',
  );
  await writeFile(`${base}.raw.ai.json`, formatRawAiJsonDump(raw), 'utf8');

  if (parsed?.tsx) {
    await writeFile(
      `${base}.tsx.ai`,
      parsed.tsx.endsWith('\n') ? parsed.tsx : `${parsed.tsx}\n`,
      'utf8',
    );
  }
  if (parsed?.clientTsx) {
    await writeFile(
      `${base}.client.tsx.ai`,
      parsed.clientTsx.endsWith('\n') ? parsed.clientTsx : `${parsed.clientTsx}\n`,
      'utf8',
    );
  }
  if (parsed?.definitionTs) {
    await writeFile(
      `${base}.definition.ts.ai`,
      parsed.definitionTs.endsWith('\n')
        ? parsed.definitionTs
        : `${parsed.definitionTs}\n`,
      'utf8',
    );
  }

  const sectionFolder = String(opts.sectionFolder || opts.componentFolder || '').trim();
  const evidenceMode = String(opts.evidenceMode || '').trim().toLowerCase() || null;
  const usageCore = buildAiUsageEntry({
    purpose: opts.purpose || 'ai-debug',
    model: opts.result?.model || null,
    ok: Boolean(opts.result?.ok),
    skipReason: opts.result?.skipReason || null,
    usage: opts.result?.usage || null,
    costEstimate: opts.result?.costEstimate || null,
    context: {
      componentName: opts.componentName || '',
      iteration: opts.iteration ?? null,
      sectionFolder,
      componentFolder: opts.componentFolder || null,
      evidenceMode,
      attachmentCount: attachmentList.length,
      sourceCount: sourceList.length,
      stem,
    },
  });
  // Per-stem dump meta (many calls share ai-debug/); keep dump fields flat for readers.
  const meta = {
    purpose: usageCore.purpose,
    componentName: opts.componentName || '',
    iteration: opts.iteration ?? null,
    sectionFolder,
    componentFolder: opts.componentFolder || null,
    evidenceMode,
    model: usageCore.model,
    ok: usageCore.ok,
    skipReason: usageCore.skipReason,
    usage: usageCore.usage,
    costEstimate: usageCore.costEstimate,
    attachmentCount: attachmentList.length,
    sourceCount: sourceList.length,
    stem,
    writtenAt: usageCore.writtenAt,
  };
  await writeFile(`${base}.meta.json`, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return {
    outDir,
    stem,
    attachmentCount: attachmentList.length,
    sourceCount: sourceList.length,
  };
}
