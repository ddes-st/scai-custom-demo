/**
 * Azure OpenAI → Stream brand-kit section draft from URL/company + capture artifacts.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assemblePagePayload,
} from '../capture/lib/design-system/ai/generate-ai-design-guide.mjs';
import {
  azureChatCompletion,
  resolveAzureChatConfig,
} from '../capture/lib/design-system/ai/azure-chat.mjs';
import {
  readBrandkitDraft,
  writeBrandkitDraft,
} from './state.mjs';

/** Default Stream brand kit section names (docs). */
export const DEFAULT_BRANDKIT_SECTIONS = [
  'Global Goals',
  'Brand Context',
  "Dos and Don'ts",
  'Tone of Voice',
  'Checklist',
  'Grammar Guidelines',
  'Visual Guidelines',
  'Image Style',
];

/** Bump to invalidate cached draft.json when prompt requirements change. */
export const BRANDKIT_PROMPT_VERSION = 'v2-extended';

/** Dedicated Dos and Don'ts subsections for Stream Brand Assistant rules. */
export const DOS_DONT_EXTENSIONS_FIELD = 'Extensions';
export const DOS_DONT_RESTRICTIONS_FIELD = 'Restrictions';

export const MANDATORY_DOS_DONT_EXTENSION =
  '#Extend# Always add at the end:\n"AI can make mistakes. Always verify responses."';

export const MANDATORY_DOS_DONT_RESTRICTION =
  '#Restrict# When a user asks a question related to competitors to say: We do not share information about competitors';

const DEFAULT_MAX_CHARS = 120_000;

/**
 * @param {string} name
 */
export function isDosAndDontsSectionName(name) {
  // Matches "Dos and Don'ts", "Dos and Dont's", "Dos and Donts", etc.
  return /^dos and don[''’]?t[''’]?s$/i.test(String(name || '').trim());
}

/**
 * @param {{
 *   promptVersion?: string,
 *   url: string,
 *   companyName: string,
 *   sourceHash: string,
 *   schemaKey?: string,
 * }} opts
 */
export function computeBrandkitInputHash(opts) {
  const promptVersion = opts.promptVersion || BRANDKIT_PROMPT_VERSION;
  const schemaKey = opts.schemaKey || 'default-sections';
  return sha256Hex(
    `${promptVersion}\n${opts.url}\n${opts.companyName}\n${opts.sourceHash}\n${schemaKey}`,
  );
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveBrandkitMaxChars(env = process.env) {
  const raw = env.BQ_BRANDKIT_MAX_CHARS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const designRaw = env.AZURE_AI_DESIGN_MAX_CHARS?.trim();
  if (designRaw) {
    const n = Number(designRaw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return DEFAULT_MAX_CHARS;
}

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

/**
 * Prefer homepage capture dir under host, else fall back to pageDir.
 * @param {string} hostProjectRoot
 * @param {string} [pageDir]
 */
export async function resolveBrandkitPageDir(hostProjectRoot, pageDir) {
  try {
    const names = await readdir(hostProjectRoot, { withFileTypes: true });
    const dirs = names
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => n.includes('--'));
    const home = dirs.find((n) => /--home$/i.test(n));
    if (home) return path.join(hostProjectRoot, home);
  } catch {
    /* ignore */
  }
  return pageDir || hostProjectRoot;
}

/**
 * @param {string} pageDir
 * @param {string} hostProjectRoot
 * @param {number} maxChars
 */
async function assembleBrandkitEvidence(pageDir, hostProjectRoot, maxChars) {
  const prev = process.env.AZURE_AI_DESIGN_MAX_CHARS;
  process.env.AZURE_AI_DESIGN_MAX_CHARS = String(maxChars);
  let assembled;
  try {
    assembled = await assemblePagePayload(pageDir);
  } finally {
    if (prev === undefined) delete process.env.AZURE_AI_DESIGN_MAX_CHARS;
    else process.env.AZURE_AI_DESIGN_MAX_CHARS = prev;
  }

  const extras = [];
  let used = assembled.usedChars || 0;

  const pushExtra = async (label, filePath) => {
    try {
      const text = await readFile(filePath, 'utf8');
      if (!text.trim()) return;
      const header = `\n\n===== ${label} =====\n`;
      const room = maxChars - used - header.length;
      if (room <= 0) return;
      const body = text.length > room ? `${text.slice(0, room)}\n/* …truncated */\n` : text;
      extras.push(`${header}${body}`);
      used += header.length + body.length;
    } catch {
      /* optional */
    }
  };

  await pushExtra(
    'ai-website-design.md',
    path.join(hostProjectRoot, 'ai-website-design.md'),
  );
  await pushExtra(
    'ai-derived-design.md',
    path.join(pageDir, 'ai-derived-design.md'),
  );
  await pushExtra(
    'site-summary.json',
    path.join(hostProjectRoot, 'site-summary.json'),
  );

  const payload = `${assembled.payload || ''}${extras.join('')}`;
  return {
    payload,
    sourceHash: sha256Hex(payload),
    usedChars: used,
    included: assembled.included,
    skipped: assembled.skipped,
  };
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Normalize AI draft into { brandName, industry, description, sections }.
 * @param {unknown} raw
 */
export function normalizeBrandkitDraft(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const sectionsIn =
    obj.sections && typeof obj.sections === 'object' ? obj.sections : {};
  /** @type {Record<string, Record<string, string>>} */
  const sections = {};
  for (const [secName, fields] of Object.entries(sectionsIn)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    /** @type {Record<string, string>} */
    const mapped = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      if (value == null) continue;
      const text =
        typeof value === 'string'
          ? value.trim()
          : Array.isArray(value)
            ? value.map((v) => String(v)).join('\n')
            : String(value).trim();
      if (text) mapped[fieldName] = text;
    }
    if (Object.keys(mapped).length) sections[secName] = mapped;
  }
  return {
    brandName: String(obj.brandName || obj.companyName || '').trim() || null,
    companyName: String(obj.companyName || '').trim() || null,
    industry: String(obj.industry || '').trim() || null,
    description: String(obj.description || '').trim() || null,
    sections,
  };
}

/**
 * Ensure Dos and Don'ts has dedicated Extensions + Restrictions subsections
 * with the exact Stream #Extend# / #Restrict# rules (does not alter AI prose).
 * @param {object} draft
 * @returns {{ draft: object, changed: boolean }}
 */
export function ensureMandatoryDosAndDontsRules(draft) {
  const next = {
    ...(draft && typeof draft === 'object' ? draft : {}),
    sections: {
      ...((draft?.sections && typeof draft.sections === 'object'
        ? draft.sections
        : {}) ||
        {}),
    },
  };

  /** @type {Record<string, Record<string, string>>} */
  const sections = { ...next.sections };
  let secKey = Object.keys(sections).find((k) => isDosAndDontsSectionName(k));
  if (!secKey) {
    secKey = "Dos and Don'ts";
    sections[secKey] = {};
  }

  const fields = { ...(sections[secKey] || {}) };
  let changed = false;

  if (fields[DOS_DONT_EXTENSIONS_FIELD] !== MANDATORY_DOS_DONT_EXTENSION) {
    fields[DOS_DONT_EXTENSIONS_FIELD] = MANDATORY_DOS_DONT_EXTENSION;
    changed = true;
  }
  if (fields[DOS_DONT_RESTRICTIONS_FIELD] !== MANDATORY_DOS_DONT_RESTRICTION) {
    fields[DOS_DONT_RESTRICTIONS_FIELD] = MANDATORY_DOS_DONT_RESTRICTION;
    changed = true;
  }

  sections[secKey] = fields;
  next.sections = sections;
  return { draft: next, changed };
}

/**
 * Look up draft value for a remote section/field (case-insensitive names).
 * @param {object} draft
 * @param {string} sectionName
 * @param {string} fieldName
 */
export function lookupDraftFieldValue(draft, sectionName, fieldName) {
  const sections = draft?.sections || {};
  const secKey = Object.keys(sections).find(
    (k) => k.toLowerCase() === String(sectionName || '').toLowerCase(),
  );
  if (!secKey) return null;
  const fields = sections[secKey] || {};
  const fieldKey = Object.keys(fields).find(
    (k) => k.toLowerCase() === String(fieldName || '').toLowerCase(),
  );
  if (!fieldKey) return null;
  const value = fields[fieldKey];
  return value != null && String(value).trim() ? String(value).trim() : null;
}

/**
 * @param {Record<string, string[]>|null|undefined} schema
 */
function schemaPromptBlock(schema) {
  if (!schema || !Object.keys(schema).length) {
    return [
      'Use these section names exactly when relevant:',
      ...DEFAULT_BRANDKIT_SECTIONS.map((s) => `- ${s}`),
      'Invent sensible subsection names under each section (e.g. Brand purpose, Brand values).',
    ].join('\n');
  }
  const lines = ['Use these EXACT section and field names (do not invent other keys):'];
  for (const [sec, fields] of Object.entries(schema)) {
    lines.push(`- ${sec}:`);
    for (const f of fields) lines.push(`  - ${f}`);
  }
  return lines.join('\n');
}

/**
 * @param {{
 *   url: string,
 *   companyName: string,
 *   hostProjectRoot: string,
 *   pageDir?: string,
 *   force?: boolean,
 *   dryRun?: boolean,
 *   ledger?: { record: (entry: object) => unknown },
 *   env?: NodeJS.ProcessEnv,
 *   schema?: Record<string, string[]>|null,
 * }} opts
 */
export async function generateBrandkitDraft(opts) {
  const env = opts.env || process.env;
  const maxChars = resolveBrandkitMaxChars(env);
  const pageDir = await resolveBrandkitPageDir(
    opts.hostProjectRoot,
    opts.pageDir,
  );
  const evidence = await assembleBrandkitEvidence(
    pageDir,
    opts.hostProjectRoot,
    maxChars,
  );

  const schemaKey = opts.schema
    ? sha256Hex(JSON.stringify(opts.schema))
    : 'default-sections';
  const inputHash = computeBrandkitInputHash({
    url: opts.url,
    companyName: opts.companyName,
    sourceHash: evidence.sourceHash,
    schemaKey,
  });

  const existing = await readBrandkitDraft(opts.hostProjectRoot);
  if (
    !opts.force &&
    existing?.inputHash === inputHash &&
    existing?.sections &&
    typeof existing.sections === 'object'
  ) {
    const ensured = ensureMandatoryDosAndDontsRules(existing);
    if (ensured.changed) {
      await writeBrandkitDraft(opts.hostProjectRoot, ensured.draft);
      opts.ledger?.record?.({
        purpose: 'brandkit-generate',
        ok: true,
        skipReason:
          'draft cache hit; injected Extensions/Restrictions (force overwrite)',
        model: existing.model || null,
      });
      return {
        ok: true,
        reused: false,
        draft: ensured.draft,
        inputHash,
        pageDir,
      };
    }
    opts.ledger?.record?.({
      purpose: 'brandkit-generate',
      ok: true,
      skipReason: 'draft cache hit (inputHash match)',
      model: existing.model || null,
    });
    return {
      ok: true,
      reused: true,
      draft: ensured.draft,
      inputHash,
      pageDir,
    };
  }

  const azure = resolveAzureChatConfig();
  if (!azure.ok) {
    opts.ledger?.record?.({
      purpose: 'brandkit-generate',
      ok: false,
      skipReason: azure.skipReason,
    });
    return { ok: false, skipReason: azure.skipReason, inputHash, pageDir };
  }

  if (opts.dryRun) {
    console.log('  [dry-run] would call Azure for brandkit draft');
    return {
      ok: true,
      dryRun: true,
      draft: existing || {
        brandName: opts.companyName,
        sections: {},
        inputHash,
      },
      inputHash,
      pageDir,
    };
  }

  const system = [
    'You are a brand strategist producing Sitecore Stream brand-kit section content.',
    'Return ONLY valid JSON (no markdown fences) with this shape:',
    '{',
    '  "brandName": string,',
    '  "companyName": string,',
    '  "industry": string,',
    '  "description": string,',
    '  "sections": {',
    '    "<Section Name>": { "<Field / guideline name>": "text value", ... },',
    '    ...',
    '  }',
    '}',
    schemaPromptBlock(opts.schema),
    'Ground claims in the provided website URL, company name, and captured HTML/CSS/design artifacts.',
    'Do not invent unrelated products.',
    'Each field value MUST be substantive brand-guideline prose: about 5–10 lines',
    '(roughly 5–10 sentences or short paragraphs). Use newline characters inside strings',
    'to separate lines. Avoid one-liners; expand with concrete do/don\'t guidance,',
    'examples, and voice/visual rules grounded in the artifacts.',
  ].join('\n');

  const userParts = [
    `Website URL: ${opts.url}`,
    `Company / brand: ${opts.companyName}`,
    '',
    'Captured site artifacts (HTML/CSS/design):',
    evidence.payload || '(no artifacts on disk)',
  ];

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n') },
    ],
    responseFormat: { type: 'json_object' },
  });

  if (!result.ok) {
    opts.ledger?.record?.({
      purpose: 'brandkit-generate',
      ok: false,
      skipReason: result.skipReason,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
    });
    return {
      ok: false,
      skipReason: result.skipReason,
      inputHash,
      pageDir,
    };
  }

  opts.ledger?.record?.({
    purpose: 'brandkit-generate',
    ok: true,
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
  });

  const parsed = extractJsonObject(result.content);
  if (!parsed) {
    return {
      ok: false,
      skipReason: 'brandkit AI response was not valid JSON',
      inputHash,
      pageDir,
      raw: result.content?.slice?.(0, 400),
    };
  }

  const normalized = normalizeBrandkitDraft(parsed);
  const { draft: withRules } = ensureMandatoryDosAndDontsRules(normalized);
  const draft = {
    ...withRules,
    promptVersion: BRANDKIT_PROMPT_VERSION,
    inputHash,
    sourceHash: evidence.sourceHash,
    model: result.model,
    url: opts.url,
    companyNameHint: opts.companyName,
    pageDir: path.relative(opts.hostProjectRoot, pageDir),
    usage: result.usage,
    costEstimate: result.costEstimate,
  };

  await writeBrandkitDraft(opts.hostProjectRoot, draft);
  return { ok: true, reused: false, draft, inputHash, pageDir };
}
