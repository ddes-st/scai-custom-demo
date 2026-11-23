/**
 * Pre-sitecoreize visual fidelity: one AI call compares reference vs candidate
 * screenshots with current plain visual TSX and returns score + repaired TSX.
 * No Sitecore / CMS / field language.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { azureChatCompletion } from '../../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../../capture/paths.mjs';
import { writeAiDebugDump } from '../ai-debug-dump.mjs';
import { screenshotConversionModel } from '../ai-codegen.mjs';
import { resolveVisualFidelityViewportKeys } from './viewports.mjs';

/** Ledger / debug purpose for the one-shot compare+regenerate call. */
export const VISUAL_FIDELITY_REGENERATE_PURPOSE = 'visual-fidelity-regenerate';

function fidelityModel() {
  loadLocalEnvFiles({ root: bqRoot });
  const m = (process.env.AZURE_OPENAI_SOURCE_FIDELITY_MODEL || '').trim();
  return m || screenshotConversionModel();
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('empty visual-fidelity regenerate response');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : text;
  return JSON.parse(raw);
}

async function imagePart(filePath, label) {
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
 * Compare crops to candidates with current visual TSX; when failing, return a full
 * repaired TSX aimed at closest match in one edit.
 *
 * @param {{
 *   componentName: string,
 *   minScore: number,
 *   visualTsx: string,
 *   captureResults: Record<string, { candidatePath?: string, referencePath?: string }>,
 *   ledger?: object|null,
 *   sectionFolder?: string|null,
 *   iteration?: number,
 *   aiDebugRoot?: string|null,
 * }} opts
 * @returns {Promise<{
 *   score: number,
 *   pass: boolean,
 *   preserve: string[],
 *   issues: string[],
 *   changes: string[],
 *   notes: string,
 *   tsx: string|null,
 * }>}
 */
export async function scoreAndRegenerateVisualTsx(opts) {
  const {
    componentName,
    minScore,
    visualTsx,
    captureResults = {},
    ledger = null,
    sectionFolder = null,
    iteration = 1,
    aiDebugRoot = null,
  } = opts;

  const previousTsx = String(visualTsx || '');

  /** @type {object[]} */
  const userContent = [
    {
      type: 'text',
      text: [
        'You are a visual-fidelity agent for plain React/Tailwind visual TSX (pre-Sitecoreize).',
        'Compare RENDERED candidate screenshots to REFERENCE capture crops, then get as close as possible in ONE TSX edit.',
        `Viewports: ${resolveVisualFidelityViewportKeys().join(', ')} (teacher viewport widths).`,
        '',
        'Score priorities (highest → lowest):',
        '1) LAYOUT — band starts/ends, column ratios, grids/stacks, gaps, padding, alignment, media framing, card density.',
        '2) COLOR / surfaces — backgrounds, accents, borders that change the composition reading.',
        '3) TYPE HIERARCHY — heading vs body vs caption weight/role (bold/medium/regular; larger vs smaller).',
        'Do NOT fail or burn edits on exact font-family glyph match, 1–2px size drift, or letter-spacing noise —',
        'preview fonts often differ from the live site. Typography issues only when hierarchy is clearly wrong',
        '(body sized like a display heading, or heading looking like muted caption).',
        'Content/CTAs/media present is necessary but NOT sufficient — score remaining LAYOUT distance first.',
        'Do not excuse layout differences Tailwind can fix. No CMS fields, definitions, or content-SDK components.',
        '',
        `Component: ${componentName}`,
        `Pass when score ≥ ${minScore}.`,
        `Iteration ${iteration}.`,
        '',
        'Return JSON only:',
        '{',
        '  "score": 0-100,',
        '  "pass": true|false,',
        '  "preserve": ["what already matches — do not regress"],',
        '  "issues": ["visible gaps vs reference — layout first"],',
        '  "changes": ["short summary of edits applied in tsx, if any"],',
        '  "notes": "…",',
        '  "tsx": "full updated multiline TSX when score < threshold; omit or null when pass"',
        '}',
        '',
        'When score < threshold:',
        '- List what already matches in preserve[].',
        '- Return a COMPLETE updated tsx that surgically improves LAYOUT toward the reference first.',
        '- Prefer Tailwind className changes (padding, gap, grid, flex basis, max-w, breakpoints); type only if hierarchy is wrong.',
        '- Prefer scale utilities (text-sm/base/lg/xl/2xl/3xl, font-medium/semibold/bold) over chasing text-[Npx].',
        '- Keep repairs as valid JSX: always className="…"; never introduce font-[\\"…\\"], className=\'…\', or font-[\\\'…\\\']; use font-[\'Family\'] / font-[\'Family\',sans-serif] inside double-quoted className.',
        '- Pack related responsive fixes into the same edit; do not reinvent working structure listed in preserve.',
        '- Honor preserve[] — do not destroy composition that already matches.',
        'When score ≥ threshold: pass:true, tsx:null, changes:[].',
        '',
        '=== CURRENT VISUAL TSX ===',
        previousTsx.slice(0, 60000),
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
        'You compare plain React/Tailwind screenshots to capture crops and, when below threshold, return a full repaired visual TSX in the same JSON response. Maximize visual closeness in one edit. No CMS/field language. JSON only.',
    },
    { role: 'user', content: userContent },
  ];

  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: fidelityModel(),
  });

  if (ledger?.record) {
    ledger.record({
      purpose: VISUAL_FIDELITY_REGENERATE_PURPOSE,
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
    const rel = (p) => {
      try {
        return path.relative(bqRoot, p).replace(/\\/g, '/');
      } catch {
        return String(p).replace(/\\/g, '/');
      }
    };
    await writeAiDebugDump({
      aiDebugRoot: debugRoot,
      purpose: VISUAL_FIDELITY_REGENERATE_PURPOSE,
      componentName,
      iteration,
      sectionFolder: sectionFolder || undefined,
      messages,
      result,
      attachments: attachments.map(rel),
      imageRelsInOrder: imageRelsInOrder.map(rel),
      clearBeforeWrite: false,
    });
  }

  if (!result.ok) {
    return {
      score: 0,
      pass: false,
      preserve: [],
      issues: [result.skipReason || 'regenerate failed'],
      changes: [],
      notes: result.skipReason || 'error',
      tsx: null,
    };
  }

  try {
    const parsed = parseJsonContent(result.content);
    const score = Number(parsed.score);
    const preserve = Array.isArray(parsed.preserve)
      ? parsed.preserve.map(String).filter(Boolean)
      : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String) : [];
    const changes = Array.isArray(parsed.changes)
      ? parsed.changes.map(String).filter(Boolean)
      : [];
    const pass =
      parsed.pass === true || (Number.isFinite(score) && score >= minScore);

    let tsx = null;
    if (!pass && parsed.tsx != null && String(parsed.tsx).trim()) {
      tsx = String(parsed.tsx);
    }

    return {
      score: Number.isFinite(score) ? score : 0,
      pass,
      preserve,
      issues,
      changes,
      notes: String(parsed.notes || ''),
      tsx,
    };
  } catch (err) {
    return {
      score: 0,
      pass: false,
      preserve: [],
      issues: [err.message],
      changes: [],
      notes: 'parse error',
      tsx: null,
    };
  }
}
