/**
 * Opt-in AI role classifier for ambiguous design tokens.
 * Never invents hex/spacing/font values — only assigns roles to existing candidates.
 * Auth: CURSOR_API_KEY only.
 */
import { loadLocalEnvFiles } from '../load-env.mjs';
import { bqRoot } from '../../../paths.mjs';

const ALLOWED_ROLES = new Set([
  'primary',
  'secondary',
  'accent',
  'neutrals',
  'semantic.success',
  'semantic.error',
  'semantic.warning',
  'semantic.info',
]);

function summarizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    ...(usage.reasoningTokens != null ? { reasoningTokens: usage.reasoningTokens } : {}),
  };
}

function formatUsageLine(aiUsage) {
  if (!aiUsage?.tokens) {
    return `AI usage: unavailable${aiUsage?.costNote ? ` (${aiUsage.costNote})` : ''}`;
  }
  const t = aiUsage.tokens;
  let line = `AI usage: total=${t.totalTokens} in=${t.inputTokens} out=${t.outputTokens} cacheRead=${t.cacheReadTokens} cacheWrite=${t.cacheWriteTokens}`;
  if (t.reasoningTokens != null) line += ` reasoning=${t.reasoningTokens}`;
  if (aiUsage.cost?.chargedCents != null) {
    line += ` charged=$${(aiUsage.cost.chargedCents / 100).toFixed(4)}`;
  } else if (aiUsage.costNote) {
    line += ` (${aiUsage.costNote})`;
  }
  return line;
}

function buildPrompt({ ambiguous, colors, buttons }) {
  const payload = {
    instruction:
      'Assign brand color roles using ONLY the provided candidate hex values. Do not invent or change any hex/spacing/font values. Reply with JSON only.',
    ambiguous,
    colorBuckets: {
      primary: colors?.primary?.hex?.slice(0, 5) ?? [],
      secondary: colors?.secondary?.hex?.slice(0, 5) ?? [],
      accent: colors?.accent?.hex?.slice(0, 5) ?? [],
      neutrals: colors?.neutrals?.hex?.slice(0, 8) ?? [],
      semantic: colors?.semantic ?? {},
    },
    buttonBackgrounds: (buttons?.variants ?? []).slice(0, 4).map((v) => ({
      name: v.name,
      background: v.background,
    })),
    allowedRoles: [...ALLOWED_ROLES],
    responseSchema: {
      roles: {
        primary: ['#hex from candidates'],
        secondary: ['#hex'],
        accent: ['#hex'],
        neutrals: ['#hex'],
      },
      note: 'optional short rationale',
    },
  };

  return [
    'You classify design-token roles for a website capture tool.',
    'Rules:',
    '- Use only hex values that appear in the JSON candidates.',
    '- Do not invent colors, fonts, spacing, radius, or shadows.',
    '- Prefer CSS-variable and high-score candidates when present.',
    '- Output a single JSON object matching responseSchema.roles.',
    '',
    JSON.stringify(payload),
  ].join('\n');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function applyRoleMap(colors, roleMap) {
  if (!roleMap || typeof roleMap !== 'object') return { colors, applied: false };
  const next = {
    ...colors,
    primary: { ...(colors.primary || { hex: [], gradients: [] }) },
    secondary: { ...(colors.secondary || { hex: [], gradients: [] }) },
    accent: { ...(colors.accent || { hex: [], gradients: [] }) },
    neutrals: { ...(colors.neutrals || { hex: [], gradients: [] }) },
    semantic: { ...(colors.semantic || {}) },
  };

  const allAllowed = new Set(
    [
      ...(colors.primary?.hex ?? []),
      ...(colors.secondary?.hex ?? []),
      ...(colors.accent?.hex ?? []),
      ...(colors.neutrals?.hex ?? []),
      ...Object.values(colors.semantic ?? {}).filter(Boolean),
    ].map((h) => String(h).toLowerCase()),
  );

  let applied = false;
  for (const role of ['primary', 'secondary', 'accent', 'neutrals']) {
    const list = roleMap[role];
    if (!Array.isArray(list)) continue;
    const filtered = list
      .map((h) => String(h).toLowerCase())
      .filter((h) => h.startsWith('#') && allAllowed.has(h));
    if (filtered.length) {
      next[role] = {
        ...next[role],
        hex: [...new Set(filtered)],
        gradients: next[role].gradients ?? [],
      };
      applied = true;
    }
  }
  return { colors: next, applied };
}

/**
 * @param {object} input
 * @param {{ ambiguous: object[], colors: object, buttons?: object }} input
 * @returns {Promise<{ colors: object, aiUsed: boolean, aiUsage: object|null, aiRaw: object|null, skipReason?: string }>}
 */
export async function classifyDesignTokensWithAi(input) {
  loadLocalEnvFiles({ root: bqRoot });
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey) {
    return {
      colors: input.colors,
      aiUsed: false,
      aiUsage: null,
      aiRaw: null,
      skipReason: 'CURSOR_API_KEY missing',
    };
  }

  if (!input.ambiguous?.length) {
    return {
      colors: input.colors,
      aiUsed: false,
      aiUsage: null,
      aiRaw: null,
      skipReason: 'no ambiguous roles',
    };
  }

  let Agent;
  try {
    ({ Agent } = await import('@cursor/sdk'));
  } catch (err) {
    return {
      colors: input.colors,
      aiUsed: false,
      aiUsage: null,
      aiRaw: null,
      skipReason: `@cursor/sdk not installed (${err instanceof Error ? err.message : err})`,
    };
  }

  const prompt = buildPrompt(input);
  let agent;
  let result;
  /** @type {object|null} */
  let aiUsage = null;

  try {
    agent = await Agent.create({
      apiKey,
      model: { id: process.env.CURSOR_DEFAULT_AI_MODEL || 'composer-2.5' },
      local: { cwd: bqRoot },
    });
    const run = await agent.send(prompt);
    result = await run.wait();

    const tokens = summarizeUsage(result?.usage);
    let cost = null;
    let costNote = null;
    try {
      const billed = await agent.getUsage();
      if (billed?.cost) cost = billed.cost;
      else costNote = 'billed cost unavailable';
      if (!tokens && billed?.usage) {
        aiUsage = { tokens: summarizeUsage(billed.usage), cost, costNote };
      } else {
        aiUsage = { tokens, cost, costNote: tokens ? costNote : costNote || 'result.usage unavailable' };
      }
    } catch {
      aiUsage = {
        tokens,
        cost: null,
        costNote: tokens ? 'getUsage failed' : 'usage unavailable',
      };
    }

    console.log(`    … ${formatUsageLine(aiUsage)}`);

    const parsed = extractJson(result?.result ?? '');
    const { colors, applied } = applyRoleMap(input.colors, parsed?.roles ?? parsed);
    return {
      colors,
      aiUsed: applied,
      aiUsage,
      aiRaw: parsed,
      skipReason: applied ? undefined : 'AI response had no usable role map',
    };
  } catch (err) {
    console.warn(
      `    … AI classification failed: ${err instanceof Error ? err.message : err}`,
    );
    return {
      colors: input.colors,
      aiUsed: false,
      aiUsage,
      aiRaw: null,
      skipReason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    try {
      await agent?.[Symbol.asyncDispose]?.();
    } catch {
      try {
        agent?.close?.();
      } catch {
        /* ignore */
      }
    }
  }
}

export { formatUsageLine, summarizeUsage };
