/**
 * Surgical visual-fidelity repair: edit PREVIOUS TSX/client/definition from
 * score directives — not a full first-pass codegen rewrite.
 */
import path from 'node:path';
import { azureChatCompletion } from '../../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../../capture/paths.mjs';
import { writeAiDebugDump } from '../ai-debug-dump.mjs';
import { screenshotConversionModel } from '../ai-codegen.mjs';
import { resolveVisualFidelityViewportKeys } from './viewports.mjs';

function repairModel() {
  loadLocalEnvFiles({ root: bqRoot });
  const m = (process.env.AZURE_OPENAI_SOURCE_FIDELITY_MODEL || '').trim();
  return m || screenshotConversionModel();
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('empty visual-fidelity repair response');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : text;
  return JSON.parse(raw);
}

async function imagePart(filePath, label) {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(filePath);
  const b64 = buf.toString('base64');
  return [
    { type: 'text', text: label },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${b64}` },
    },
  ];
}

/**
 * @param {{
 *   componentName: string,
 *   minScore: number,
 *   iteration: number,
 *   changes: string[],
 *   preserve?: string[],
 *   previousTsx: string,
 *   previousClientTsx?: string|null,
 *   previousDefinitionTs: string,
 *   captureResults?: Record<string, { candidatePath?: string, referencePath?: string }>,
 *   ledger?: object|null,
 *   sectionFolder?: string|null,
 *   aiDebugRoot?: string|null,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   tsx: string|null,
 *   clientTsx: string|null,
 *   definitionTs: string|null,
 *   notes: string,
 *   skipReason?: string,
 * }>}
 */
export async function repairVisualFidelityPackage(opts) {
  const {
    componentName,
    minScore,
    iteration,
    changes = [],
    preserve = [],
    previousTsx,
    previousClientTsx = null,
    previousDefinitionTs,
    captureResults = {},
    ledger = null,
    sectionFolder = null,
    aiDebugRoot = null,
  } = opts;

  const changeList = (Array.isArray(changes) ? changes : []).map(String).filter(Boolean);
  const preserveList = (Array.isArray(preserve) ? preserve : []).map(String).filter(Boolean);

  /** @type {object[]} */
  const userContent = [
    {
      type: 'text',
      text: [
        'You are a visual-fidelity REPAIR agent for Sitecore Content SDK Next.js components.',
        'Start from PREVIOUS TSX / CLIENT / DEFINITION. Apply ONLY the listed directives.',
        'Layout-first: prefer Tailwind/className/breakpoint/client tweaks. Do not invent Sitecore fields.',
        'Keep repairs as valid JSX: always className="…"; never introduce font-[\\"…\\"], className=\'…\', or font-[\\\'…\\\']; use font-[\'Family\'] inside double-quoted className.',
        'Keep Text/RichText/Image/Link, getDatasource/getFieldValue, ComponentWithContextProps.',
        'Honor preserve[] — do not destroy working composition, field wiring, or chrome structure.',
        'Do not re-architecture sticky-chrome / field graphs unless a MUST explicitly requires it.',
        '',
        'DEFINITION ↔ TSX SYNC (hard):',
        '- If fields/seeds are unchanged, set definitionTs to null (reuse on-disk definition).',
        '- If you add/rename/remove a field in tsx, return full updated definitionTs (model + content.items) in lockstep.',
        '- Prefer wiring existing definition fields over inventing new ones.',
        '',
        `Component: ${componentName}`,
        `Target score ≥ ${minScore}. Repair iteration ${iteration}.`,
        '',
        'Return JSON only:',
        '{',
        '  "tsx": "full updated multiline TSX",',
        '  "clientTsx": "full updated client TSX or null if unchanged/absent",',
        '  "definitionTs": "full updated definition TS or null if unchanged",',
        '  "notes": "…"',
        '}',
        '',
        '=== PRESERVE (already correct — do not regress) ===',
        preserveList.length
          ? preserveList.map((p, i) => `${i + 1}. ${p}`).join('\n')
          : '(none listed)',
        '',
        '=== DIRECTIVES (apply these only) ===',
        changeList.length
          ? changeList.map((c, i) => `${i + 1}. ${c}`).join('\n')
          : '(no directives — return previous sources unchanged with definitionTs:null)',
        '',
        '=== PREVIOUS DEFINITION TS ===',
        String(previousDefinitionTs || '').slice(0, 50000),
        '',
        '=== PREVIOUS TSX ===',
        String(previousTsx || '').slice(0, 60000),
        previousClientTsx
          ? `\n=== PREVIOUS CLIENT TSX ===\n${String(previousClientTsx).slice(0, 20000)}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  /** @type {string[]} */
  const imageRelsInOrder = [];
  /** @type {string[]} */
  const attachments = [];

  for (const vp of resolveVisualFidelityViewportKeys()) {
    const r = captureResults[vp];
    if (!r) continue;
    if (r.referencePath) {
      try {
        userContent.push(...(await imagePart(r.referencePath, `REFERENCE ${vp}:`)));
        imageRelsInOrder.push(String(r.referencePath).replace(/\\/g, '/'));
        attachments.push(r.referencePath);
      } catch {
        /* missing */
      }
    }
    if (r.candidatePath) {
      try {
        userContent.push(...(await imagePart(r.candidatePath, `RENDERED CANDIDATE ${vp}:`)));
        imageRelsInOrder.push(String(r.candidatePath).replace(/\\/g, '/'));
        attachments.push(r.candidatePath);
      } catch {
        /* missing */
      }
    }
  }

  const messages = [
    {
      role: 'system',
      content:
        'You surgically repair Sitecore Content SDK TSX for visual fidelity. Preserve field wiring and definition sync. Return JSON only with complete multiline tsx/clientTsx; definitionTs null when unchanged.',
    },
    { role: 'user', content: userContent },
  ];

  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: repairModel(),
  });

  if (ledger?.record) {
    ledger.record({
      purpose: 'visual-fidelity-repair',
      fidelityMode: 'visual',
      iteration,
      section: sectionFolder,
      componentName,
      ok: result.ok,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
      skipReason: result.skipReason,
    });
  }

  const debugRoot = String(aiDebugRoot || '').trim();
  if (debugRoot) {
    await writeAiDebugDump({
      aiDebugRoot: debugRoot,
      purpose: 'visual-fidelity-repair',
      componentName,
      iteration,
      sectionFolder: sectionFolder || undefined,
      messages,
      result,
      attachments: attachments.map((p) => path.relative(bqRoot, p).replace(/\\/g, '/')),
      imageRelsInOrder: imageRelsInOrder.map((p) => {
        try {
          return path.relative(bqRoot, p).replace(/\\/g, '/');
        } catch {
          return p;
        }
      }),
      clearBeforeWrite: false,
    });
  }

  if (!result.ok) {
    return {
      ok: false,
      tsx: null,
      clientTsx: null,
      definitionTs: null,
      notes: result.skipReason || 'repair failed',
      skipReason: result.skipReason || 'repair failed',
    };
  }

  try {
    const parsed = parseJsonContent(result.content);
    const tsx =
      parsed.tsx != null && String(parsed.tsx).trim()
        ? String(parsed.tsx)
        : String(previousTsx || '');
    let clientTsx = previousClientTsx;
    if (parsed.clientTsx === null) {
      clientTsx = previousClientTsx;
    } else if (parsed.clientTsx != null && String(parsed.clientTsx).trim()) {
      clientTsx = String(parsed.clientTsx);
    }
    let definitionTs = null;
    if (parsed.definitionTs != null && String(parsed.definitionTs).trim()) {
      definitionTs = String(parsed.definitionTs);
    }
    return {
      ok: true,
      tsx,
      clientTsx,
      definitionTs,
      notes: String(parsed.notes || ''),
    };
  } catch (err) {
    return {
      ok: false,
      tsx: null,
      clientTsx: null,
      definitionTs: null,
      notes: err.message,
      skipReason: `parse error: ${err.message}`,
    };
  }
}

/**
 * Surgical repair for plain visual TSX (pre-Sitecoreize). No CMS / definition language.
 *
 * @param {{
 *   componentName: string,
 *   minScore: number,
 *   iteration: number,
 *   changes: string[],
 *   preserve?: string[],
 *   previousTsx: string,
 *   captureResults?: Record<string, { candidatePath?: string, referencePath?: string }>,
 *   ledger?: object|null,
 *   sectionFolder?: string|null,
 *   aiDebugRoot?: string|null,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   tsx: string|null,
 *   notes: string,
 *   skipReason?: string,
 * }>}
 */
export async function repairVisualTsxFromDirectives(opts) {
  const {
    componentName,
    minScore,
    iteration,
    changes = [],
    preserve = [],
    previousTsx,
    captureResults = {},
    ledger = null,
    sectionFolder = null,
    aiDebugRoot = null,
  } = opts;

  const changeList = (Array.isArray(changes) ? changes : []).map(String).filter(Boolean);
  const preserveList = (Array.isArray(preserve) ? preserve : []).map(String).filter(Boolean);

  /** @type {object[]} */
  const userContent = [
    {
      type: 'text',
      text: [
        'You are a visual-fidelity REPAIR agent for plain React/Tailwind visual TSX (pre-Sitecoreize).',
        'Start from PREVIOUS TSX. Apply ONLY the listed directives.',
        'Layout-first: prefer className, spacing, breakpoints, structure, media/CTA presence — Tailwind utilities.',
        'Keep repairs as valid JSX: always className="…"; never introduce font-[\\"…\\"], className=\'…\', or font-[\\\'…\\\']; use font-[\'Family\'] inside double-quoted className.',
        'Honor preserve[] — do not destroy working composition or chrome structure.',
        'Do not invent CMS fields, definitions, or content-SDK components.',
        'Do not re-architecture the whole section unless a MUST explicitly requires it.',
        '',
        `Component: ${componentName}`,
        `Target score ≥ ${minScore}. Repair iteration ${iteration}.`,
        '',
        'Return JSON only:',
        '{',
        '  "tsx": "full updated multiline TSX",',
        '  "notes": "…"',
        '}',
        '',
        '=== PRESERVE (already correct — do not regress) ===',
        preserveList.length
          ? preserveList.map((p, i) => `${i + 1}. ${p}`).join('\n')
          : '(none listed)',
        '',
        '=== DIRECTIVES (apply these only) ===',
        changeList.length
          ? changeList.map((c, i) => `${i + 1}. ${c}`).join('\n')
          : '(no directives — return previous TSX unchanged)',
        '',
        '=== PREVIOUS TSX ===',
        String(previousTsx || '').slice(0, 60000),
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  /** @type {string[]} */
  const imageRelsInOrder = [];
  /** @type {string[]} */
  const attachments = [];

  for (const vp of resolveVisualFidelityViewportKeys()) {
    const r = captureResults[vp];
    if (!r) continue;
    if (r.referencePath) {
      try {
        userContent.push(...(await imagePart(r.referencePath, `REFERENCE ${vp}:`)));
        imageRelsInOrder.push(String(r.referencePath).replace(/\\/g, '/'));
        attachments.push(r.referencePath);
      } catch {
        /* missing */
      }
    }
    if (r.candidatePath) {
      try {
        userContent.push(...(await imagePart(r.candidatePath, `RENDERED CANDIDATE ${vp}:`)));
        imageRelsInOrder.push(String(r.candidatePath).replace(/\\/g, '/'));
        attachments.push(r.candidatePath);
      } catch {
        /* missing */
      }
    }
  }

  const messages = [
    {
      role: 'system',
      content:
        'You surgically repair plain React/Tailwind visual TSX for layout fidelity. No CMS/field language. Return JSON only with complete multiline tsx.',
    },
    { role: 'user', content: userContent },
  ];

  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: repairModel(),
  });

  if (ledger?.record) {
    ledger.record({
      purpose: 'visual-fidelity-repair',
      fidelityMode: 'visual',
      iteration,
      section: sectionFolder,
      componentName,
      ok: result.ok,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
      skipReason: result.skipReason,
    });
  }

  const debugRoot = String(aiDebugRoot || '').trim();
  if (debugRoot) {
    await writeAiDebugDump({
      aiDebugRoot: debugRoot,
      purpose: 'visual-fidelity-repair',
      componentName,
      iteration,
      sectionFolder: sectionFolder || undefined,
      messages,
      result,
      attachments: attachments.map((p) => path.relative(bqRoot, p).replace(/\\/g, '/')),
      imageRelsInOrder: imageRelsInOrder.map((p) => {
        try {
          return path.relative(bqRoot, p).replace(/\\/g, '/');
        } catch {
          return p;
        }
      }),
      clearBeforeWrite: false,
    });
  }

  if (!result.ok) {
    return {
      ok: false,
      tsx: null,
      notes: result.skipReason || 'repair failed',
      skipReason: result.skipReason || 'repair failed',
    };
  }

  try {
    const parsed = parseJsonContent(result.content);
    const tsx =
      parsed.tsx != null && String(parsed.tsx).trim()
        ? String(parsed.tsx)
        : String(previousTsx || '');
    return {
      ok: true,
      tsx,
      notes: String(parsed.notes || ''),
    };
  } catch (err) {
    return {
      ok: false,
      tsx: null,
      notes: err.message,
      skipReason: `parse error: ${err.message}`,
    };
  }
}
