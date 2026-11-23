/**
 * Perceptual score of rendered shots vs capture crops; emit surgical repair directives.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { azureChatCompletion } from '../../capture/lib/design-system/ai/azure-chat.mjs';
import { loadLocalEnvFiles } from '../../capture/lib/design-system/load-env.mjs';
import { bqRoot } from '../../capture/paths.mjs';
import { writeAiDebugDump } from '../ai-debug-dump.mjs';
import { screenshotConversionModel } from '../ai-codegen.mjs';
import { resolveVisualFidelityViewportKeys } from './viewports.mjs';

/** Max directives passed to surgical repair (highest impact first). */
export const VISUAL_FIDELITY_MAX_CHANGES = 5;

function fidelityScoreModel() {
  loadLocalEnvFiles({ root: bqRoot });
  const m = (process.env.AZURE_OPENAI_SOURCE_FIDELITY_MODEL || '').trim();
  return m || screenshotConversionModel();
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('empty visual-fidelity score response');
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
 * Cap and normalize changes[]; keep preserve[].
 * @param {string[]} changes
 * @param {number} [max]
 */
export function capVisualFidelityChanges(changes, max = VISUAL_FIDELITY_MAX_CHANGES) {
  const list = (Array.isArray(changes) ? changes : [])
    .filter((c) => c != null && String(c).trim() !== '')
    .map(String);
  const n = Math.max(1, Math.trunc(Number(max)) || VISUAL_FIDELITY_MAX_CHANGES);
  return list.slice(0, n);
}

/**
 * Score rendered shots vs crops and emit surgical directives (no TSX rewrite).
 * Used by post-write Sitecore package fidelity. Pre-sitecoreize visual TSX uses
 * scoreAndRegenerateVisualTsx (one-call compare + regenerate) instead.
 *
 * @param {{
 *   componentName: string,
 *   minScore: number,
 *   tsx: string,
 *   clientTsx?: string|null,
 *   captureResults: Record<string, { candidatePath: string, referencePath: string }>,
 *   ledger?: object,
 *   sectionFolder?: string,
 *   iteration?: number,
 *   aiDebugRoot?: string|null,
 *   mode?: string,
 * }} opts
 */
export async function scoreRenderedAgainstRefs(opts) {
  const {
    componentName,
    minScore,
    tsx,
    clientTsx = null,
    captureResults,
    ledger = null,
    sectionFolder = null,
    iteration = 1,
    aiDebugRoot = null,
  } = opts;

  /** @type {object[]} */
  const userContent = [
    {
      type: 'text',
      text: [
        'You are a visual-fidelity QA agent. Compare RENDERED candidate screenshots to REFERENCE capture crops.',
        `Viewports in this run: ${resolveVisualFidelityViewportKeys().join(', ')} (teacher viewport widths).`,
        'Pass criteria: perceptual match — everything in the crop must be present; composition must look like the original.',
        'Ignore minor left/right text drift. Missing blocks, empty placeholders, wrong stacking, missing CTAs/media = fail.',
        `Component: ${componentName}`,
        `Pass when score ≥ ${minScore}.`,
        `Iteration ${iteration}.`,
        '',
        'Return JSON only:',
        '{',
        '  "score": 0-100,',
        '  "pass": true|false,',
        '  "preserve": ["what already matches — do not regress"],',
        '  "issues": ["…"],',
        '  "changes": ["MUST …", "MUST …"],',
        '  "notes": "…"',
        '}',
        'When score < threshold:',
        `- List what ALREADY matches in preserve[] (blocks, CTAs, media, field wiring, chrome).`,
        `- Put at most ${VISUAL_FIDELITY_MAX_CHANGES} highest-impact gaps into changes[] as actionable repair directives.`,
        '- Prefer relative Tailwind guidance (padding, gap, max-w, breakpoint classes).',
        '- Avoid absolute pixel y/x coordinates unless essential.',
        '- Prefer "wire existing field X" over "add a new field Y" when the component already has the field.',
        '- A surgical repair will EDIT the PREVIOUS TSX from changes[] — do not ask to reinvent working structure.',
        'Do NOT return rewritten TSX.',
        'If already ≥ threshold, pass:true, preserve:[…], changes:[].',
        '',
        '=== CURRENT TSX (context only) ===',
        tsx.slice(0, 40000),
        clientTsx ? `\n=== CLIENT TSX ===\n${String(clientTsx).slice(0, 12000)}` : '',
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
    try {
      userContent.push(...(await imagePart(r.referencePath, `REFERENCE ${vp}:`)));
      imageRelsInOrder.push(String(r.referencePath).replace(/\\/g, '/'));
      attachments.push(r.referencePath);
    } catch {
      /* missing ref */
    }
    try {
      userContent.push(...(await imagePart(r.candidatePath, `RENDERED CANDIDATE ${vp}:`)));
      imageRelsInOrder.push(String(r.candidatePath).replace(/\\/g, '/'));
      attachments.push(r.candidatePath);
    } catch {
      /* missing candidate */
    }
  }

  const messages = [
    {
      role: 'system',
      content:
        'You score rendered Sitecore component screenshots against capture crops and emit a short preserve[] plus at most 5 surgical change directives. JSON only. Do not rewrite TSX.',
    },
    { role: 'user', content: userContent },
  ];

  const result = await azureChatCompletion({
    messages,
    responseFormat: { type: 'json_object' },
    model: fidelityScoreModel(),
  });

  if (ledger?.record) {
    ledger.record({
      purpose: 'visual-fidelity-score',
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
      purpose: 'visual-fidelity-score',
      componentName,
      iteration,
      sectionFolder: sectionFolder || undefined,
      messages,
      result,
      attachments: attachments.map(rel),
      imageRelsInOrder: imageRelsInOrder.map(rel),
      clearBeforeWrite: true,
    });
  }

  if (!result.ok) {
    return {
      score: 0,
      pass: false,
      preserve: [],
      changes: ['Visual fidelity score call failed — repair layout fidelity vs screenshots.'],
      issues: [result.skipReason || 'score failed'],
      notes: result.skipReason || 'error',
    };
  }

  try {
    const parsed = parseJsonContent(result.content);
    const score = Number(parsed.score);
    const preserve = Array.isArray(parsed.preserve)
      ? parsed.preserve.map(String).filter(Boolean)
      : [];
    const rawChanges = Array.isArray(parsed.changes)
      ? parsed.changes.map(String)
      : [];
    const issues = Array.isArray(parsed.issues) ? parsed.issues.map(String) : [];
    const pass =
      parsed.pass === true || (Number.isFinite(score) && score >= minScore);
    const changes = pass
      ? []
      : capVisualFidelityChanges(rawChanges.length ? rawChanges : issues);
    return {
      score: Number.isFinite(score) ? score : 0,
      pass,
      preserve,
      changes,
      issues,
      notes: String(parsed.notes || ''),
    };
  } catch (err) {
    return {
      score: 0,
      pass: false,
      preserve: [],
      changes: ['Fix layout to match capture screenshots (score JSON parse failed).'],
      issues: [err.message],
      notes: 'parse error',
    };
  }
}
