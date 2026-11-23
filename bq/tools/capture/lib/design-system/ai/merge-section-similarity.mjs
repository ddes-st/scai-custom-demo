/**
 * Azure judgment for unsure section pairs: same layout? which is more extended?
 * Sends full section.html for both sides. Logs token usage/cost.
 */
import { azureChatCompletion, resolveAzureChatConfig } from './azure-chat.mjs';

/**
 * @param {{
 *   htmlA: string,
 *   htmlB: string,
 *   labelA?: string,
 *   labelB?: string,
 * }} opts
 * @returns {Promise<{
 *   ok: boolean,
 *   same?: boolean,
 *   mostExtended?: 'a'|'b',
 *   reason?: string,
 *   skipReason?: string,
 *   model?: string,
 *   usage?: object,
 *   costEstimate?: object,
 * }>}
 */
export async function judgeSectionSimilarity(opts) {
  const config = resolveAzureChatConfig();
  if (!config.ok) {
    return { ok: false, skipReason: config.skipReason };
  }

  const labelA = opts.labelA || 'A';
  const labelB = opts.labelB || 'B';

  const system = [
    'You compare two HTML fragments that may be the same Sitecore UI component on different pages.',
    'Reply with ONLY a single JSON object (no markdown fences):',
    '{"same":true|false,"mostExtended":"a"|"b"|null,"reason":"short"}',
    'same=true when layout/slots match; treat different copy, images, link targets, number of repeating items (li/cards/crumbs/nav links), and UI state (active/current/open) as content differences — still same=true.',
    'same=false only when the layout skeleton differs (different regions/slots).',
    'If same=true, mostExtended is which fragment is richer/more complete for generating the component (more filled slots or repeating items). If same=false, mostExtended=null.',
  ].join(' ');

  const user = [
    `Fragment A (${labelA}):`,
    '-----',
    opts.htmlA || '',
    '-----',
    `Fragment B (${labelB}):`,
    '-----',
    opts.htmlB || '',
    '-----',
  ].join('\n');

  const result = await azureChatCompletion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    responseFormat: { type: 'json_object' },
  });

  if (!result.ok) {
    return {
      ok: false,
      skipReason: result.skipReason,
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
    };
  }

  let parsed;
  try {
    let text = String(result.content || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      skipReason: 'AI response was not valid JSON',
      model: result.model,
      usage: result.usage,
      costEstimate: result.costEstimate,
    };
  }

  const same = Boolean(parsed.same);
  let mostExtended = parsed.mostExtended === 'a' || parsed.mostExtended === 'b' ? parsed.mostExtended : null;
  if (same && !mostExtended) mostExtended = 'a';

  return {
    ok: true,
    same,
    mostExtended: same ? mostExtended : null,
    reason: String(parsed.reason || '').slice(0, 240),
    model: result.model,
    usage: result.usage,
    costEstimate: result.costEstimate,
  };
}
